/* =========================================================================
   fileStore.js — where uploaded files live.

   One interface, two backends:
     Supabase Storage  when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set
     the local disk    otherwise (development, unchanged behaviour)

   Buckets
     cms-public    college images, gallery, team photos, announcement
                   attachments. Readable by anyone with the URL, exactly as
                   /uploads/<file> is today.
     cms-private   student documents, notes, leave documents, timetable PDFs.
                   NOT public. Files are streamed to the browser only by the
                   existing routes, after they have checked who is asking.

   The private bucket is never made public and no signed URL is handed out by
   default, so a leaked object path still cannot be opened by a stranger.
   ========================================================================= */
const fs = require("fs");
const path = require("path");
const { getClient, isEnabled } = require("./supabase");
const { UPLOAD_DIR, PRIVATE_DIR, ensureDir } = require("./storage");

const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "cms-public";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || "cms-private";

const bucketFor = (visibility) => (visibility === "public" ? PUBLIC_BUCKET : PRIVATE_BUCKET);
const localDirFor = (visibility) => (visibility === "public" ? UPLOAD_DIR : PRIVATE_DIR);

/** Reject anything that tries to climb out of its folder. */
function safeName(name) {
  const base = String(name || "").replace(/\\/g, "/");
  if (base.includes("..") || path.isAbsolute(base)) throw new Error("Invalid file name.");
  return base.replace(/^\/+/, "");
}

/**
 * Store a file.
 * @param visibility "public" | "private"
 * @param name       object name, may contain a folder ("notes/abc.pdf")
 */
async function put(visibility, name, buffer, contentType) {
  const key = safeName(name);
  if (isEnabled()) {
    const { error } = await getClient()
      .storage.from(bucketFor(visibility))
      .upload(key, buffer, { contentType: contentType || "application/octet-stream", upsert: true });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    return { key, storage: "supabase" };
  }
  const dir = localDirFor(visibility);
  const full = path.join(dir, key);
  ensureDir(path.dirname(full));
  fs.writeFileSync(full, buffer);
  return { key, storage: "local" };
}

/** Read a file back. Returns { buffer, contentType } or null when missing. */
async function get(visibility, name) {
  const key = safeName(name);
  if (isEnabled()) {
    const { data, error } = await getClient().storage.from(bucketFor(visibility)).download(key);
    if (error || !data) return null;
    return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
  }
  const full = path.join(localDirFor(visibility), key);
  if (!full.startsWith(localDirFor(visibility)) || !fs.existsSync(full)) return null;
  return { buffer: fs.readFileSync(full), contentType: "application/octet-stream" };
}

/** Remove a file. Missing files are not an error. */
async function remove(visibility, name) {
  const key = safeName(name);
  if (isEnabled()) {
    const { error } = await getClient().storage.from(bucketFor(visibility)).remove([key]);
    return !error;
  }
  const full = path.join(localDirFor(visibility), key);
  if (full.startsWith(localDirFor(visibility)) && fs.existsSync(full)) {
    fs.unlinkSync(full);
    return true;
  }
  return false;
}

/**
 * The URL a browser should use for a PUBLIC file. Private files deliberately
 * have none — they are only ever streamed by an authorising route.
 */
function publicUrl(name) {
  const key = safeName(name);
  if (isEnabled()) {
    const { data } = getClient().storage.from(PUBLIC_BUCKET).getPublicUrl(key);
    return data.publicUrl;
  }
  return `/uploads/${key}`;
}

/** Does this object exist? Used by the migration verification. */
async function exists(visibility, name) {
  return (await get(visibility, name)) !== null;
}

module.exports = { put, get, remove, publicUrl, exists, PUBLIC_BUCKET, PRIVATE_BUCKET, bucketFor };
