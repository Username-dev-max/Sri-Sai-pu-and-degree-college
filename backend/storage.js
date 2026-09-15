/* =========================================================================
   storage.js — where the backend keeps its runtime data on disk.

   Everything the app writes lives under one data directory:
     data.json          the JSON database
     uploads/           public uploads (gallery, team photos, attachments)
     private-uploads/   private files (student documents, notes, leave docs)

   DATA_DIR defaults to the backend folder, which is exactly where these
   files have always been, so local development is unchanged. On a host with
   a mounted persistent volume, point DATA_DIR at that volume so the database
   and uploads survive redeploys.
   ========================================================================= */
const path = require("path");

const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : __dirname;

/**
 * Create a storage directory if it is missing. On a read-only filesystem
 * (serverless hosts) this logs instead of throwing, so the process still
 * starts and the failure surfaces clearly on the first write rather than as
 * an unexplained crash of every route at startup.
 */
function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error(`storage: cannot create ${dir} (${e.code || e.message}). Is DATA_DIR on a writable, persistent disk?`);
  }
}

module.exports = {
  ensureDir,
  DATA_DIR,
  DB_PATH: path.join(DATA_DIR, "data.json"),
  UPLOAD_DIR: path.join(DATA_DIR, "uploads"),
  PRIVATE_DIR: path.join(DATA_DIR, "private-uploads"),
};
