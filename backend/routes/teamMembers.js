/* =========================================================================
   teamMembers.js — the people in each project team.

   This replaces the generic CRUD router that used to serve this collection.
   It needs rules the generic one has no place for: a team has a size limit,
   a member must belong to a team that exists, and the fields that end up on
   a public hiring page should be checked before they get there.
   ========================================================================= */
const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit } = require("../services");

const router = express.Router();
router.use(verifyToken);

/** A team is a project group, not a department. Thirty is the agreed cap. */
const MAX_PER_TEAM = 30;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const blank = (v) => v === undefined || v === null || String(v).trim() === "";

function nextId(db) {
  const n = (db.teamMembers || []).reduce((max, m) => {
    const num = parseInt(String(m.id || "").replace(/\D/g, ""), 10) || 0;
    return num > max ? num : max;
  }, 0);
  return `MEM${String(n + 1).padStart(3, "0")}`;
}

/**
 * Check a submitted member. `existing` is passed when editing, so a field
 * left out of the request keeps the value it already had.
 */
function validate(db, body, existing = null) {
  const pick = (key) => (body[key] !== undefined ? body[key] : existing ? existing[key] : "");

  const name = String(pick("name") || "").trim();
  if (!name) return { error: "A name is required." };
  if (name.length > 80) return { error: "That name is too long." };

  const team = String(pick("team") || "").trim();
  if (!team) return { error: "Choose a team." };
  if (!db.teams.some((t) => t.id === team)) return { error: "That team does not exist." };

  // The cap counts everyone already in the team, except this member when it
  // is being edited, so saving an existing member never trips its own limit.
  const inTeam = (db.teamMembers || []).filter((m) => m.team === team && (!existing || m.id !== existing.id));
  if (inTeam.length >= MAX_PER_TEAM) {
    return { error: `That team already has ${MAX_PER_TEAM} members, which is the limit.` };
  }

  const email = String(pick("email") || "").trim();
  if (email && !EMAIL.test(email)) return { error: "That email address does not look right." };

  const department = String(pick("department") || "").trim();
  if (department && !db.departments.some((d) => d.id === department || d.name === department)) {
    return { error: "Select a department from the list." };
  }

  const year = String(pick("year") || "").trim();
  if (year.length > 30) return { error: "That year is too long." };

  return {
    value: {
      team,
      name,
      email,
      department,
      year,
      role: String(pick("role") || "").trim(),
      photoUrl: String(pick("photoUrl") || "").trim(),
      resumeUrl: String(pick("resumeUrl") || "").trim(),
      resumeName: String(pick("resumeName") || "").trim(),
    },
  };
}

// GET /api/team-members — everyone, optionally narrowed to one team.
router.get("/", (req, res) => {
  const db = load();
  const { team } = req.query;
  let list = db.teamMembers || [];
  if (team) list = list.filter((m) => m.team === team);
  res.json({
    teamMembers: list,
    maxPerTeam: MAX_PER_TEAM,
    counts: db.teams.reduce((acc, t) => {
      acc[t.id] = (db.teamMembers || []).filter((m) => m.team === t.id).length;
      return acc;
    }, {}),
  });
});

router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const v = validate(db, req.body || {});
  if (v.error) return res.status(400).json({ error: v.error });

  const member = { id: nextId(db), ...v.value, createdAt: new Date().toISOString() };
  db.teamMembers.push(member);
  save(db);
  audit(req, {
    action: "team_member.created",
    entityType: "teamMember",
    entityId: member.id,
    summary: `Added ${member.name} to ${(db.teams.find((t) => t.id === member.team) || {}).name || member.team}`,
  });
  res.status(201).json({ item: member });
});

router.put("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const member = (db.teamMembers || []).find((m) => m.id === req.params.id);
  if (!member) return res.status(404).json({ error: "That member was not found." });

  const v = validate(db, req.body || {}, member);
  if (v.error) return res.status(400).json({ error: v.error });

  Object.assign(member, v.value, { updatedAt: new Date().toISOString() });
  save(db);
  audit(req, {
    action: "team_member.updated",
    entityType: "teamMember",
    entityId: member.id,
    summary: `Updated ${member.name}`,
  });
  res.json({ item: member });
});

router.delete("/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const i = (db.teamMembers || []).findIndex((m) => m.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "That member was not found." });
  const [gone] = db.teamMembers.splice(i, 1);
  save(db);
  audit(req, {
    action: "team_member.deleted",
    entityType: "teamMember",
    entityId: gone.id,
    summary: `Removed ${gone.name}`,
  });
  res.json({ ok: true });
});

module.exports = router;
module.exports.MAX_PER_TEAM = MAX_PER_TEAM;
