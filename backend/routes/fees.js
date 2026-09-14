const express = require("express");
const { load, save } = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(verifyToken);

router.get("/", requireRole("Admin"), (req, res) => {
  const db = load();
  res.json({ fees: db.fees });
});

// GET /api/fees/:studentId  (Admin, or the student themself)
router.get("/:studentId", (req, res) => {
  const allowed =
    req.user.role === "Admin" ||
    ((req.user.role === "Student" || req.user.role === "Parent") && req.user.linkedId === req.params.studentId);
  if (!allowed) return res.status(403).json({ error: "Not authorized." });
  const db = load();
  const fee = db.fees.find((f) => f.student === req.params.studentId);
  if (!fee) return res.status(404).json({ error: "No fee record found for this student." });
  const payments = db.payments.filter((p) => p.student === req.params.studentId);
  res.json({ fee, payments });
});

// POST /api/fees  (Admin) — create a fee structure record for a student
router.post("/", requireRole("Admin"), (req, res) => {
  const db = load();
  const { student, total, dueDate } = req.body || {};
  if (!student || total === undefined) return res.status(400).json({ error: "student and total are required." });
  if (Number(total) < 0) return res.status(400).json({ error: "Total fee cannot be negative." });
  if (db.fees.some((f) => f.student === student)) return res.status(409).json({ error: "Fee record already exists for this student." });
  const fee = { id: `FEE-${student}`, student, total: Number(total), paid: 0, status: "Pending", dueDate: dueDate || "" };
  db.fees.push(fee);
  save(db);
  res.status(201).json({ fee });
});

// POST /api/fees/:studentId/payments  (Admin) — record a payment
router.post("/:studentId/payments", requireRole("Admin"), (req, res) => {
  const db = load();
  const fee = db.fees.find((f) => f.student === req.params.studentId);
  if (!fee) return res.status(404).json({ error: "No fee record found for this student." });
  const amount = Number(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Payment amount must be a positive number." });
  if (fee.paid + amount > fee.total) return res.status(400).json({ error: "Payment exceeds the pending balance." });
  const mode = req.body.mode || "Cash";
  const paymentId = `PAY-${Date.now()}`;
  const receipt = `RCPT-${req.params.studentId}-${db.payments.filter((p) => p.student === req.params.studentId).length + 1}`;
  const payment = { id: paymentId, student: req.params.studentId, amount, date: new Date().toISOString().slice(0, 10), mode, receipt };
  db.payments.push(payment);
  fee.paid += amount;
  fee.status = fee.paid >= fee.total ? "Paid" : fee.paid > 0 ? "Partially Paid" : "Pending";
  save(db);
  res.status(201).json({ payment, fee });
});

module.exports = router;
