/* =========================================================================
   documents.js — private document metadata + authorised download.

   Private files are stored OUTSIDE the statically-served /uploads directory
   (see uploads.js) and are streamed only through GET /:id/file, which checks
   who is asking. A student's SSLC marks card or Aadhaar is therefore not
   reachable by guessing a URL.
   ========================================================================= */
const express = require("express");
const fs = require("fs");
const path = require("path");
const repo = require("../repo");
const { load } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify, linkedChildIds } = require("../services");

const router = express.Router();
router.use(verifyToken);

const { PRIVATE_DIR } = require("../storage");
const fileStore = require("../fileStore");

/** Who may see this document? */
function canRead(doc, user, db) {
  if (user.role === "Admin") return true;
  if (doc.ownerType === "student") {
    if (user.role === "Student") return user.linkedId === doc.ownerId;
    if (user.role === "Parent") return linkedChildIds(user, db).includes(doc.ownerId);
    // Faculty may see a student's academic documents but not identity ones.
    if (user.role === "Faculty") return !["Aadhaar", "ID Proof"].includes(doc.type);
    return false;
  }
  if (doc.ownerType === "faculty") {
    return user.role === "Faculty" && user.linkedId === doc.ownerId;
  }
  // College-wide documents (published timetable, notices) follow their own flag.
  return doc.audience === "all";
}

// GET /api/documents?ownerType=student&ownerId=S2026001
router.get("/", (req, res) => {
  const db = load();
  const { ownerType, ownerId } = req.query;
  let list = repo.findAll("documents");
  if (ownerType) list = list.filter((d) => d.ownerType === ownerType);
  if (ownerId) list = list.filter((d) => d.ownerId === ownerId);

  list = list.filter((d) => canRead(d, req.user, db));
  res.json({
    documents: list
      .map((d) => ({
        id: d.id,
        ownerType: d.ownerType,
        ownerId: d.ownerId,
        type: d.type,
        name: d.name,
        uploadedAt: d.uploadedAt,
        // The storage path is never exposed; the download route is.
        downloadUrl: `/api/documents/${d.id}/file`,
      }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)),
  });
});

// GET /api/documents/:id/file — authorised download.
// The bytes come from the private store (Supabase bucket or local folder);
// either way they are only ever sent after the check below.
router.get("/:id/file", async (req, res) => {
  const db = load();
  const doc = repo.findById("documents", req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  // Same 404 for "not yours" as for "doesn't exist" — never confirm that
  // another student's document id is real.
  if (!canRead(doc, req.user, db)) return res.status(404).json({ error: "Document not found." });
  if (!doc.storedName) return res.status(404).json({ error: "The stored file is missing." });

  try {
    const found = await fileStore.get("private", doc.storedName);
    if (!found) return res.status(404).json({ error: "The stored file is missing." });
    res.setHeader("Content-Type", found.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${(doc.name || doc.storedName).replace(/"/g, "")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(found.buffer);
  } catch (e) {
    console.error("document download failed:", e.message);
    res.status(500).json({ error: "Could not read the document." });
  }
});

// DELETE /api/documents/:id  (Admin)
router.delete("/:id", requireRole("Admin"), async (req, res) => {
  const doc = repo.findById("documents", req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  repo.remove("documents", doc.id);

  if (doc.storedName) {
    try {
      await fileStore.remove("private", doc.storedName);
    } catch (e) {
      console.error("could not delete stored file:", e.message);
    }
  }

  audit(req, {
    action: "document.deleted",
    entityType: "document",
    entityId: doc.id,
    before: doc,
    summary: `Deleted ${doc.type} document for ${doc.ownerType} ${doc.ownerId}`,
  });
  res.json({ ok: true });
});

// POST /api/documents  (Admin) — register an uploaded private file against
// an owner. The upload itself happens at POST /api/uploads/private.
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const b = req.body || {};
  if (!b.storedName || !b.ownerType || !b.ownerId) {
    return res.status(400).json({ error: "ownerType, ownerId and storedName are required." });
  }
  const ownerExists =
    b.ownerType === "student" ? db.students.some((s) => s.id === b.ownerId)
    : b.ownerType === "faculty" ? db.faculty.some((f) => f.id === b.ownerId)
    : true;
  if (!ownerExists) return res.status(404).json({ error: "That owner record does not exist." });

  const doc = repo.insert("documents", {
    id: repo.nextId("documents", "DOC", "document"),
    ownerType: b.ownerType,
    ownerId: b.ownerId,
    type: b.type || "Other",
    name: b.name || b.type || "Document",
    storedName: b.storedName,
    private: true,
    audience: b.audience || "owner",
    uploadedBy: req.user.id,
    uploadedAt: new Date().toISOString(),
  });

  audit(req, {
    action: "document.uploaded",
    entityType: "document",
    entityId: doc.id,
    summary: `Uploaded ${doc.type} for ${doc.ownerType} ${doc.ownerId}`,
  });

  // Tell the owner (and their parent) that a document was filed for them.
  if (doc.ownerType === "student") {
    const targets = db.users.filter(
      (u) =>
        (u.role === "Student" && u.linkedId === doc.ownerId) ||
        (u.role === "Parent" && (u.linkedIds || []).includes(doc.ownerId))
    );
    targets.forEach((u) =>
      notify(u.id, {
        title: "A document was added to your record",
        message: `${doc.type} is now available in your Documents.`,
        type: "document",
        relatedType: "document",
        relatedId: doc.id,
      })
    );
  }

  res.status(201).json({ document: { id: doc.id, type: doc.type, name: doc.name, downloadUrl: `/api/documents/${doc.id}/file` } });
});

module.exports = router;
module.exports.PRIVATE_DIR = PRIVATE_DIR;
