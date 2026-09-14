const express = require("express");
const { load, save } = require("../db");
const repo = require("../repo");
const { verifyToken, requireRole } = require("../middleware/auth");
const { audit, notify } = require("../services");

const router = express.Router();
router.use(verifyToken);

/** Everyone who should hear about a student's fee activity. */
function feeAudience(db, studentId) {
  return db.users.filter(
    (u) =>
      (u.role === "Student" && u.linkedId === studentId) ||
      (u.role === "Parent" && (u.linkedIds || [u.linkedId]).includes(studentId))
  );
}

/** Recompute a fee's paid total and status from its payments. */
function recalc(db, fee) {
  const paid = db.payments
    .filter((p) => p.student === fee.student)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  fee.paid = paid;
  fee.status = paid >= fee.total ? "Paid" : paid > 0 ? "Partially Paid" : "Pending";
  return fee;
}

router.get("/", requireRole("Admin"), (req, res) => {
  const db = load();
  res.json({ fees: db.fees });
});

// GET /api/fees/:studentId  (Admin, or the student themself)
router.get("/:studentId", (req, res) => {
  const db = load();
  // Fees are financial: Faculty never see them, so this checks the account's
  // own link rather than the broader teaching scope.
  const linked =
    req.user.role === "Parent"
      ? (req.user.linkedIds?.length ? req.user.linkedIds : [req.user.linkedId]).includes(req.params.studentId)
      : req.user.linkedId === req.params.studentId;
  const allowed = req.user.role === "Admin" || ((req.user.role === "Student" || req.user.role === "Parent") && linked);
  if (!allowed) return res.status(403).json({ error: "Not authorized." });
  const fee = db.fees.find((f) => f.student === req.params.studentId);
  if (!fee) return res.status(404).json({ error: "No fee record found for this student." });
  const payments = db.payments.filter((p) => p.student === req.params.studentId);
  const installments = (db.feeInstallments || [])
    .filter((i) => i.studentId === req.params.studentId)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const receipts = (db.receipts || [])
    .filter((r) => r.studentId === req.params.studentId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  res.json({ fee, payments, installments, receipts });
});

// POST /api/fees/:studentId/installments  (Admin) — split a fee into
// scheduled installments.
router.post("/:studentId/installments", requireRole("Admin"), (req, res) => {
  const db = load();
  const fee = db.fees.find((f) => f.student === req.params.studentId);
  if (!fee) return res.status(404).json({ error: "No fee record found for this student." });

  const b = req.body || {};
  const amount = Number(b.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Installment amount must be a positive number." });

  const scheduled = (db.feeInstallments || [])
    .filter((i) => i.studentId === req.params.studentId)
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  if (scheduled + amount > fee.total) {
    return res.status(400).json({
      error: `Scheduling ₹${amount} would exceed the total fee. ₹${fee.total - scheduled} is still unscheduled.`,
    });
  }

  const row = {
    id: repo.nextId("feeInstallments", "INS", "installment"),
    studentId: req.params.studentId,
    label: b.label || `Installment ${(db.feeInstallments || []).filter((i) => i.studentId === req.params.studentId).length + 1}`,
    amount,
    dueDate: b.dueDate || "",
    status: "Pending",
    createdAt: new Date().toISOString(),
  };
  db.feeInstallments.push(row);
  save(db);

  audit(req, {
    action: "fee.installment_added",
    entityType: "fee",
    entityId: fee.id,
    after: row,
    summary: `Scheduled ${row.label} of ₹${amount} for ${req.params.studentId}`,
  });
  feeAudience(db, req.params.studentId).forEach((u) =>
    notify(u.id, {
      title: "Fee installment scheduled",
      message: `${row.label}: ₹${amount}${row.dueDate ? ` due ${row.dueDate}` : ""}.`,
      type: "info",
      relatedType: "fee",
      relatedId: fee.id,
    })
  );

  res.status(201).json({ installment: row });
});

// DELETE /api/fees/installments/:id  (Admin)
router.delete("/installments/:id", requireRole("Admin"), (req, res) => {
  const db = load();
  const i = (db.feeInstallments || []).findIndex((x) => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Installment not found." });
  const row = db.feeInstallments[i];
  if (row.status === "Paid") {
    return res.status(409).json({ error: "A paid installment cannot be deleted." });
  }
  db.feeInstallments.splice(i, 1);
  save(db);
  audit(req, {
    action: "fee.installment_deleted",
    entityType: "fee",
    entityId: row.studentId,
    before: row,
    summary: `Removed ${row.label} for ${row.studentId}`,
  });
  res.json({ ok: true });
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
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const paymentId = `PAY-${Date.now()}`;
  const seq = db.payments.filter((p) => p.student === req.params.studentId).length + 1;
  const receiptNo = `RCPT-${req.params.studentId}-${String(seq).padStart(3, "0")}`;

  const payment = { id: paymentId, student: req.params.studentId, amount, date, mode, receipt: receiptNo };
  db.payments.push(payment);

  // Settle the oldest unpaid installment(s) this payment covers, so the
  // schedule reflects reality rather than drifting from the payment ledger.
  let remaining = amount;
  const due = (db.feeInstallments || [])
    .filter((i) => i.studentId === req.params.studentId && i.status !== "Paid")
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const settled = [];
  for (const inst of due) {
    if (remaining <= 0) break;
    if (remaining >= Number(inst.amount)) {
      remaining -= Number(inst.amount);
      inst.status = "Paid";
      inst.paidOn = date;
      inst.receiptNo = receiptNo;
      settled.push(inst.label);
    }
  }

  // A receipt is a permanent record in its own right, not just a number on a
  // payment — students and parents can list and reprint these.
  const receipt = {
    id: repo.nextId("receipts", "RCP", "receipt"),
    receiptNo,
    studentId: req.params.studentId,
    paymentId,
    amount,
    mode,
    date,
    towards: settled.length ? settled.join(", ") : "Fee payment",
    issuedBy: req.user.id,
    issuedByName: req.user.name || "College Office",
    issuedAt: new Date().toISOString(),
  };
  db.receipts.push(receipt);

  recalc(db, fee);
  save(db);

  audit(req, {
    action: "fee.payment_recorded",
    entityType: "fee",
    entityId: fee.id,
    after: { amount, mode, receiptNo },
    summary: `Recorded ₹${amount} from ${req.params.studentId} (${receiptNo})`,
  });
  feeAudience(db, req.params.studentId).forEach((u) =>
    notify(u.id, {
      title: "Payment received",
      message: `₹${amount} received. Receipt ${receiptNo} is available to download.`,
      type: "info",
      relatedType: "receipt",
      relatedId: receipt.id,
    })
  );

  res.status(201).json({ payment, fee, receipt });
});

// GET /api/fees/receipts/:id — one receipt, for printing.
router.get("/receipts/:id", (req, res) => {
  const db = load();
  const receipt = (db.receipts || []).find((r) => r.id === req.params.id || r.receiptNo === req.params.id);
  if (!receipt) return res.status(404).json({ error: "Receipt not found." });

  const linked =
    req.user.role === "Parent"
      ? (req.user.linkedIds?.length ? req.user.linkedIds : [req.user.linkedId]).includes(receipt.studentId)
      : req.user.linkedId === receipt.studentId;
  if (req.user.role !== "Admin" && !linked) {
    return res.status(404).json({ error: "Receipt not found." });
  }

  const student = db.students.find((s) => s.id === receipt.studentId) || {};
  res.json({
    receipt: {
      ...receipt,
      studentName: student.name || receipt.studentId,
      admissionNumber: student.admissionNumber || "",
      college: db.collegeProfile?.name || "",
      collegeAddress: db.collegeProfile?.address || "",
    },
  });
});

module.exports = router;
