/**
 * Display helpers for values that may still be unfilled.
 *
 * Some records carry editorial placeholders rather than real information —
 * two faculty members were entered with "[VERIFY]" for designation,
 * qualification and experience because those details were never supplied.
 * That shorthand is for whoever maintains the data, not for visitors, so it
 * must never be printed on a public page.
 *
 * A value counts as missing when it is empty, or when it is wrapped in
 * square brackets (the convention used throughout the seed data for "this
 * still needs to be filled in"). Nothing is invented as a substitute: the
 * caller decides what to show instead, defaulting to an em dash.
 */
const PLACEHOLDER = /^\s*\[[^\]]*\]\s*$/;

export function isMissing(value) {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === "" || PLACEHOLDER.test(s);
}

export function publicText(value, fallback = "—") {
  return isMissing(value) ? fallback : String(value);
}

export default publicText;
