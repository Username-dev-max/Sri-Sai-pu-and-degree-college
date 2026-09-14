const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

/**
 * Builds a router with GET/POST/PUT/DELETE for a top-level array in db.json.
 * @param {string} collection  key in the db (e.g. "departments")
 * @param {string} idPrefix    prefix used when generating new ids
 * @param {string[]} writeRoles roles allowed to create/update/delete
 * @param {string[]} readRoles  roles allowed to read (default: any authenticated user)
 */
function genericCrud(collection, idPrefix, writeRoles = ["Admin"], readRoles = null) {
  const router = express.Router();
  router.use(verifyToken);

  router.get("/", (req, res) => {
    if (readRoles && !readRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized." });
    }
    const db = load();
    res.json({ [collection]: db[collection] });
  });

  router.post("/", requireRole(...writeRoles), (req, res) => {
    const db = load();
    const body = { ...req.body };
    if (!body.id) {
      const n = (db[collection].length ? Math.max(...db[collection].map((x) => parseInt((x.id || "0").replace(/\D/g, ""), 10) || 0)) : 0) + 1;
      body.id = `${idPrefix}${String(n).padStart(2, "0")}`;
    }
    if (db[collection].some((x) => x.id === body.id)) {
      return res.status(409).json({ error: "An item with this ID already exists." });
    }
    db[collection].push(body);
    save(db);
    res.status(201).json({ item: body });
  });

  router.put("/:id", requireRole(...writeRoles), (req, res) => {
    const db = load();
    const item = db[collection].find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: "Item not found." });
    Object.assign(item, req.body);
    save(db);
    res.json({ item });
  });

  router.delete("/:id", requireRole(...writeRoles), (req, res) => {
    const db = load();
    const idx = db[collection].findIndex((x) => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Item not found." });
    db[collection].splice(idx, 1);
    save(db);
    res.json({ ok: true });
  });

  return router;
}

module.exports = genericCrud;
