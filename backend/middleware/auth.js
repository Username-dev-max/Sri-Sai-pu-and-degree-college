const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "cms-dev-secret-change-in-production";

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      linkedId: user.linkedId,
      // Parents may be linked to several children; carried in the token so
      // scoping checks never have to trust a client-supplied id.
      linkedIds: user.linkedIds || (user.linkedId ? [user.linkedId] : []),
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authentication token." });

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  // Tokens live for 8 hours, so the claims alone are not enough: an account
  // deactivated (or deleted) mid-session must lose access on its very next
  // request rather than when the token happens to expire. Required lazily to
  // avoid a require cycle between db.js and this middleware.
  const { load } = require("../db");
  const account = load().users.find((u) => u.id === claims.id);
  if (!account) {
    return res.status(401).json({ error: "This account no longer exists. Please log in again." });
  }
  if (account.status === "Inactive") {
    return res.status(403).json({ error: "This account has been deactivated. Please contact the college office." });
  }

  // Trust the stored record over the token for anything authorisation
  // depends on, so a role or link change takes effect without re-login.
  req.user = {
    ...claims,
    role: account.role,
    linkedId: account.linkedId,
    linkedIds: account.linkedIds || (account.linkedId ? [account.linkedId] : []),
  };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You are not authorized to perform this action." });
    }
    next();
  };
}

module.exports = { signToken, verifyToken, requireRole, JWT_SECRET };
