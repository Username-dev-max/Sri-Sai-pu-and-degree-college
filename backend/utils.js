const bcrypt = require("bcryptjs");

function slugifyName(name) {
  return name.trim().toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
}

function generateUsername(name, existingUsernames) {
  const parts = slugifyName(name);
  let base = parts.length >= 2 ? `${parts[0]}.${parts[parts.length - 1]}` : (parts[0] || "user");
  let candidate = base;
  let i = 1;
  while (existingUsernames.includes(candidate)) {
    candidate = `${base}${i}`;
    i += 1;
  }
  return candidate;
}

const PW_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function generatePassword(length = 10) {
  let pw = "";
  for (let i = 0; i < length; i += 1) {
    pw += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
  }
  return pw;
}

function createUserAccount(db, { name, role, linkedId, email }) {
  const username = generateUsername(name, db.users.map((u) => u.username));
  const plainPassword = generatePassword(10);
  db.seq.user = (db.seq.user || 0) + 1;
  const user = {
    id: db.seq.user,
    username,
    password: bcrypt.hashSync(plainPassword, 10),
    role,
    name,
    linkedId,
    email,
    mustReset: true,
  };
  db.users.push(user);
  return { user, plainPassword };
}

function resetUserCredentials(db, linkedId) {
  const user = db.users.find((u) => u.linkedId === linkedId);
  if (!user) return null;
  const plainPassword = generatePassword(10);
  user.password = bcrypt.hashSync(plainPassword, 10);
  user.mustReset = true;
  return { user, plainPassword };
}

function gradeFor(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  return "F";
}

module.exports = { generateUsername, generatePassword, createUserAccount, resetUserCredentials, gradeFor };
