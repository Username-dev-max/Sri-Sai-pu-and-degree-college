#!/usr/bin/env node
/* =========================================================================
   generate-supabase-schema.mjs — writes database/supabase-schema.sql from
   the REAL shape of data.json.

   Design, and why:
     Every collection becomes its own table with a real primary key, the
     record's fields in a `data` jsonb column, and GENERATED columns for the
     fields that carry relationships (student, subject, classId, …). Those
     generated columns are indexed and carry the foreign keys, so Postgres
     enforces the relationships and the usual queries stay fast.

     The fields themselves stay in jsonb because the application's routes
     read and write whole records with a shape that varies per record (an
     internal mark row grows a `history`, a user may or may not have
     `linkedIds`). Splitting every field into a column would mean rewriting
     every route — exactly what this migration is asked not to do — and would
     silently drop any field the schema did not anticipate.

   Run:  node scripts/generate-supabase-schema.mjs
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, "..");
const ROOT = path.resolve(BACKEND, "..");
const DATA = path.join(BACKEND, "data.json");
const OUT = path.join(ROOT, "database", "supabase-schema.sql");

/** snake_case table name for a collection, prefixed to avoid clashes. */
const tableOf = (name) => `cms_${name.replace(/^_/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}`;

/**
 * Relationship fields per collection: [jsonb key, sql column, references].
 * Only relationships that actually exist in the data are declared.
 */
const RELATIONS = {
  students: [["course", "course_id", "cms_courses"], ["classId", "class_id", "cms_classes"], ["section", "section_id", "cms_sections"], ["department", "department_id", "cms_departments"], ["academicYear", "academic_year_id", "cms_academic_years"]],
  faculty: [["department", "department_id", "cms_departments"]],
  subjects: [["department", "department_id", "cms_departments"], ["courseId", "course_id", "cms_courses"], ["classId", "class_id", "cms_classes"]],
  courses: [["levelId", "level_id", "cms_course_levels"], ["stream", "stream_id", "cms_streams"]],
  classes: [["levelId", "level_id", "cms_course_levels"]],
  streams: [["levelId", "level_id", "cms_course_levels"]],
  users: [["linkedId", "linked_id", null]],
  enrollments: [["studentId", "student_id", "cms_students"], ["academicYearId", "academic_year_id", "cms_academic_years"], ["courseId", "course_id", "cms_courses"], ["classId", "class_id", "cms_classes"]],
  attendance: [["student", "student_id", "cms_students"], ["subject", "subject_id", "cms_subjects"], ["classId", "class_id", "cms_classes"], ["academicYearId", "academic_year_id", "cms_academic_years"], ["date", "attendance_date", null]],
  attendanceHistory: [["student", "student_id", "cms_students"], ["subject", "subject_id", "cms_subjects"], ["attendanceId", "attendance_id", null]],
  attendanceAlerts: [["studentId", "student_id", "cms_students"]],
  internalMarks: [["studentId", "student_id", "cms_students"], ["subjectId", "subject_id", "cms_subjects"], ["examId", "exam_id", "cms_internal_exams"], ["classId", "class_id", "cms_classes"], ["status", "status", null]],
  internalMarkHistory: [["markId", "mark_id", null], ["studentId", "student_id", "cms_students"], ["examId", "exam_id", "cms_internal_exams"]],
  internalExams: [["academicYearId", "academic_year_id", "cms_academic_years"], ["classId", "class_id", "cms_classes"], ["courseId", "course_id", "cms_courses"]],
  facultyAssignments: [["facultyId", "faculty_id", "cms_faculty"], ["subjectId", "subject_id", "cms_subjects"], ["classId", "class_id", "cms_classes"]],
  classTeachers: [["facultyId", "faculty_id", "cms_faculty"], ["classId", "class_id", "cms_classes"]],
  timetable: [["classId", "class_id", "cms_classes"], ["subject", "subject_id", "cms_subjects"], ["faculty", "faculty_id", "cms_faculty"]],
  timetablePublications: [["classId", "class_id", "cms_classes"]],
  fees: [["student", "student_id", "cms_students"]],
  feeInstallments: [["studentId", "student_id", "cms_students"]],
  payments: [["student", "student_id", "cms_students"]],
  receipts: [["studentId", "student_id", "cms_students"], ["paymentId", "payment_id", null]],
  marks: [["student", "student_id", "cms_students"], ["subject", "subject_id", "cms_subjects"]],
  documents: [["ownerId", "owner_id", null], ["ownerType", "owner_type", null]],
  notes: [["subjectId", "subject_id", "cms_subjects"], ["classId", "class_id", "cms_classes"], ["uploadedBy", "uploaded_by", null]],
  leaveRequests: [["studentId", "student_id", "cms_students"], ["classTeacherId", "class_teacher_id", "cms_faculty"], ["status", "status", null]],
  callFollowups: [["studentId", "student_id", "cms_students"], ["callerUserId", "caller_user_id", null]],
  notifications: [["userId", "user_id", null], ["read", "is_read", null]],
  auditLogs: [["actorId", "actor_id", null], ["entityType", "entity_type", null], ["at", "occurred_at", null]],
  assignments: [["createdBy", "created_by", null]],
  teamMembers: [["team", "team_id", "cms_teams"]],
  exams: [["subject", "subject_id", "cms_subjects"]],
};

