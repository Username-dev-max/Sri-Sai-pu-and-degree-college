/* =========================================================================
   search.js — Admin global search + audit log viewer.
   Both are Admin-only: the search reaches across every directory in the
   system, and the audit trail names who did what.
   ========================================================================= */
const express = require("express");
const repo = require("../repo");
const { load } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken, requireRole("Admin"));

const norm = (v) => String(v || "").toLowerCase();

// GET /api/admin/search?q=&type=&page=&pageSize=
// type: all | students | faculty | parents | staff
router.get("/search", (req, res) => {
  const db = load();
  const q = norm(req.query.q).trim();
  const type = req.query.type || "all";
  if (!q) return res.json({ results: [], total: 0, page: 1, pages: 1, pageSize: 25, query: "" });

  const hit = (...fields) => fields.some((f) => norm(f).includes(q));
  const deptName = (id) => (db.departments.find((d) => d.id === id) || {}).name || "";
  const courseName = (id) => (db.courses.find((c) => c.id === id) || {}).name || "";
  const results = [];

  if (type === "all" || type === "students") {
    db.students
      .filter((s) => hit(s.name, s.id, s.admissionNumber, s.email, s.phone, s.rollNumber, courseName(s.course), deptName(s.department)))
      .forEach((s) =>
        results.push({
          type: "student",
          id: s.id,
          title: s.name,
          subtitle: [s.id, courseName(s.course), deptName(s.department)].filter(Boolean).join(" · "),
          meta: { status: s.status, email: s.email, phone: s.phone },
          href: `/admin/students?focus=${s.id}`,
        })
      );
  }

  if (type === "all" || type === "faculty") {
    db.faculty
      .filter((f) => hit(f.name, f.id, f.email, f.phone, f.designation, deptName(f.department)))
      .forEach((f) =>
        results.push({
          type: "faculty",
          id: f.id,
          title: f.name,
          subtitle: [f.id, f.designation, deptName(f.department)].filter(Boolean).join(" · "),
          meta: { status: f.status || "Active", email: f.email, phone: f.phone },
          href: `/admin/faculty?focus=${f.id}`,
        })
      );
  }

  if (type === "all" || type === "parents" || type === "staff") {
    const roles =
      type === "parents" ? ["Parent"] : type === "staff" ? ["Attendance Staff"] : ["Parent", "Attendance Staff", "Admin"];
    db.users
      .filter((u) => roles.includes(u.role))
      .filter((u) => hit(u.name, u.username, u.email, u.linkedId))
      .forEach((u) => {
        const children = (u.linkedIds || (u.linkedId ? [u.linkedId] : []))
          .map((id) => (db.students.find((s) => s.id === id) || {}).name)
          .filter(Boolean);
        results.push({
          type: u.role === "Parent" ? "parent" : u.role === "Admin" ? "admin" : "staff",
          id: u.id,
          title: u.name || u.username,
          subtitle: [u.username, children.length ? `Child: ${children.join(", ")}` : ""].filter(Boolean).join(" · "),
          meta: { status: u.status || "Active", email: u.email, role: u.role },
          href: `/admin/users?focus=${u.id}`,
        });
      });
  }

  results.sort((a, b) => {
    // Exact-ish matches first, then alphabetical.
    const ax = norm(a.title).startsWith(q) ? 0 : 1;
    const bx = norm(b.title).startsWith(q) ? 0 : 1;
    return ax !== bx ? ax - bx : a.title.localeCompare(b.title);
  });

  const paged = repo.paginate(results, { page: req.query.page, pageSize: req.query.pageSize });
  res.json({ ...paged, results: paged.rows, query: req.query.q });
});

// GET /api/admin/audit?action=&entityType=&actorId=&from=&to=&page=
router.get("/audit", (req, res) => {
  const { action, entityType, actorId, from, to, q } = req.query;
  let list = repo.findAll("auditLogs");

  if (action) list = list.filter((l) => l.action === action);
  if (entityType) list = list.filter((l) => l.entityType === entityType);
  if (actorId) list = list.filter((l) => String(l.actorId) === String(actorId));
  if (from) list = list.filter((l) => l.at >= from);
  if (to) list = list.filter((l) => l.at <= `${to}T23:59:59.999Z`);
  if (q) {
    const s = norm(q);
    list = list.filter((l) => norm(l.summary).includes(s) || norm(l.actorName).includes(s) || norm(l.entityId).includes(s));
  }

  list.sort((a, b) => new Date(b.at) - new Date(a.at));
  const paged = repo.paginate(list, { page: req.query.page, pageSize: req.query.pageSize || 40 });
  res.json({
    ...paged,
    logs: paged.rows,
    // Distinct values so the UI can build its filter dropdowns from real data.
    actions: [...new Set(repo.findAll("auditLogs").map((l) => l.action))].sort(),
    entityTypes: [...new Set(repo.findAll("auditLogs").map((l) => l.entityType))].sort(),
  });
});

module.exports = router;
