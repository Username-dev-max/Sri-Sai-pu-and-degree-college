#!/usr/bin/env node
/* =========================================================================
   dev-seed.mjs — DEVELOPMENT / DEMO DATA ONLY.

   Creates a small, clearly fictional dataset so the Task 3 workflows can be
   exercised end to end. Every record is created THROUGH THE REAL API, so it
   passes exactly the validation and authorization that a real Admin,
   faculty or student action would. Nothing is written to data.json directly.

   What it deliberately does NOT do:
     - modify real college data (faculty roster, courses, BCA configuration);
     - invent phone numbers that could reach a real person — demo guardian
       numbers are 0000000001 to 0000000004, which no Indian mobile uses;
     - invent email addresses (left blank);
     - seed a timetable: a class timetable attaches to a real class and real
       staff, so it would look like the college's actual schedule;
     - write any password to disk inside the project.

   Real staff: the four BCA faculty named by the college are given LOGIN
   ACCOUNTS so faculty workflows can be tested. Their roster records are not
   changed. Each account gets a temporary password that must be changed at
   first sign-in. An account this script did not create is never touched.

   Usage (backend must be running):
     node scripts/dev-seed.mjs
   Optional environment:
     API=http://localhost:5000/api
     DEV_SEED_CREDENTIALS_OUT=<file OUTSIDE the project>   save temp passwords

   Safe to re-run: existing demo students, fees and notes are reused rather
   than duplicated; attendance and marks are upserts.
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, "..");
const requireFromBackend = createRequire(path.join(BACKEND, "package.json"));
const API = process.env.API || "http://localhost:5000/api";
const MANIFEST = path.join(BACKEND, "dev-seed-manifest.json");
const DEMO_TAG = "(development data)";

async function api(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(API + url, { method, headers, body: payload });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no JSON body */
  }
  if (!res.ok) {
    const err = new Error(`${method} ${url} -> ${res.status}: ${data?.error || res.statusText}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function login(username, password) {
  return (await api("POST", "/auth/login", { body: { username, password } })).token;
}

const log = (step, msg) => console.log(`  [${step.padEnd(10)}] ${msg}`);

async function main() {
  console.log(`\nDEV SEED — development data only — ${API}\n`);

  const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
  const created = {
    students: [],
    studentUsers: [],
    parentUsers: [],
    facultyUsers: [],
    feesFor: [],
    notes: [],
    leaveRequests: [],
    ...(previous.created || {}),
  };
  const credentials = [];

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("Set SEED_ADMIN_PASSWORD (or ADMIN_PASSWORD) before running this script.");
    process.exit(1);
  }
  const admin = await login("admin", adminPassword);
  log("auth", "signed in as admin");

  /* Resolve the real structure rather than assuming ids. */
  const cfg = await api("GET", "/academic-config?all=1", { token: admin });
  const bca = cfg.combinations.find((c) => c.name === "BCA");
  const year1 = cfg.classes.find((c) => c.id === "CLS03");
  const secAI = cfg.sections.find((s) => s.id === "SEC_AI");
  if (!bca) throw new Error("BCA programme not found. Start the backend once so its migrations run.");
  if (!year1 || !secAI) throw new Error("BCA 1st Year / AI section not found. The BCA migration has not run.");
  log("config", `BCA=${bca.id}  1st Year=${year1.id}  AI section=${secAI.id}`);

  /* 1. Login accounts for the four real BCA faculty. */
  const FACULTY = [
    { match: /pavithra/i, username: "faculty.pavithra", key: "pavithra" },
    { match: /\broy\b/i, username: "faculty.roy", key: "roy" },
    { match: /umesh/i, username: "faculty.umesh", key: "umesh" },
    { match: /^praveen$/i, username: "faculty.praveen", key: "praveen" },
  ];
  const { faculty: roster } = await api("GET", "/faculty", { token: admin });
  const { users: facultyAccounts } = await api("GET", "/users?role=Faculty&pageSize=200", { token: admin });
  const facultyTokens = {};

  for (const f of FACULTY) {
    const rec = roster.find((r) => f.match.test(r.name));
    if (!rec) {
      log("faculty", `SKIP — no roster record matches ${f.match}`);
      continue;
    }
    const existing = facultyAccounts.find((u) => u.linkedId === rec.id);
    let creds;
    if (existing) {
      if (!created.facultyUsers.includes(existing.id)) {
        // Someone else created this account. Resetting it could lock a real
        // staff member out of a password they chose, so it is left alone.
        log("faculty", `${rec.name} already has account '${existing.username}' (not created by this seed) — left unchanged`);
        continue;
      }
      creds = (await api("POST", `/users/${existing.id}/reset-password`, { token: admin })).credentials;
      log("faculty", `${rec.name}: reissued a temporary password for '${creds.username}'`);
    } else {
      const r = await api("POST", "/users", {
        token: admin,
        body: { role: "Faculty", name: rec.name, linkedId: rec.id, username: f.username },
      });
      creds = r.credentials;
      created.facultyUsers.push(r.user.id);
      log("faculty", `${rec.name}: created account '${creds.username}'`);
    }
    credentials.push({ role: "Faculty", name: rec.name, ...creds });
    facultyTokens[f.key] = await login(creds.username, creds.password);
  }

  /* 2. Four demo students — BCA 1st Year, AI section. */
  const DEMO_STUDENTS = [1, 2, 3, 4].map((n) => {
    const nn = String(n).padStart(2, "0");
    return {
      name: `Demo Student ${nn}`,
      admissionNumber: `BCA1-AI-STU00${n}`,
      rollNumber: nn,
      gender: n % 2 ? "Female" : "Male",
      dob: `2007-0${n}-15`,
      guardian: `Demo Guardian ${nn}`,
      guardianPhone: `000000000${n}`,
      emergencyContact: `000000000${n}`,
    };
  });
  const students = [];
  for (const s of DEMO_STUDENTS) {
    const { students: hits } = await api("GET", `/students?q=${encodeURIComponent(s.admissionNumber)}`, { token: admin });
    const found = hits.find((x) => x.admissionNumber === s.admissionNumber);
    if (found) {
      students.push(found);
      log("student", `${s.admissionNumber} already exists (${found.id}) — reused`);
      continue;
    }
    const r = await api("POST", "/students", {
      token: admin,
      body: {
        ...s,
        course: bca.id,
        classId: year1.id,
        section: secAI.id,
        department: bca.department || "",
        address: DEMO_TAG,
      },
    });
    students.push(r.student);
    created.students.push(r.student.id);
    log("student", `enrolled ${s.name} as ${r.student.id} (${s.admissionNumber})`);
  }
  const ids = students.map((s) => s.id);

  /* 3. Student login accounts. */
  const { users: studentAccounts } = await api("GET", "/users?role=Student&pageSize=200", { token: admin });
  const studentTokens = {};
  for (const s of students) {
    const existing = studentAccounts.find((u) => u.linkedId === s.id);
    let creds;
    if (existing) {
      creds = (await api("POST", `/users/${existing.id}/reset-password`, { token: admin })).credentials;
    } else {
      creds = (await api("POST", `/students/${s.id}/account`, { token: admin })).credentials;
      const u = (await api("GET", `/users?q=${encodeURIComponent(creds.username)}`, { token: admin })).users[0];
      if (u) created.studentUsers.push(u.id);
    }
    credentials.push({ role: "Student", name: s.name, admissionNumber: s.admissionNumber, ...creds });
    studentTokens[s.id] = await login(creds.username, creds.password);
    log("account", `${s.name}: '${creds.username}'`);
  }

  /* 4. Parents — Demo Parent 02 is linked to TWO children, to test multi-child access. */
  const DEMO_PARENTS = [
    { name: "Demo Parent 01", username: "demo.parent01", children: [0] },
    { name: "Demo Parent 02", username: "demo.parent02", children: [1, 2] },
    { name: "Demo Parent 03", username: "demo.parent03", children: [3] },
  ];
  const { users: parentAccounts } = await api("GET", "/users?role=Parent&pageSize=200", { token: admin });
  for (const p of DEMO_PARENTS) {
    const linkedIds = p.children.map((i) => ids[i]);
    const existing = parentAccounts.find((u) => u.username === p.username);
    let creds;
    if (existing) {
      await api("PUT", `/users/${existing.id}`, { token: admin, body: { linkedIds } });
      creds = (await api("POST", `/users/${existing.id}/reset-password`, { token: admin })).credentials;
    } else {
      const r = await api("POST", "/users", {
        token: admin,
        body: { role: "Parent", name: p.name, username: p.username, linkedIds },
      });
      creds = r.credentials;
      created.parentUsers.push(r.user.id);
    }
    credentials.push({ role: "Parent", name: p.name, children: linkedIds.join(", "), ...creds });
    log("parent", `${p.name} ('${creds.username}') linked to ${linkedIds.join(", ")}`);
  }

  /* 5. Fees — ₹30,000 in three installments; the first two students paid Installment 1. */
  const INSTALLMENTS = [
    { label: "Installment 1", amount: 10000, dueDate: "2026-07-15" },
    { label: "Installment 2", amount: 10000, dueDate: "2026-10-15" },
    { label: "Installment 3", amount: 10000, dueDate: "2027-01-15" },
  ];
  for (const [i, s] of students.entries()) {
    try {
      await api("POST", "/fees", { token: admin, body: { student: s.id, total: 30000, dueDate: "2027-01-15" } });
    } catch (e) {
      if (e.status !== 409) throw e;
      log("fees", `${s.id} already has a fee record — left unchanged`);
      continue;
    }
    created.feesFor.push(s.id);
    for (const inst of INSTALLMENTS) {
      await api("POST", `/fees/${s.id}/installments`, { token: admin, body: inst });
    }
    if (i < 2) {
      const pay = await api("POST", `/fees/${s.id}/payments`, { token: admin, body: { amount: 10000, mode: "UPI" } });
      log("fees", `${s.name}: 3 installments; paid Installment 1 (receipt ${pay.receipt.receiptNo})`);
    } else {
      log("fees", `${s.name}: 3 installments; nothing paid (Installment 1 overdue)`);
    }
  }

  /* 6. Attendance — taken by the ASSIGNED faculty through their own login. */
  const pav = facultyTokens.pavithra;
  const roy = facultyTokens.roy;
  const register = (absent = []) =>
    ids.map((id, i) => ({ student: id, status: absent.includes(i) ? "Absent" : "Present" }));
  const REGISTERS = [
    { token: pav, who: "Pavithra", subject: "BSUB01", date: "2026-09-08", absent: [] },
    { token: pav, who: "Pavithra", subject: "BSUB01", date: "2026-09-09", absent: [2] },
    { token: pav, who: "Pavithra", subject: "BSUB02", date: "2026-09-10", absent: [3] },
    { token: roy, who: "Roy", subject: "BSUB03", date: "2026-09-10", absent: [2] },
    { token: roy, who: "Roy", subject: "BSUB03", date: "2026-09-11", absent: [] },
  ];
  for (const r of REGISTERS) {
    if (!r.token) {
      log("attendance", `SKIP ${r.subject} ${r.date} — no seeded account for ${r.who}`);
      continue;
    }
    const out = await api("POST", "/attendance", {
      token: r.token,
      body: { subject: r.subject, date: r.date, classId: year1.id, sectionId: secAI.id, period: "1", records: register(r.absent) },
    });
    log("attendance", `${r.who}: ${r.subject} on ${r.date} — ${out.present} present, ${out.absent} absent`);
  }

  /* 7. Internal marks — totals deliberately tie, giving ranks 1, 2, 2, 4. */
  const MARKS = [
    { token: pav, who: "Pavithra", subject: "BSUB01", max: 50, scores: [45, 40, 40, 30] },
    { token: pav, who: "Pavithra", subject: "BSUB02", max: 25, scores: [22, 20, 20, 15] },
    { token: roy, who: "Roy", subject: "BSUB03", max: 50, scores: [44, 38, 38, 28] },
  ];
  for (const m of MARKS) {
    if (!m.token) continue;
    const out = await api("POST", "/internal-marks/bulk", {
      token: m.token,
      body: {
        classId: year1.id,
        sectionId: secAI.id,
        subjectId: m.subject,
        exam: "Internal Assessment 1",
        maxMarks: m.max,
        entries: ids.map((id, i) => ({ studentId: id, obtained: m.scores[i], remarks: "" })),
      },
    });
    log("marks", `${m.who}: ${m.subject} Internal Assessment 1 — ${out.entered} entered, ${out.updated} updated`);
  }

  /* 8. One study note — a real PDF, generated here and clearly labelled a sample. */
  if (pav && created.notes.length === 0) {
    const PDFDocument = requireFromBackend("pdfkit");
    const buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.fontSize(18).text("Introduction to C Programming");
      doc.moveDown().fontSize(11).text(
        "DEVELOPMENT SAMPLE — generated by scripts/dev-seed.mjs to test the notes workflow. This is not real course material."
      );
      doc.end();
    });
    const form = new FormData();
    form.append("file", new Blob([buffer], { type: "application/pdf" }), "intro-to-c-sample.pdf");
    const up = await api("POST", "/notes/upload", { token: pav, form });
    const r = await api("POST", "/notes", {
      token: pav,
      body: {
        classId: year1.id,
        sectionId: secAI.id,
        subjectId: "BSUB01",
        courseId: bca.id,
        title: "Introduction to C — sample note",
        description: `Sample note ${DEMO_TAG}`,
        storedName: up.storedName,
        originalName: up.originalName,
      },
    });
    created.notes.push(r.note.id);
    log("notes", `Pavithra uploaded "${r.note.title}" — ${r.notified} student(s) notified`);
  } else if (created.notes.length) {
    log("notes", `sample note already seeded (${created.notes.join(", ")}) — skipped`);
  }

  /* 9. One PENDING leave request, left for the class teacher to decide. */
  if (created.leaveRequests.length === 0) {
    const s3 = students[2];
    const r = await api("POST", "/leave-requests", {
      token: studentTokens[s3.id],
      body: { fromDate: "2026-09-17", toDate: "2026-09-18", reason: "Family function", description: `Sample request ${DEMO_TAG}` },
    });
    created.leaveRequests.push(r.leaveRequest.id);
    log("leave", `${s3.name} requested leave (${r.leaveRequest.id}) — routed to ${r.routedTo}`);
  } else {
    log("leave", `sample leave request already seeded (${created.leaveRequests.join(", ")}) — skipped`);
  }

  /* Manifest: ids only, never passwords — so this data can be found and removed. */
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        note: "Development data created by scripts/dev-seed.mjs. Record ids only — contains no passwords.",
        updatedAt: new Date().toISOString(),
        created,
      },
      null,
      2
    )
  );

  console.log("\nTemporary credentials — each must be changed at first sign-in:");
  credentials.forEach((c) =>
    console.log(`  ${c.role.padEnd(8)} ${String(c.username).padEnd(20)} ${c.password}   ${c.name}`)
  );
  if (process.env.DEV_SEED_CREDENTIALS_OUT) {
    fs.writeFileSync(process.env.DEV_SEED_CREDENTIALS_OUT, JSON.stringify(credentials, null, 2));
    console.log(`\nSaved to ${process.env.DEV_SEED_CREDENTIALS_OUT}`);
  }
  console.log(`\nManifest: ${MANIFEST}\nDone.\n`);
}

main().catch((e) => {
  console.error("\nSEED FAILED:", e.message, e.data ? JSON.stringify(e.data) : "");
  process.exit(1);
});
