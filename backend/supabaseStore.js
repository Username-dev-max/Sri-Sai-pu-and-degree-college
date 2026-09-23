/* =========================================================================
   supabaseStore.js — the Supabase persistence layer behind db.js.

   HOW IT PRESERVES THE APPLICATION
     Every route in this project calls load() to get the whole database as
     plain objects, mutates them, and calls save(). That contract is kept:

       hydrate()  reads every table once at startup and builds exactly the
                  object shape load() has always returned.
       flush(db)  compares the in-memory database with the last snapshot and
                  writes only what changed — an upsert per changed record and
                  a delete per removed one.

     So no route, no business rule and no API response changes. What changes
     is where the bytes live.

   HONEST LIMITS
     - One writer. The in-memory copy is the working set, so exactly one
       backend instance must run (the same constraint the JSON file had).
     - A write is acknowledged to the caller before Postgres confirms it.
       Failures are logged loudly and retried once; they are not silently
       swallowed. flushNow() awaits the queue when a caller needs certainty.
   ========================================================================= */
const { getClient } = require("./supabase");

/** Collections that are NOT a plain array of records with an `id`. */
const SINGLETON_KEYS = ["collegeProfile", "settings", "_migrations"];

const tableOf = (name) => `cms_${name.replace(/^_/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}`;
const PAGE = 1000;

/**
 * Collections that must be written before the ones referencing them.
 *
 * The relationship columns are GENERATED from the jsonb and carry real
 * foreign keys, which Postgres enforces on every new row. So when one save
 * creates a parent and a child together, the parent has to go first.
 * Anything not listed is written afterwards, in a stable alphabetical order.
 */
const WRITE_ORDER = [
  "courseLevels", "streams", "departments", "classes", "sections", "academicYears",
  "courses", "subjects", "faculty", "students", "users", "teams", "payments",
  "internalExams",
];

/** The last state written to Postgres, as collection -> id -> JSON string. */
let snapshot = new Map();
let queue = Promise.resolve();
let lastError = null;

function keyOf(collection, record) {
  if (collection === "authSessions") return String(record.jti);
  return String(record.id);
}

/** Read every row of one table, paging past Supabase's row cap. */
async function readAll(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("data").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data.map((r) => r.data));
    if (data.length < PAGE) break;
  }
  return rows;
}

/**
 * Build the in-memory database from Supabase.
 * @param shape the seed() object, used for the list of collections and as the
 *              default for anything the database has not stored yet.
 */
async function hydrate(shape) {
  const supabase = getClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const db = {};
  snapshot = new Map();

  // Counters and singletons, fetched together rather than one after the other.
  const [seqRes, singleRes] = await Promise.all([
    supabase.from("cms_seq").select("key,value"),
    supabase.from("cms_singletons").select("key,data"),
  ]);
  if (seqRes.error) throw new Error(`cms_seq: ${seqRes.error.message}`);
  if (singleRes.error) throw new Error(`cms_singletons: ${singleRes.error.message}`);
  db.seq = { ...shape.seq };
  seqRes.data.forEach((r) => {
    db.seq[r.key] = Number(r.value);
  });

  // Singletons.
  const singles = singleRes.data;
  const singleMap = new Map(singles.map((r) => [r.key, r.data]));
  SINGLETON_KEYS.forEach((key) => {
    const stored = singleMap.get(key);
    if (stored !== undefined) db[key] = stored.value !== undefined ? stored.value : stored;
    else if (shape[key] !== undefined) db[key] = shape[key];
  });

  /* Collections, all read at once.
     Reading them one after another meant 45 round trips in a row and took
     about 15 seconds for only a few hundred rows. That is longer than a
     serverless platform allows a function to spend starting up, so the first
     request after an idle period failed. The reads do not depend on each
     other, so they run together. */
  const collections = Object.entries(shape)
    .filter(([name, value]) => name !== "seq" && !SINGLETON_KEYS.includes(name) && Array.isArray(value))
    .map(([name]) => name);

  const loaded = await Promise.all(
    collections.map(async (name) => {
      const table = name === "authSessions" ? "cms_auth_sessions" : tableOf(name);
      return [name, await readAll(supabase, table)];
    })
  );

  for (const [name, rows] of loaded) {
    db[name] = rows;
    snapshot.set(name, new Map(rows.map((r) => [keyOf(name, r), JSON.stringify(r)])));
  }
  // Collections that exist in the database but not in seed() (older data).
  SINGLETON_KEYS.forEach((k) => {
    if (db[k] === undefined && shape[k] !== undefined) db[k] = shape[k];
  });

  snapshot.set("__seq", new Map(Object.entries(db.seq).map(([k, v]) => [k, String(v)])));
  SINGLETON_KEYS.forEach((k) => {
    if (db[k] !== undefined) snapshot.set(`__single_${k}`, new Map([["v", JSON.stringify(db[k])]]));
  });
  return db;
}

