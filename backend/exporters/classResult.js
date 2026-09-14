/* =========================================================================
   exporters/classResult.js — A4 class result documents, as PDF and DOCX.

   Renders ONLY what internalMarks.buildSummary() computed from real marks.
   A student with no marks for the exam is listed as "not entered" — never
   given a zero or an invented score.

   Layout: portrait A4 for up to four subjects, landscape beyond that, so the
   subject columns stay readable instead of being squeezed illegible.
   ========================================================================= */
const PDFDocument = require("pdfkit");
const docx = require("docx");

const NAVY = "#14213d";
const GOLD = "#c99a3b";
const MUTED = "#475569";

function safeFilePart(s) {
  return String(s || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "class";
}

function fileName(summary, ext) {
  const section = summary.sectionName ? `-${safeFilePart(summary.sectionName)}` : "";
  return `class-result-${safeFilePart(summary.className)}${section}-${safeFilePart(summary.exam)}.${ext}`;
}

function metaPairs(s) {
  return [
    ["Academic Year", s.academicYearLabel || "—"],
    ["Course", s.courseName || "—"],
    ["Class", s.className || "—"],
    ["Section", s.sectionName || "Whole class"],
    ["Exam", s.exam || "—"],
  ];
}

/** A subject cell. A dash means that subject's mark was not entered. */
function cellMark(row, subjectId) {
  const m = row.marks[subjectId];
  return m ? `${m.obtained}/${m.maxMarks}` : "—";
}

function footnotes(summary) {
  const notes = [
    `Students ranked: ${summary.performanceList.length}. Class average: ${summary.stats.average ?? "—"}%. Pass mark: ${summary.passPercent}%.`,
    "Equal percentages share a rank and the next rank is skipped (1, 2, 2, 4). A dash means that mark was not entered.",
  ];
  if (summary.notEntered.length) {
    notes.push(
      `Marks not entered for this exam, so not ranked: ${summary.notEntered.map((n) => n.studentName).join(", ")}.`
    );
  }
  return notes;
}

const stamp = () => new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

/* ---------------------------------- PDF ---------------------------------- */

function renderPdf(summary) {
  return new Promise((resolve, reject) => {
    try {
      const landscape = summary.subjects.length > 4;
      const doc = new PDFDocument({
        size: "A4",
        layout: landscape ? "landscape" : "portrait",
        margin: 40,
        bufferPages: true, // needed to write "Page x of y" once the count is known
        info: { Title: `${summary.college} — Class Result`, Author: summary.college },
      });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () =>
        resolve({ buffer: Buffer.concat(chunks), filename: fileName(summary, "pdf"), contentType: "application/pdf" })
      );
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      // Room kept clear at the bottom of every page for the footer.
      const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 24;

      /* header */
      doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(17).text(summary.college || "Class Result", left, 40, {
        width,
        align: "center",
      });
      doc.moveDown(0.15);
      doc.font("Helvetica").fontSize(11).fillColor(MUTED).text("Class Result Statement", { width, align: "center" });
      doc.moveDown(0.5);
      const ruleY = doc.y;
      doc.moveTo(left, ruleY).lineTo(left + width, ruleY).lineWidth(1.2).strokeColor(GOLD).stroke();

      /* meta strip */
      const pairs = metaPairs(summary);
      const metaW = width / pairs.length;
      const metaY = ruleY + 10;
      pairs.forEach(([k, v], i) => {
        const x = left + i * metaW;
        doc.font("Helvetica").fontSize(7.5).fillColor("#64748b").text(k.toUpperCase(), x, metaY, { width: metaW - 6 });
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(NAVY).text(v, x, metaY + 11, {
          width: metaW - 6,
          height: 12,
          ellipsis: true,
        });
      });

      /* columns */
      const subjW = landscape ? 62 : 58;
      const cols = [
        { key: "rank", label: "Rank", w: 36, align: "center" },
        { key: "admission", label: "Student ID", w: landscape ? 96 : 86 },
        { key: "name", label: "Student Name", w: 0 }, // takes the remaining width
        ...summary.subjects.map((s) => ({ key: "subject", label: s.name, w: subjW, align: "center", subjectId: s.id })),
        { key: "total", label: "Total", w: 58, align: "center" },
        { key: "pct", label: "%", w: 44, align: "center" },
      ];
      const nameCol = cols.find((c) => c.key === "name");
      const others = cols.reduce((a, c) => a + c.w, 0);
      nameCol.w = Math.max(96, width - others);
      // If the name column hit its floor, shrink the subject columns to fit.
      const overflow = cols.reduce((a, c) => a + c.w, 0) - width;
      if (overflow > 0) {
        const subjectCols = cols.filter((c) => c.key === "subject");
        const cut = overflow / Math.max(1, subjectCols.length);
        subjectCols.forEach((c) => {
          c.w = Math.max(36, c.w - cut);
        });
      }

      const headerH = 28;
      const rowH = 20;
      const drawHeader = (y) => {
        doc.rect(left, y, width, headerH).fill(NAVY);
        let x = left;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
        cols.forEach((c) => {
          doc.text(c.label, x + 4, y + 5, { width: c.w - 8, height: headerH - 6, align: c.align || "left", ellipsis: true });
          x += c.w;
        });
        return y + headerH;
      };
      const valueFor = (row, c) => {
        if (c.key === "rank") return String(row.rank);
        if (c.key === "admission") return row.admissionNumber || row.studentId;
        if (c.key === "name") return row.studentName;
        if (c.key === "total") return `${row.total}/${row.maxMarks}`;
        if (c.key === "pct") return String(row.percentage);
        return cellMark(row, c.subjectId);
      };

      /* table */
      let y = drawHeader(metaY + 36);
      summary.performanceList.forEach((row, i) => {
        if (y + rowH > bottomLimit()) {
          doc.addPage();
          y = drawHeader(doc.page.margins.top); // repeat the header on every page
        }
        if (i % 2 === 1) doc.rect(left, y, width, rowH).fill("#f1f5f9");
        let x = left;
        doc.font(row.rank <= 3 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(NAVY);
        cols.forEach((c) => {
          doc.text(valueFor(row, c), x + 4, y + 6, { width: c.w - 8, height: 11, align: c.align || "left", ellipsis: true });
          x += c.w;
        });
        doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.4).strokeColor("#cbd5e1").stroke();
        y += rowH;
      });

      /* notes */
      y += 12;
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED);
      footnotes(summary).forEach((n) => {
        if (y + 24 > bottomLimit()) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        doc.text(n, left, y, { width });
        y = doc.y + 3;
      });

      /* signatures, on the final page */
      let sigY = Math.max(y + 48, bottomLimit() - 30);
      if (sigY + 20 > bottomLimit()) {
        doc.addPage();
        sigY = bottomLimit() - 30;
      }
      const sigs = ["Class Teacher", "Head of Department", "Principal"];
      const sw = width / sigs.length;
      sigs.forEach((label, i) => {
        const sx = left + i * sw + 16;
        doc.moveTo(sx, sigY).lineTo(sx + sw - 32, sigY).lineWidth(0.8).strokeColor("#94a3b8").stroke();
        doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(label, sx, sigY + 5, { width: sw - 32, align: "center" });
      });

      /* footer on every page */
      const range = doc.bufferedPageRange();
      const generated = `Generated ${stamp()}${summary.generatedBy ? ` by ${summary.generatedBy}` : ""}`;
      for (let p = range.start; p < range.start + range.count; p += 1) {
        doc.switchToPage(p);
        // Text below the bottom margin makes pdfkit open a new page, so the
        // margin is lifted while the footer is written, then restored.
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const fy = doc.page.height - bottom + 12;
        doc.font("Helvetica").fontSize(7.5).fillColor("#94a3b8");
        doc.text(`${generated} · ${summary.college}`, left, fy, { width: width * 0.72, lineBreak: false });
        doc.text(`Page ${p - range.start + 1} of ${range.count}`, left, fy, { width, align: "right", lineBreak: false });
        doc.page.margins.bottom = bottom;
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/* ---------------------------------- DOCX --------------------------------- */

async function renderDocx(summary) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, AlignmentType, BorderStyle, ShadingType,
  } = docx;

  const landscape = summary.subjects.length > 4;
  // A4 in twentieths of a point.
  const A4 = { w: 11906, h: 16838 };
  const size = landscape
    ? { width: A4.h, height: A4.w, ...(docx.PageOrientation ? { orientation: docx.PageOrientation.LANDSCAPE } : {}) }
    : { width: A4.w, height: A4.h };

  const run = (text, o = {}) =>
    new TextRun({ text: String(text ?? ""), font: "Calibri", size: o.size || 18, bold: !!o.bold, color: o.color || "14213D" });
  const para = (text, o = {}) =>
    new Paragraph({ alignment: o.align || AlignmentType.LEFT, spacing: { after: o.after ?? 0 }, children: [run(text, o)] });

  const line = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cell = (text, o = {}) =>
    new TableCell({
      borders: { top: line, bottom: line, left: line, right: line },
      ...(o.fill ? { shading: { type: ShadingType.CLEAR, color: "auto", fill: o.fill } } : {}),
      margins: { top: 60, bottom: 60, left: 80, right: 80 },
      children: [para(text, { align: o.align, bold: o.bold, color: o.color, size: o.size })],
    });

  const headings = ["Rank", "Student ID", "Student Name", ...summary.subjects.map((s) => s.name), "Total", "%"];
  const headerRow = new TableRow({
    tableHeader: true, // repeats on every page in Word
    children: headings.map((h, i) =>
      cell(h, { fill: "14213D", color: "FFFFFF", bold: true, size: 17, align: i === 2 ? AlignmentType.LEFT : AlignmentType.CENTER })
    ),
  });

  const bodyRows = summary.performanceList.map((r, idx) => {
    const fill = idx % 2 ? "F1F5F9" : undefined;
    const top = r.rank <= 3;
    return new TableRow({
      children: [
        cell(r.rank, { align: AlignmentType.CENTER, bold: top, fill }),
        cell(r.admissionNumber || r.studentId, { fill }),
        cell(r.studentName, { bold: top, fill }),
        ...summary.subjects.map((s) => cell(cellMark(r, s.id), { align: AlignmentType.CENTER, fill })),
        cell(`${r.total}/${r.maxMarks}`, { align: AlignmentType.CENTER, bold: true, fill }),
        cell(r.percentage, { align: AlignmentType.CENTER, bold: true, fill }),
      ],
    });
  });

  const metaRow = new TableRow({
    children: metaPairs(summary).map(
      ([k, v]) =>
        new TableCell({
          borders: { top: none, bottom: none, left: none, right: none },
          children: [para(k.toUpperCase(), { size: 14, color: "64748B" }), para(v, { bold: true, size: 18 })],
        })
    ),
  });

  const signatureRow = new TableRow({
    children: ["Class Teacher", "Head of Department", "Principal"].map(
      (label) =>
        new TableCell({
          borders: { top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" }, bottom: none, left: none, right: none },
          margins: { top: 60, left: 240, right: 240 },
          children: [para(label, { align: AlignmentType.CENTER, size: 16, color: "475569" })],
        })
    ),
  });

  const spacer = (after) => new Paragraph({ spacing: { after }, children: [] });

  const document = new Document({
    creator: summary.college || "College Management System",
    title: `${summary.college} — Class Result`,
    sections: [
      {
        properties: { page: { size, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: [
          para(summary.college || "Class Result", { align: AlignmentType.CENTER, bold: true, size: 32, after: 60 }),
          para("Class Result Statement", { align: AlignmentType.CENTER, size: 20, color: "475569", after: 200 }),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [metaRow] }),
          spacer(200),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...bodyRows] }),
          spacer(160),
          ...footnotes(summary).map((n) => para(n, { size: 16, color: "475569", after: 60 })),
          spacer(900),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [signatureRow] }),
          new Paragraph({
            spacing: { before: 300 },
            children: [
              run(`Generated ${stamp()}${summary.generatedBy ? ` by ${summary.generatedBy}` : ""}`, { size: 14, color: "94A3B8" }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return {
    buffer,
    filename: fileName(summary, "docx"),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

module.exports = { renderPdf, renderDocx };
