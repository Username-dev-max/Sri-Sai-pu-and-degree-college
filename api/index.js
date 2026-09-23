/*
 * Vercel serverless entry point for the whole backend.
 *
 * Routing
 *   The catch-all filename api/[...path].js was deployed as a SINGLE-segment
 *   route: /api/health reached it but /api/auth/login returned 404. Rather
 *   than depend on how a platform interprets bracket filenames, vercel.json
 *   now rewrites every /api/* request here and carries the original path in
 *   a __path query parameter. The path therefore survives the rewrite no
 *   matter what the platform does to req.url, and this file puts it back
 *   before Express sees the request, so the routers mounted under /api match
 *   exactly as they do locally.
 *
 * Startup failures
 *   backend/server.js throws while loading if a required variable is missing
 *   (JWT_SECRET in production, for instance). An uncaught throw here becomes
 *   an opaque FUNCTION_INVOCATION_FAILED with nothing to act on, so the
 *   failure is captured and returned as JSON naming the cause. Only the
 *   message is sent: these are configuration errors, never secrets.
 */
let app = null;
let loadError = null;

try {
  app = require("../backend/server.js");
} catch (e) {
  loadError = e;
  console.error("API FAILED TO LOAD:", e && e.stack ? e.stack : e);
}

module.exports = function handler(req, res) {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "The API failed to start.",
        reason: String((loadError && loadError.message) || loadError),
        hint: "Check the Vercel project environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, NODE_ENV.",
      })
    );
    return;
  }

  // Put the original path back, then hand over to Express untouched.
  try {
    const parsed = new URL(req.url, "http://localhost");
    const original = parsed.searchParams.get("__path");
    if (original) {
      parsed.searchParams.delete("__path");
      const rest = parsed.searchParams.toString();
      req.url = original + (rest ? "?" + rest : "");
    }
  } catch {
    /* leave req.url as it arrived */
  }

  app(req, res);
};