/** Work out what changed and write only that. */
async function writeChanges(db) {
  const supabase = getClient();
  if (!supabase) return;

  // Counters.
  const seqSnap = snapshot.get("__seq") || new Map();
  const seqChanges = Object.entries(db.seq || {})
    .filter(([k, v]) => seqSnap.get(k) !== String(v))
    .map(([key, value]) => ({ key, value: Number(value) || 0 }));
  if (seqChanges.length) {
    const { error } = await supabase.from("cms_seq").upsert(seqChanges, { onConflict: "key" });
    if (error) throw new Error(`cms_seq: ${error.message}`);
    seqChanges.forEach(({ key, value }) => seqSnap.set(key, String(value)));
    snapshot.set("__seq", seqSnap);
  }

  // Singletons.
  for (const key of SINGLETON_KEYS) {
    if (db[key] === undefined) continue;
    const serialized = JSON.stringify(db[key]);
    const snapKey = `__single_${key}`;
    if ((snapshot.get(snapKey)?.get("v")) === serialized) continue;
    const payload = Array.isArray(db[key]) ? { value: db[key] } : db[key];
    const { error } = await supabase.from("cms_singletons").upsert({ key, data: payload }, { onConflict: "key" });
    if (error) throw new Error(`cms_singletons/${key}: ${error.message}`);
    snapshot.set(snapKey, new Map([["v", serialized]]));
  }

  /* Collections, parents before children.
     Writing in plain object order broke the internal-marks upgrade: a mark
     that had just been given an examId was upserted before the exam row
     existed, and the foreign key rejected it. Deletes are collected and run
     afterwards in reverse order, so a parent is never removed while a child
     still points at it. */
  const rank = (name) => {
    const i = WRITE_ORDER.indexOf(name);
    return i === -1 ? WRITE_ORDER.length : i;
  };
  const names = Object.keys(db)
    .filter((name) => name !== "seq" && !SINGLETON_KEYS.includes(name) && Array.isArray(db[name]))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const pendingDeletes = [];

  for (const name of names) {
    const rows = db[name];
    const table = name === "authSessions" ? "cms_auth_sessions" : tableOf(name);
    const previous = snapshot.get(name) || new Map();
    const current = new Map();
    const changed = [];

    for (const record of rows) {
      if (!record || typeof record !== "object") continue;
      const id = keyOf(name, record);
      const serialized = JSON.stringify(record);
      current.set(id, serialized);
      if (previous.get(id) !== serialized) changed.push(record);
    }
    const removed = [...previous.keys()].filter((id) => !current.has(id));

    if (changed.length) {
      // Upsert in batches so one very large collection cannot blow the
      // request size limit.
      for (let i = 0; i < changed.length; i += 500) {
        const batch = changed.slice(i, i + 500).map((record) => ({ data: record }));
        const conflict = name === "authSessions" ? "jti" : "id";
        const { error } = await supabase.from(table).upsert(batch, { onConflict: conflict });
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }
    if (removed.length) pendingDeletes.push({ name, table, removed });
    snapshot.set(name, current);
  }

  for (const { name, table, removed } of pendingDeletes.reverse()) {
    const column = name === "authSessions" ? "jti" : "id";
    for (let i = 0; i < removed.length; i += 500) {
      const batch = removed.slice(i, i + 500);
      const { error } = await supabase.from(table).delete().in(column, batch);
      if (error) throw new Error(`${table} delete: ${error.message}`);
    }
  }
}

/**
 * Persist the current database. Queued, so two saves never interleave.
 * Returns the promise for callers that want to await the write.
 */
function flush(db) {
  queue = queue
    .then(() => writeChanges(db))
    .then(() => {
      lastError = null;
    })
    .catch(async (e) => {
      // One retry: a transient network blip should not lose a write.
      try {
        await writeChanges(db);
        lastError = null;
      } catch (again) {
        lastError = again;
        console.error("SUPABASE WRITE FAILED — data is in memory but not saved:", again.message);
      }
    });
  return queue;
}

/** Wait for every queued write to finish. */
function flushNow() {
  return queue;
}

function getLastError() {
  return lastError;
}

module.exports = { hydrate, flush, flushNow, getLastError, tableOf, SINGLETON_KEYS };
