/*
 * Vercel serverless entry point for the whole backend.
 *
 * Vercel routes every request under /api to this file because of the
 * [...path] catch-all name, and it does so through its own file-based
 * routing rather than a rewrite, so req.url arrives exactly as the browser
 * sent it ("/api/auth/login", not a rewritten path). The Express app mounts
 * its routers under /api already, so it matches without any path surgery.
 *
 * The app is required once per instance. backend/server.js only calls
 * listen() when it is the main module, so importing it here starts no
 * server — Vercel owns the socket.
 */
module.exports = require("../backend/server.js");
