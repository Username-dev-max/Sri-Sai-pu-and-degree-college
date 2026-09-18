#!/usr/bin/env node
/* =========================================================================
   migrate-storage-to-supabase.mjs — move uploaded files into Supabase Storage.

     backend/uploads/            -> bucket cms-public   (public by URL, as now)
     backend/private-uploads/    -> bucket cms-private  (never public)
       …/notes/, …/leave/           keep their folder, so the paths already
                                    stored in the database keep working.

   Creates the buckets if they are missing. Safe to re-run: existing objects
   are overwritten with the same content. Local files are NOT deleted.

   Usage:
     node scripts/migrate-storage-to-supabase.mjs
     node scripts/migrate-storage-to-supabase.mjs --verify

   Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (never printed)
   ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HERE, "..");
const require = createRequire(path.join(BACKEND, "package.json"));
const { createClient } = require("@supabase/supabase-js");

const verifyOnly = process.argv.includes("--verify");
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("\nSUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.\n");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : BACKEND;
const PUBLIC_DIR = path.join(DATA_DIR, "uploads");
const PRIVATE_DIR = path.join(DATA_DIR, "private-uploads");
const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "cms-public";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || "cms-private";

const TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".pdf": "application/pdf", ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [{ full, key: path.relative(base, full).split(path.sep).join("/") }];
  });
}

async function ensureBucket(name, isPublic) {
  const { data } = await supabase.storage.listBuckets();
  if ((data || []).some((b) => b.name === name)) {
    console.log(`  bucket ${name}: exists`);
    return;
  }
  if (verifyOnly) {
    console.log(`  bucket ${name}: MISSING`);
    return;
  }
  const { error } = await supabase.storage.createBucket(name, { public: isPublic });
  if (error) throw new Error(`createBucket ${name}: ${error.message}`);
  console.log(`  bucket ${name}: created (${isPublic ? "public" : "private"})`);
}

async function upload(bucket, files) {
  let done = 0;
  let failed = 0;
  for (const f of files) {
    const contentType = TYPES[path.extname(f.key).toLowerCase()] || "application/octet-stream";
    if (verifyOnly) {
      const { data, error } = await supabase.storage.from(bucket).download(f.key);
      if (error || !data) {
        failed += 1;
        console.log(`    MISSING in Supabase: ${f.key}`);
      } else done += 1;
      continue;
    }
    const body = fs.readFileSync(f.full);
    const { error } = await supabase.storage.from(bucket).upload(f.key, body, { contentType, upsert: true });
    if (error) {
      failed += 1;
      console.log(`    FAILED ${f.key}: ${error.message}`);
    } else done += 1;
  }
  return { done, failed };
}

async function main() {
  console.log("\nSupabase Storage migration");
  console.log(`  Project URL : ${URL}`);
  console.log(`  Mode        : ${verifyOnly ? "verify only" : "upload + verify"}\n`);

  await ensureBucket(PUBLIC_BUCKET, true);
  await ensureBucket(PRIVATE_BUCKET, false);

  const publicFiles = walk(PUBLIC_DIR);
  const privateFiles = walk(PRIVATE_DIR);
  console.log(`\n  ${PUBLIC_DIR}: ${publicFiles.length} file(s)`);
  console.log(`  ${PRIVATE_DIR}: ${privateFiles.length} file(s)\n`);

  const pub = await upload(PUBLIC_BUCKET, publicFiles);
  const priv = await upload(PRIVATE_BUCKET, privateFiles);

  console.log("\nBucket        | Local | In Supabase | Failed");
  console.log("--------------|-------|-------------|-------");
  console.log(`${PUBLIC_BUCKET.padEnd(13)} | ${String(publicFiles.length).padStart(5)} | ${String(pub.done).padStart(11)} | ${String(pub.failed).padStart(6)}`);
  console.log(`${PRIVATE_BUCKET.padEnd(13)} | ${String(privateFiles.length).padStart(5)} | ${String(priv.done).padStart(11)} | ${String(priv.failed).padStart(6)}`);

  console.log("\nPrivate files stay in a private bucket: they are served only by the API routes");
  console.log("that check who is asking. Local files were not deleted.\n");
  if (pub.failed || priv.failed) process.exit(1);
}

main().catch((e) => {
  console.error("\nSTORAGE MIGRATION FAILED:", e.message, "\n");
  process.exit(1);
});
