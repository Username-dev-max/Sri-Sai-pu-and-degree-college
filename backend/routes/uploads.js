const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { verifyToken, requireRole } = require("../middleware/auth");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) return cb(new Error("Only image files (png, jpg, jpeg, webp, gif) are allowed."));
    cb(null, true);
  },
});

const router = express.Router();
router.use(verifyToken, requireRole("Admin"));

router.post("/", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  });
});

/* ------------------------------------------------------------------------
   Private uploads — student documents, official PDFs.

   These land in a directory that is NOT served by express.static, so the
   only way to retrieve one is GET /api/documents/:id/file, which checks the
   caller's identity first. The returned `storedName` is an opaque handle,
   not a URL.
   ------------------------------------------------------------------------ */
const PRIVATE_DIR = path.join(__dirname, "..", "private-uploads");
if (!fs.existsSync(PRIVATE_DIR)) fs.mkdirSync(PRIVATE_DIR, { recursive: true });

const PRIVATE_ALLOWED = new Set([".png", ".jpg", ".jpeg", ".webp", ".pdf"]);
const privateUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRIVATE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!PRIVATE_ALLOWED.has(ext)) return cb(new Error("Only PDF or image documents are allowed."));
    cb(null, true);
  },
});

router.post("/private", (req, res) => {
  privateUpload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No file uploaded." });
    res.status(201).json({
      storedName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  });
});

module.exports = router;
