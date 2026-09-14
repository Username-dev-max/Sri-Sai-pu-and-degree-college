const express = require("express");
const bcrypt = require("bcryptjs");
const { load, save, seed } = require("../db");
const { signToken, verifyToken } = require("../middleware/auth");

const router = express.Router();

// Ensure seed users have real bcrypt hashes on first boot (plainSeed -> password),
// and that seed accounts added after this data.json was created (e.g. the
// Attendance Staff and Parent roles) are present without needing a DB reset.
function ensureSeedUsers() {
  const db = load();
  let changed = false;

  seed().users.forEach((s) => {
    if (!db.users.some((u) => u.username.toLowerCase() === s.username.toLowerCase())) {
      db.users.push({ ...s });
      db.seq.user = Math.max(db.seq.user || 0, s.id);
      changed = true;
    }
  });

  db.users.forEach((u) => {
    if (!u.password && u.plainSeed) {
      u.password = bcrypt.hashSync(u.plainSeed, 10);
      delete u.plainSeed;
      changed = true;
    }
  });
  if (changed) save(db);
}
ensureSeedUsers();

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  const db = load();
  const user = db.users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid username or password." });
  }
  // A deactivated account must not be able to sign in. Checked here, after
  // the password check, so this response cannot be used to enumerate which
  // usernames exist.
  if (user.status === "Inactive") {
    return res.status(403).json({ error: "This account has been deactivated. Please contact the college office." });
  }

  user.lastLogin = new Date().toISOString();
  save(db);

  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      linkedId: user.linkedId,
      linkedIds: user.linkedIds || (user.linkedId ? [user.linkedId] : []),
      email: user.email,
      mustReset: !!user.mustReset,
    },
  });
});

router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

router.post("/logout", verifyToken, (req, res) => {
  // Stateless JWT: client discards the token. Endpoint kept for a clean API contract / future blacklist support.
  res.json({ ok: true });
});

router.post("/change-password", verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }
  const db = load();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user || !bcrypt.compareSync(currentPassword || "", user.password)) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }
  user.password = bcrypt.hashSync(newPassword, 10);
  user.mustReset = false;
  save(db);
  res.json({ ok: true });
});

module.exports = router;
