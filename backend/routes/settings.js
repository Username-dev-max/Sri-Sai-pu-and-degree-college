/* =========================================================================
   settings.js — the college's academic policy (attendance and marks).

   Read by every signed-in user, because students and parents need to know,
   for example, which attendance threshold applies to them. Only an Admin can
   change it, and every change is audited with its before/after values.
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit } = require("../services");
const { getSettings, validateSettings } = require("../academics");

const router = express.Router();
router.use(verifyToken);

// GET /api/settings/academic
router.get("/academic", (req, res) => {
  const s = getSettings(load());
  if (req.user.role === "Student" || req.user.role === "Parent") {
    // Staff permission switches are not the family's business.
    return res.json({
      settings: {
        attendance: { lowThreshold: s.attendance.lowThreshold, leaveInDenominator: s.attendance.leaveInDenominator },
        marks: { passPercentage: s.marks.passPercentage, gradeScale: s.marks.gradeScale },
      },
    });
  }
  res.json({ settings: s });
});

// PUT /api/settings/academic  (Admin) — body: { attendance?: {...}, marks?: {...} }
router.put("/academic", requireRole("Admin"), (req, res) => {
  const db = load();
  const body = req.body || {};
  const ALLOWED = {
    attendance: ["lowThreshold", "leaveInDenominator", "periodsPerDay", "staffCanMark", "staffCanEdit", "facultyCanEdit"],
    marks: ["passPercentage", "facultyCanPublish", "staffCanView", "gradeScale", "examTypes"],
  };
  const patch = {};
  for (const section of Object.keys(ALLOWED)) {
    if (!body[section]) continue;
    patch[section] = {};
    for (const key of ALLOWED[section]) {
      if (body[section][key] !== undefined) patch[section][key] = body[section][key];
    }
  }
  const problem = validateSettings(patch);
  if (problem) return res.status(400).json({ error: problem });

  const before = getSettings(db);
  db.settings = db.settings || {};
  for (const section of Object.keys(patch)) {
    db.settings[section] = { ...(db.settings[section] || {}), ...patch[section] };
    if (patch[section].gradeScale) {
      db.settings[section].gradeScale = patch[section].gradeScale
        .map((b) => ({ min: b.min, grade: String(b.grade).trim() }))
        .sort((a, b) => b.min - a.min);
    }
    if (patch[section].examTypes) {
      db.settings[section].examTypes = [...new Set(patch[section].examTypes.map((t) => String(t).trim()))];
    }
  }
  save(db);
  const after = getSettings(db);

  audit(req, {
    action: "settings.academic_updated",
    entityType: "settings",
    entityId: "academic",
    before,
    after,
    summary: "Updated attendance and marks policy",
  });
  res.json({ settings: after });
});

module.exports = router;
