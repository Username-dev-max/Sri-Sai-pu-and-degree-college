/* =========================================================================
   exporters/tableReport.js — generic A4 tabular reports as PDF, DOCX and CSV.

   Used by the attendance reports and the student / subject / exam marks
   reports. It renders exactly the rows it is given; it never computes or
   fills in values of its own.

   input: {
     college, title, subtitle?, meta: [[label, value]],
     columns: [{ key, label, align?: "left"|"center"|"right", weight?: number }],
     rows: [{ [key]: value }],
     notes?: [string], signatures?: [string], generatedBy?, filename
   }
   ========================================================================= */
const PDFDocument = require("pdfkit");
const docx = require("docx");

const NAVY = "#14213d";
const GOLD = "#c99a3b";
const MUTED = "#475569";

const text = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));
const stamp = () => new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function safeFileName(name, ext) {
  const base = String(name || "report").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "report";
  return `${base}.${ext}`;
}

function toCsv(columns, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))];
  // Byte-order mark so Excel opens UTF-8 names correctly.
  return "﻿" + lines.join("\r\n");
}

function renderTablePdf(input) {
  return new Promise((resolve, reject) => {
    try {
      const { columns, rows } = input;
      const landscape = columns.length > 7;
      const doc = new PDFDocument({
        size: "A4",
        layout: landscape ? "landscape" : "portrait",
        margin: 36,
        bufferPages: true,
        info: { Title: `${input.college || ""} — ${input.title}`, Author: input.college || "" },
      });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () =>
        resolve({ buffer: Buffer.concat(chunks), filename: safeFileName(input.filename || input.title, "pdf"), contentType: "application/pdf" })
      );
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 22;

      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(16).text(input.college || "", left, 36, { width, align: "center" });
      doc.moveDown(0.1);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(NAVY).text(input.title, { width, align: "center" });
      if (input.subtitle) doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(input.subtitle, { width, align: "center" });
      doc.moveDown(0.4);
      let y = doc.y;
      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.1).strokeColor(GOLD).stroke();
      y += 8;

      // Meta strip, up to five pairs per line.
      const meta = input.meta || [];
      for (let i = 0; i < meta.length; i += 5) {
        const chunk = meta.slice(i, i + 5);
        const w = width / 5;
        chunk.forEach(([k, v], j) => {
          const x = left + j * w;
          doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(String(k).toUpperCase(), x, y, { width: w - 6 });
          doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text(text(v), x, y + 10, { width: w - 6, height: 12, ellipsis: true });
        });
        y += 28;
      }
      y += 4;

      const totalWeight = columns.reduce((a, c) => a + (c.weight || 1), 0);
      const widths = columns.map((c) => (width * (c.weight || 1)) / totalWeight);
      const headerH = 24;
      const rowH = 18;
      const drawHeader = (top) => {
        doc.rect(left, top, width, headerH).fill(NAVY);
        let x = left;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
        columns.forEach((c, i) => {
          doc.text(c.label, x + 3, top + 4, { width: widths[i] - 6, height: headerH - 5, align: c.align || "left", ellipsis: true });
          x += widths[i];
        });
        return top + headerH;
      };

      y = drawHeader(y);
      if (rows.length === 0) {
        doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("No records.", left, y + 6, { width });
        y += 24;
      }
      rows.forEach((r, idx) => {
        if (y + rowH > bottomLimit()) {
          doc.addPage();
          y = drawHeader(doc.page.margins.top);
        }
        if (idx % 2 === 1) doc.rect(left, y, width, rowH).fill("#f1f5f9");
        let x = left;
        doc.font(r.__bold ? "Helvetica-Bold" : "Helvetica").fontSize(8).fillColor(NAVY);
        columns.forEach((c, i) => {
          doc.text(text(r[c.key]), x + 3, y + 5, { width: widths[i] - 6, height: 10, align: c.align || "left", ellipsis: true });
          x += widths[i];
        });
        doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.4).strokeColor("#cbd5e1").stroke();
        y += rowH;
      });

      y += 10;
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      (input.notes || []).forEach((n) => {
        if (y + 22 > bottomLimit()) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        doc.text(n, left, y, { width });
        y = doc.y + 3;
      });

      const sigs = input.signatures || [];
      if (sigs.length) {
        let sigY = Math.max(y + 44, bottomLimit() - 28);
        if (sigY + 18 > bottomLimit()) {
          doc.addPage();
          sigY = bottomLimit() - 28;
        }
        const sw = width / sigs.length;
        sigs.forEach((label, i) => {
          const sx = left + i * sw + 14;
          doc.moveTo(sx, sigY).lineTo(sx + sw - 28, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
          doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label, sx, sigY + 4, { width: sw - 28, align: "center" });
        });
      }

      const range = doc.bufferedPageRange();
      const generated = `Generated ${stamp()}${input.generatedBy ? ` by ${input.generatedBy}` : ""}`;
      for (let p = range.start; p < range.start + range.count; p += 1) {
        doc.switchToPage(p);
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const fy = doc.page.height - bottom + 10;
        doc.font("Helvetica").fontSize(7).fillColor("#94a3b8");
        doc.text(`${generated} · ${input.college || ""}`, left, fy, { width: width * 0.72, lineBreak: false });
        doc.text(`Page ${p - range.start + 1} of ${range.count}`, left, fy, { width, align: "right", lineBreak: false });
        doc.page.margins.bottom = bottom;
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function renderTableDocx(input) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ShadingType } = docx;
  const { columns, rows } = input;
  const landscape = columns.length > 7;
  const A4 = { w: 11906, h: 16838 };
  const size = landscape
    ? { width: A4.h, height: A4.w, ...(docx.PageOrientation ? { orientation: docx.PageOrientation.LANDSCAPE } : {}) }
    : { width: A4.w, height: A4.h };
  const align = (a) => (a === "center" ? AlignmentType.CENTER : a === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT);
  const run = (t, o = {}) => new TextRun({ text: String(t ?? ""), font: "Calibri", size: o.size || 17, bold: !!o.bold, color: o.color || "14213D" });
  const para = (t, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.LEFT, spacing: { after: o.after ?? 0 }, children: [run(t, o)] });
  const line = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cell = (t, o = {}) =>
    new TableCell({
      borders: { top: line, bottom: line, left: line, right: line },
      ...(o.fill ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: o.fill } } : {}),
      margins: { top: 50, bottom: 50, left: 70, right: 70 },
      children: [para(t, o)],
    });

  const header = new TableRow({
    tableHeader: true,
    children: columns.map((c) => cell(c.label, { fill: "14213D", color: "FFFFFF", bold: true, size: 16, align: align(c.align) })),
  });
  const body = rows.length
    ? rows.map(
        (r, i) =>
          new TableRow({
            children: columns.map((c) => cell(text(r[c.key]), { align: align(c.align), bold: !!r.__bold, fill: i % 2 ? "F1F5F9" : undefined })),
          })
      )
    : [new TableRow({ children: [new TableCell({ columnSpan: columns.length, children: [para("No records.")] })] })];

  const metaRows = [];
  const meta = input.meta || [];
  for (let i = 0; i < meta.length; i += 5) {
    const chunk = meta.slice(i, i + 5);
    metaRows.push(
      new TableRow({
        children: chunk.map(
          ([k, v]) =>
            new TableCell({
              borders: { top: none, bottom: none, left: none, right: none },
              children: [para(String(k).toUpperCase(), { size: 13, color: "64748B" }), para(text(v), { bold: true, size: 17 })],
            })
        ),
      })
    );
  }

  const children = [
    para(input.college || "", { align: AlignmentType.CENTER, bold: true, size: 30, after: 40 }),
    para(input.title, { align: AlignmentType.CENTER, bold: true, size: 22, after: input.subtitle ? 20 : 160 }),
  ];
  if (input.subtitle) children.push(para(input.subtitle, { align: AlignmentType.CENTER, size: 18, color: "475569", after: 160 }));
  if (metaRows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: metaRows }));
  children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body] }));
  children.push(new Paragraph({ spacing: { after: 140 }, children: [] }));
  (input.notes || []).forEach((n) => children.push(para(n, { size: 15, color: "475569", after: 50 })));
  if ((input.signatures || []).length) {
    children.push(new Paragraph({ spacing: { after: 800 }, children: [] }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: input.signatures.map(
              (label) =>
                new TableCell({
                  borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" }, bottom: none, left: none, right: none },
                  margins: { top: 50, left: 220, right: 220 },
                  children: [para(label, { align: AlignmentType.CENTER, size: 15, color: "475569" })],
                })
            ),
          }),
        ],
      })
    );
  }
  children.push(
    new Paragraph({
      spacing: { before: 260 },
      children: [run(`Generated ${stamp()}${input.generatedBy ? ` by ${input.generatedBy}` : ""}`, { size: 13, color: "94A3B8" })],
    })
  );

  const document = new Document({
    creator: input.college || "College Management System",
    title: `${input.college || ""} — ${input.title}`,
    sections: [{ properties: { page: { size, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
  const buffer = await Packer.toBuffer(document);
  return {
    buffer,
    filename: safeFileName(input.filename || input.title, "docx"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

/** Send a report in the requested format. Returns true when it handled the response. */
async function sendReport(res, format, input) {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName(input.filename || input.title, "csv")}"`);
    res.send(toCsv(input.columns, input.rows));
    return true;
  }
  if (format === "pdf" || format === "docx") {
    const out = format === "pdf" ? await renderTablePdf(input) : await renderTableDocx(input);
    res.setHeader("Content-Type", out.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${out.filename}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(out.buffer);
    return true;
  }
  return false;
}

module.exports = { renderTablePdf, renderTableDocx, toCsv, sendReport };
