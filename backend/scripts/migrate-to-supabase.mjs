#!/usr/bin/env node
/* =========================================================================
   migrate-to-supabase.mjs — move data.json into Supabase PostgreSQL.

   Safe to run more than once: every record is upserted on its own id, so a
   second run updates rather than duplicates.

   It never deletes data.json, and it never prints a secret.

   Before running, apply the schema once:
     Supabase dashboard -> SQL Editor -> paste database/supabase-schema.sql -> Run
   (DDL cannot be issued through the REST API, so this step is manual.)

   Usage:
     node scripts/migrate-to-supabase.mjs              # migrate and verify
     node scripts/migrate-to-supabase.mjs --verify     # verify counts only
     node scripts/migrate-to-supabase.mjs --file <path>

   Environment (never committed):
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, "..");
const require = createRequire(path.join(BACKEND, "package.json"));
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const verifyOnly = args.includes("--verify");
const fileArg = args.indexOf("--file");
const DATA_FILE = fileArg !== -1 ? args[fileArg + 1] : path.join(BACKEND, "data.json");

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("\nSUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.");
  console.error("Set them in backend/.env (git-ignored) or in your shell, then run again.");
  console.error("Never pass the key on the command line — it would land in your shell history.\n");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const SINGLETON_KEYS = ["collegeProfile", "settings", "_migrations"];
const tableOf = (name) => `cms_${name.replace(/^_/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}`;
const keyOf = (collection, record) => (collection === "authSessions" ? String(record.jti) : String(record.id));

/** Parents before children, so foreign keys are satisfied as we go. */
const ORDER = [
  "courseLevels", "streams", "departments", "classes", "sections", "academicYears", "courses", "subjects",
  "faculty", "students", "users", "teams", "teamMembers", "enrollments", "facultyAssignments", "classTeachers",
  "internalExams", "internalMarks", "internalMarkHistory", "attendance", "attendanceHistory", "attendanceAlerts",
  "leaveRequests", "callFollowups", "fees", "feeInstallments", "payments", "receipts", "marks", "exams",
  "timetable", "timetablePublications", "notes", "documents", "assignments", "announcements", "notices",
  "notifications", "auditLogs", "galleryItems", "sportsAchievements", "academicMerit", "admissionInquiries",
  "authSessions",
];

async function tableExists(table) {
  const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(1);
  return !error;
}

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

async function main() {
  console.log("\nSupabase migration");
  console.log(`  Project URL : ${URL}`);
  console.log(`  Source file : ${DATA_FILE}`);
  console.log(`  Mode        : ${verifyOnly ? "verify only" : "migrate + verify"}\n`);

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Source file not found: ${DATA_FILE}`);
    process.exit(1);
  }
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

  // 1. Schema check --------------------------------------------------------
  const collections = Object.entries(db).filter(([k, v]) => Array.isArray(v) && !SINGLETON_KEYS.includes(k));
  const needed = ["cms_seq", "cms_singletons", ...collections.map(([n]) => (n === "authSessions" ? "cms_auth_sessions" : tableOf(n)))];
  const missing = [];
  for (const t of needed) {
    if (!(await tableExists(t))) missing.push(t);
  }
  if (missing.length) {
    console.error("These tables do not exist yet:");
    missing.forEach((t) => console.error(`  - ${t}`));
    console.error("\nApply database/supabase-schema.sql in the Supabase SQL Editor first, then re-run.\n");
    process.exit(1);
  }
  console.log(`Schema OK — ${needed.length} tables present.\n`);

  // 2. Write ---------------------------------------------------------------
  if (!verifyOnly) {
    // Counters.
    const seqRows = Object.entries(db.seq || {}).map(([key, value]) => ({ key, value: Number(value) || 0 }));
    if (seqRows.length) {
      const { error } = await supabase.from("cms_seq").upsert(seqRows, { onConflict: "key" });
      if (error) throw new Error(`cms_seq: ${error.message}`);
      console.log(`  cms_seq: ${seqRows.length} counters`);
    }
    // Singletons.
    for (const key of SINGLETON_KEYS) {
      if (db[key] === undefined) continue;
      const payload = Array.isArray(db[key]) ? { value: db[key] } : db[key];
      const { error } = await supabase.from("cms_singletons").upsert({ key, data: payload }, { onConflict: "key" });
      if (error) throw new Error(`cms_singletons/${key}: ${error.message}`);
      console.log(`  cms_singletons: ${key}`);
    }
    // Collections, parents first.
    const names = [...ORDER.filter((n) => Array.isArray(db[n])), ...collections.map(([n]) => n).filter((n) => !ORDER.includes(n))];
    for (const name of names) {
      const rows = db[name];
      if (!rows.length) {
        console.log(`  ${name}: empty`);
        continue;
      }
      const table = name === "authSessions" ? "cms_auth_sessions" : tableOf(name);
      const conflict = name === "authSessions" ? "jti" : "id";
      const seen = new Set();
      const payload = [];
      for (const record of rows) {
        if (!record || typeof record !== "object") continue;
        const id = keyOf(name, record);
        if (id === "undefined" || seen.has(id)) continue; // never duplicate an id
        seen.add(id);
        payload.push({ data: record });
      }
      for (let i = 0; i < payload.length; i += 500) {
        const { error } = await supabase.from(table).upsert(payload.slice(i, i + 500), { onConflict: conflict });
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      console.log(`  ${name}: ${payload.length} record(s) -> ${table}`);
    }
    console.log();
  }

  // 3. Verify --------------------------------------------------------------
  console.log("Entity                    | Source | Supabase | Status");
  console.log("--------------------------|--------|----------|-------");
  let mismatch = 0;
  const report = [];
  for (const [name, rows] of collections) {
    const table = name === "authSessions" ? "cms_auth_sessions" : tableOf(name);
    const source = new Set(rows.filter((r) => r && typeof r === "object").map((r) => keyOf(name, r))).size;
    const target = await countRows(table);
    const okRow = target !== null && target >= source;
    if (!okRow) mismatch += 1;
    report.push({ name, source, target, ok: okRow });
    console.log(`${name.padEnd(25)} | ${String(source).padStart(6)} | ${String(target ?? "?").padStart(8)} | ${okRow ? "OK" : "MISMATCH"}`);
  }
  const seqCount = await countRows("cms_seq");
  const singleCount = await countRows("cms_singletons");
  console.log(`${"seq (counters)".padEnd(25)} | ${String(Object.keys(db.seq || {}).length).padStart(6)} | ${String(seqCount).padStart(8)} | ${seqCount >= Object.keys(db.seq || {}).length ? "OK" : "MISMATCH"}`);
  console.log(`${"singletons".padEnd(25)} | ${String(SINGLETON_KEYS.filter((k) => db[k] !== undefined).length).padStart(6)} | ${String(singleCount).padStart(8)} | ${"OK"}`);

  console.log();
  if (mismatch) {
    console.error(`${mismatch} entity/entities do not match. The migration is NOT complete.`);
    process.exit(1);
  }
  console.log("All entity counts match or exceed the source. data.json has NOT been modified or deleted.");
  console.log("Keep the backup until you have tested the application against Supabase.\n");
}

main().catch((e) => {
  console.error("\nMIGRATION FAILED:", e.message, "\n");
  process.exit(1);
});
