/* =========================================================================
   repo.js — table-shaped data access over the JSON store.

   Why this exists: routes should never reach into `db.someArray` directly.
   Every function here maps 1:1 onto a SQL statement, so moving to MySQL or
   Postgres later means reimplementing THIS FILE only — the route handlers
   and the entire frontend keep working against an unchanged REST contract.

     findAll(t, where)   -> SELECT * FROM t WHERE ...
     findById(t, id)     -> SELECT * FROM t WHERE id = ?
     insert(t, row)      -> INSERT INTO t ...
     update(t, id, patch)-> UPDATE t SET ... WHERE id = ?
     remove(t, id)       -> DELETE FROM t WHERE id = ?
     count(t, where)     -> SELECT COUNT(*) FROM t WHERE ...
     paginate(...)       -> SELECT ... LIMIT ? OFFSET ?

   The one deliberate difference from SQL: callers get live object
   references, not copies, so a caller that mutates a returned row must
   still call commit(). Read paths should treat results as read-only.
   ========================================================================= */
const { load, save } = require("./db");

function table(name) {
  const db = load();
  if (!Array.isArray(db[name])) {
    throw new Error(`repo: '${name}' is not a collection`);
  }
  return db[name];
}

/** Matches a row against a plain-object predicate. Array values mean IN (...). */
function matches(row, where) {
  return Object.entries(where || {}).every(([k, v]) => {
    if (v === undefined) return true;
    if (Array.isArray(v)) return v.includes(row[k]);
    return row[k] === v;
  });
}

function findAll(name, where) {
  const rows = table(name);
  return where ? rows.filter((r) => matches(r, where)) : rows.slice();
}

function findOne(name, where) {
  return table(name).find((r) => matches(r, where)) || null;
}

function findById(name, id) {
  return table(name).find((r) => r.id === id) || null;
}

function count(name, where) {
  return where ? table(name).filter((r) => matches(r, where)).length : table(name).length;
}

/**
 * Generates the next id for a collection using the db's seq counters, so ids
 * stay unique even after rows are deleted (a MAX(id)+1 scheme would reuse
 * them). Falls back to a scan for collections with no counter.
 */
function nextId(name, prefix, counterKey) {
  const db = load();
  if (counterKey) {
    db.seq[counterKey] = (db.seq[counterKey] || 0) + 1;
    return `${prefix}${String(db.seq[counterKey]).padStart(4, "0")}`;
  }
  const rows = table(name);
  const max = rows.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ""), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function insert(name, row) {
  table(name).push(row);
  save();
  return row;
}

function insertMany(name, rows) {
  table(name).push(...rows);
  save();
  return rows;
}

function update(name, id, patch) {
  const row = findById(name, id);
  if (!row) return null;
  Object.assign(row, patch);
  save();
  return row;
}

function remove(name, id) {
  const rows = table(name);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return false;
  rows.splice(i, 1);
  save();
  return true;
}

function removeWhere(name, where) {
  const rows = table(name);
  let n = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (matches(rows[i], where)) {
      rows.splice(i, 1);
      n += 1;
    }
  }
  if (n) save();
  return n;
}

/** Persist mutations made directly on rows returned by this module. */
function commit() {
  save();
}

/**
 * Page a list that has already been filtered/sorted by the caller.
 *
 * Returns `{ rows, meta }` — deliberately NOT one flat object. Routes
 * typically sanitise rows before responding (`res.json({ ...meta, users:
 * rows.map(publicUser) })`); if the page data were mixed into the same object
 * as the metadata, spreading it would also ship the RAW rows next to the
 * sanitised ones, leaking whatever the projection was there to strip. Keeping
 * them apart makes that mistake impossible rather than merely discouraged.
 */
function paginate(rows, { page = 1, pageSize = 25 } = {}) {
  const total = rows.length;
  const size = Math.max(1, Math.min(Number(pageSize) || 25, 200));
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.max(1, Math.min(Number(page) || 1, pages));
  const start = (current - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    meta: { total, page: current, pageSize: size, pages },
  };
}

module.exports = {
  findAll,
  findOne,
  findById,
  count,
  nextId,
  insert,
  insertMany,
  update,
  remove,
  removeWhere,
  commit,
  paginate,
  load,
};