/** Collections whose id is a number rather than a string. */
const NUMERIC_ID = new Set(["users"]);

/**
 * Build from every collection the APPLICATION can write, not only the ones
 * that happen to hold rows today.
 *
 * data.json predates the newer collections (internalExams, internalMarkHistory,
 * attendanceHistory, attendanceAlerts). Generating from the file alone left
 * those tables out, so the foreign keys referenced tables that were never
 * created — and once running, the app would have had nowhere to persist them.
 * seed() is the authoritative list of collections; the live file supplies the
 * rows and any collection added since.
 */
const require = createRequire(import.meta.url);
const { seed: seedShape } = require(path.join(BACKEND, "db.js"));
const live = JSON.parse(fs.readFileSync(DATA, "utf8"));
const db = { ...seedShape(), ...live };
const lines = [];
const p = (s = "") => lines.push(s);

p("-- ============================================================================");
p("-- Sri Sai PU and Degree College — Supabase / PostgreSQL schema");
p("--");
p("-- Generated from the live data model by:");
p("--   node backend/scripts/generate-supabase-schema.mjs");
p("--");
p("-- Apply it once in the Supabase dashboard: SQL Editor -> New query -> paste");
p("-- -> Run. It is idempotent, so running it again is safe.");
p("--");
p("-- Every record keeps its original id and every field it had. Relationship");
p("-- fields are lifted out of the jsonb into generated, indexed columns so");
p("-- Postgres enforces the foreign keys.");
p("--");
p("-- RLS is enabled with NO policies on every table: only the backend's");
p("-- service-role key can read or write, so no browser can reach this data");
p("-- directly, even with the anon key.");
p("-- ============================================================================");
p();

// Singletons first (no dependencies).
p("-- --------------------------------------------------------------------------");
p("-- Singletons and counters");
p("-- --------------------------------------------------------------------------");
p(`create table if not exists cms_seq (
  key text primary key,
  value bigint not null default 0,
  updated_at timestamptz not null default now()
);`);
p();
p(`create table if not exists cms_singletons (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);`);
p("-- Holds collegeProfile, settings and the applied-migration list.");
p();

const arrays = Object.entries(db).filter(([, v]) => Array.isArray(v));
// Parent tables must exist before the tables that reference them.
const ORDER = [
  "courseLevels", "streams", "departments", "classes", "sections", "academicYears", "courses", "subjects",
  "faculty", "students", "users", "teams",
];
const ordered = [
  ...ORDER.filter((n) => db[n]),
  ...arrays.map(([n]) => n).filter((n) => !ORDER.includes(n)),
];

p("-- --------------------------------------------------------------------------");
p("-- Collections");
p("-- --------------------------------------------------------------------------");

