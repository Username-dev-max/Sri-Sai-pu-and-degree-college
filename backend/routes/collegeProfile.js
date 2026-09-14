const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken, requireRole("Admin"));

const FIELDS = [
  "name", "shortName", "tagline", "description", "establishedYear",
  "principalName", "principalTitle", "address", "phone", "email",
  "website", "vision", "mission", "social",
];

router.get("/", (req, res) => {
  const db = load();
  res.json({ profile: db.collegeProfile });
});

router.put("/", (req, res) => {
  const db = load();
  const body = req.body || {};
  for (const key of FIELDS) {
    if (key in body) db.collegeProfile[key] = body[key];
  }
  save(db);
  res.json({ profile: db.collegeProfile });
});

module.exports = router;
