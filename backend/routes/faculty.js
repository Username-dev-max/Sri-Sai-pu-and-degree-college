const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { createUserAccount, resetUserCredentials } = require("../utils");

const router = express.Router();
router.use(verifyToken);

/** Fields only an Admin may ever see on a faculty record. */
const ADMIN_ONLY_FIELDS = ["salary"];

/** What a Student, Parent or Attendance Staff member may see of a faculty
 *  record — the same directory-level fields the public site shows. Personal
 *  contact details are staff-only. */
const DIRECTORY_FIELDS = ["id", "name", "department", "designation", "qualification", "experience", "photoUrl"];

/**
 * Project a faculty record for the caller.
 *  - Admin: everything.
 *  - Faculty: their OWN record in full (they are entitled to their own
 *    salary); a colleague's without salary, contact details kept so staff
 *    can reach one another.
 *  - Everyone else: directory fields only. GET /:id previously had no role
 *    guard, so a Student could read any faculty member's phone and email.
 */
function projectFaculty(fac, user) {
  if (user.role === "Admin") return fac;
  if (user.role === "Faculty") {
    if (user.linkedId === fac.id) return fac;
    const out = { ...fac };
    ADMIN_ONLY_FIELDS.forEach((f) => delete out[f]);
    return out;
  }
  return Object.fromEntries(DIRECTORY_FIELDS.filter((k) => k in fac).map((k) => [k, fac[k]]));
}

router.get("/", requireRole("Admin", "Faculty"), (req, res) => {
  const db = load();
  const { q, department } = req.query;
  let list = db.faculty;
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((f) => f.name.toLowerCase().includes(s) || f.id.toLowerCase().includes(s) || f.email.toLowerCase().includes(s));
  }
  if (department) list = list.filter((f) => f.department === department);
  res.json({ faculty: list.map((f) => projectFaculty(f, req.user)) });
});

router.get("/:id", (req, res) => {
  const db = load();
  const fac = db.faculty.find((f) => f.id === req.params.id);
  if (!fac) return res.status(404).json({ error: "Faculty not found." });
  res.json({ faculty: projectFaculty(fac, req.user) });
});

// POST /api/faculty  (Admin only) — Enroll a new faculty member with a linked login.
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  const required = ["name", "department", "designation"];
  for (const f of required) {
    if (!b[f]) return res.status(400).json({ error: `Field '${f}' is required.` });
  }
  if (b.email) {
    if (!/^\S+@\S+\.\S+$/.test(b.email)) return res.status(400).json({ error: "Invalid email address." });
    if (db.faculty.some((f) => f.email && f.email.toLowerCase() === b.email.toLowerCase())) {
      return res.status(409).json({ error: "A faculty member with this email already exists." });
    }
  }
  db.seq.faculty = (db.seq.faculty || 0) + 1;
  const facId = `F${String(db.seq.faculty).padStart(3, "0")}`;
  const faculty = {
    id: facId, name: b.name, email: b.email || "", phone: b.phone || "", department: b.department,
    designation: b.designation, qualification: b.qualification || "", experience: b.experience || "",
  };
  db.faculty.push(faculty);
  const { user, plainPassword } = createUserAccount(db, { name: b.name, role: "Faculty", linkedId: facId, email: b.email });
  save(db);
  res.status(201).json({
    faculty,
    credentials: { username: user.username, password: plainPassword, role: "Faculty" },
  });
});

// POST /api/faculty/:id/reset-credentials  (Admin only) — issue a fresh
// random password for the faculty member's linked login account.
router.post("/:id/reset-credentials", requireRole("Admin"), (req, res) => {
  const db = load();
  const fac = db.faculty.find((f) => f.id === req.params.id);
  if (!fac) return res.status(404).json({ error: "Faculty not found." });
  const result = resetUserCredentials(db, fac.id);
  if (!result) return res.status(404).json({ error: "No linked login account found for this faculty member." });
  save(db);
  res.json({ credentials: { username: result.user.username, password: result.plainPassword, role: "Faculty" } });
});

router.put("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const fac = db.faculty.find((f) => f.id === req.params.id);
  if (!fac) return res.status(404).json({ error: "Faculty not found." });
  const editable = ["name", "email", "phone", "department", "designation", "qualification", "experience"];
  editable.forEach((f) => { if (req.body[f] !== undefined) fac[f] = req.body[f]; });
  save(db);
  res.json({ faculty: fac });
});

router.delete("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const idx = db.faculty.findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Faculty not found." });
  db.faculty.splice(idx, 1);
  db.users = db.users.filter((u) => u.linkedId !== req.params.id);
  save(db);
  res.json({ ok: true });
});

module.exports = router;