const constraints = [];
for (const name of ordered) {
  if (name === "_migrations") continue; // string list -> cms_singletons
  if (name === "authSessions") continue; // keyed by jti, handled below
  const table = tableOf(name);
  const idType = NUMERIC_ID.has(name) ? "bigint" : "text";
  const idExpr = NUMERIC_ID.has(name) ? "((data->>'id')::bigint)" : "(data->>'id')";
  const rels = RELATIONS[name] || [];

  p();
  p(`-- ${name} (${db[name].length} record${db[name].length === 1 ? "" : "s"} at migration time)`);
  p(`create table if not exists ${table} (`);
  p(`  id ${idType} generated always as ${idExpr} stored,`);
  p("  data jsonb not null,");
  // nullif(..., '') matters: an optional link is stored as "" in the JSON (a
  // degree programme has stream: "", a whole-class row has sectionId: ""), and
  // Postgres enforces a foreign key on an empty string just as it would on a
  // real id — so it would look for a row whose id is "" and reject the insert.
  // NULL is the correct representation of "no link" and FKs ignore it.
  for (const [key, col] of rels) {
    p(`  ${col} text generated always as (nullif(data->>'${key}', '')) stored,`);
  }
  p("  created_at timestamptz not null default now(),");
  p("  updated_at timestamptz not null default now(),");
  p(`  constraint ${table}_pkey primary key (id)`);
  p(");");
  for (const [, col] of rels) {
    p(`create index if not exists ${table}_${col}_idx on ${table} (${col});`);
  }
  for (const [, col, ref] of rels) {
    if (!ref) continue;
    // NO ACTION (the default) is the only referential action Postgres allows
    // here: these columns are GENERATED from the jsonb, so CASCADE or SET NULL
    // would have to write to a column that cannot be written to. The record's
    // real value lives in `data`, and the application owns those updates.
    constraints.push(
      `alter table ${table} drop constraint if exists ${table}_${col}_fkey;\n` +
        `alter table ${table} add constraint ${table}_${col}_fkey\n` +
        `  foreign key (${col}) references ${ref}(id) not valid;`
    );
  }
}

p();
p("-- Login sessions are keyed by their JWT id (jti), not an `id` field.");
p(`create table if not exists cms_auth_sessions (
  jti text generated always as (data->>'jti') stored,
  data jsonb not null,
  user_id text generated always as (nullif(data->>'userId', '')) stored,
  created_at timestamptz not null default now(),
  constraint cms_auth_sessions_pkey primary key (jti)
);`);
p("create index if not exists cms_auth_sessions_user_id_idx on cms_auth_sessions (user_id);");

p();
p("-- --------------------------------------------------------------------------");
p("-- Foreign keys");
p("--");
p("-- Added NOT VALID so existing rows migrate even if a legacy record points");
p("-- at something that was deleted long ago. Run `validate constraint` later");
p("-- once you have reviewed any such rows.");
p("--");
p("-- The referential action is NO ACTION (the default) because these columns");
p("-- are GENERATED from the jsonb: Postgres refuses CASCADE / SET NULL on a");
p("-- column it cannot write to. Deletes are handled by the application, which");
p("-- already clears dependent records (see routes/students.js).");
p("-- --------------------------------------------------------------------------");
constraints.forEach((c) => {
  p();
  p(c);
});

p();
p("-- --------------------------------------------------------------------------");
p("-- Row Level Security: deny everything except the service-role key");
p("-- --------------------------------------------------------------------------");
const allTables = [
  "cms_seq",
  "cms_singletons",
  "cms_auth_sessions",
  ...ordered.filter((n) => n !== "_migrations" && n !== "authSessions").map(tableOf),
];
allTables.forEach((t) => p(`alter table ${t} enable row level security;`));

p();
p("-- --------------------------------------------------------------------------");
p("-- Keep updated_at honest");
p("-- --------------------------------------------------------------------------");
p(`create or replace function cms_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;`);
allTables
  .filter((t) => t !== "cms_auth_sessions")
  .forEach((t) => {
    p(`drop trigger if exists ${t}_touch on ${t};`);
    p(`create trigger ${t}_touch before update on ${t} for each row execute function cms_touch_updated_at();`);
  });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${lines.join("\n")}\n`);
console.log(`Wrote ${OUT}`);
console.log(`Tables: ${allTables.length} (${ordered.length - 2} collections + seq, singletons, auth sessions)`);
console.log(`Foreign keys: ${constraints.length}`);
