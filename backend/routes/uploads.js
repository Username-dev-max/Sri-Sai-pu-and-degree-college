/* =========================================================================
   uploads.js — receiving uploaded files.

   Two surfaces, unchanged in behaviour:
     POST /api/uploads          public images (gallery, team photos,
                                announcement attachments) -> returns a URL
     POST /api/uploads/private  student documents and official PDFs ->
                                returns an opaque storedName, never a URL

   Where the bytes go is decided by fileStore: Supabase Storage when it is
   configured, the local folders otherwise. Files are held in memory only for
   the moment it takes to hand them to the store, so nothing depends on a
   writable local disk in production.
   ========================================================================= */
const express = require("express");
const multer = require("multer");
const path = require("path");
const { verifyToken, requireRole } = require("../middleware/auth");
const fileStore = require("../fileStore");

const router = express.Router();
router.use(verifyToken, requireRole("Admin"));

const IMAGE_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const DOC_TYPES = { ...IMAGE_TYPES, ".pdf": "application/pdf" };
delete DOC_TYPES[".gif"];

const uniqueName = (prefix, originalName) =>
  `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(originalName).toLowerCase()}`;

function uploader(allowed, limitMb, message) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limitMb * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      allowed[path.extname(file.originalname).toLowerCase()] ? cb(null, true) : cb(new Error(message)),
  }).single("file");
}

const publicUpload = uploader(IMAGE_TYPES, 8, "Only image files (png, jpg, jpeg, webp, gif) are allowed.");
const privateUpload = uploader(DOC_TYPES, 12, "Only PDF or image documents are allowed.");

// POST /api/uploads — a public image.
router.post("/", (req, res) => {
  publicUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    try {
      const name = uniqueName("img", req.file.originalname);
      await fileStore.put("public", name, req.file.buffer, req.file.mimetype);
      res.status(201).json({ url: fileStore.publicUrl(name), storedName: name });
    } catch (e) {
      console.error("public upload failed:", e.message);
      res.status(500).json({ error: "Could not store the file." });
    }
  });
});

/*
 * POST /api/uploads/resume — a resume that has to be publicly downloadable.
 *
 * This is deliberately separate from the private document route. A resume on
 * the hiring pages is meant to be opened by someone who is not signed in, so
 * it goes to the public bucket and gets a real URL. That also means it is
 * readable by anyone who has the link, which is the point, but it is why it
 * is its own route rather than a quiet widening of the image upload: the
 * choice to publish somebody personal details should be explicit.
 */
const resumeUpload = uploader({ ".pdf": "application/pdf" }, 6, "A resume must be a PDF, no larger than 6 MB.");

router.post("/resume", (req, res) => {
  resumeUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    try {
      const name = uniqueName("resume", req.file.originalname);
      await fileStore.put("public", name, req.file.buffer, "application/pdf");
      res.status(201).json({
        url: fileStore.publicUrl(name),
        storedName: name,
        originalName: req.file.originalname,
        bytes: req.file.size,
      });
    } catch (e) {
      console.error("resume upload failed:", e.message);
      res.status(500).json({ error: "Could not store the resume." });
    }
  });
});

/* ------------------------------------------------------------------------
   Private uploads — student documents, official PDFs.

   These never get a public URL. The only way to retrieve one is through a
   route that checks the caller's identity first (see routes/documents.js).
   The returned `storedName` is an opaque handle.
   ------------------------------------------------------------------------ */
router.post("/private", (req, res) => {
  privateUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    try {
      const name = uniqueName("doc", req.file.originalname);
      await fileStore.put("private", name, req.file.buffer, req.file.mimetype);
      res.status(201).json({ storedName: name, originalName: req.file.originalname, size: req.file.size });
    } catch (e) {
      console.error("private upload failed:", e.message);
      res.status(500).json({ error: "Could not store the file." });
    }
  });
});

module.exports = router;
