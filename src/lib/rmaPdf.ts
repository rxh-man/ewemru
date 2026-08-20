import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { RmaField, RmaFormDef } from "./rmaForms";
import logoUrl from "@/assets/eand.png";

const A4: [number, number] = [595.28, 841.89];
const M = 32;
const W = A4[0] - M * 2;
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.3, 0.3, 0.3);
const HEAD_BG = rgb(0.93, 0.93, 0.93);
const RED = rgb(0.85, 0.03, 0.07);

export type RmaValues = Record<string, string>;
export type TraceRow = Record<string, string>;

class Doc {
  page!: PDFPage;
  y = 0;
  constructor(
    private pdf: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
    private logo: any,
    private title: string,
    private vendor: string,
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage(A4);
    this.y = A4[1] - M;
    this.header();
  }

  private header() {
    const p = this.page;
    const t = this.title;
    let size = 12.5;
    while (this.bold.widthOfTextAtSize(t, size) > W - 70 && size > 8) size -= 0.25;
    p.drawText(t, { x: M, y: this.y - 11, size, font: this.bold, color: BLACK });
    if (this.logo) {
      const h = 15;
      const w = (this.logo.width / this.logo.height) * h;
      p.drawImage(this.logo, { x: M + W - w, y: this.y - h - 1, width: w, height: h });
    }
    this.y -= 20;
    p.drawLine({
      start: { x: M, y: this.y },
      end: { x: M + W, y: this.y },
      thickness: 1.4,
      color: BLACK,
    });
    this.y -= 11;
    p.drawText(`${this.vendor} · RMA support form`, { x: M, y: this.y, size: 7.5, font: this.font, color: GREY });
    this.y -= 12;
  }

  ensure(h: number) {
    if (this.y - h < M + 14) this.newPage();
  }

  pendingHead: string | null = null;

  sectionHead(title: string) {
    this.pendingHead = title;
  }

  /** Draw the queued section title, keeping it on the same page as its block */
  private flushHead(blockH: number) {
    const title = this.pendingHead;
    if (!title) return;
    this.pendingHead = null;
    this.ensure(24 + Math.min(blockH, A4[1] - M * 2 - 80));
    this.y -= 2;
    this.page.drawText(title.toUpperCase(), { x: M, y: this.y - 8, size: 8.5, font: this.bold, color: BLACK });
    this.y -= 11;
    this.page.drawLine({
      start: { x: M, y: this.y },
      end: { x: M + W, y: this.y },
      thickness: 0.8,
      color: BLACK,
    });
    this.y -= 4;
  }

  fit(text: string, font: PDFFont, size: number, max: number) {
    if (!text) return "";
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let s = text;
    while (s.length > 1 && font.widthOfTextAtSize(s + "...", size) > max) s = s.slice(0, -1);
    return s.trimEnd() + "...";
  }

  /** Word wrap with hard break for long tokens; adds "..." if it overflows maxLines */
  wrap(text: string, font: PDFFont, size: number, max: number, maxLines: number) {
    const raw = (text || "").trim();
    if (!raw) return [];
    const words: string[] = [];
    for (const w of raw.split(/\s+/)) {
      let cur = w;
      while (font.widthOfTextAtSize(cur, size) > max) {
        let cut = cur.length;
        while (cut > 1 && font.widthOfTextAtSize(cur.slice(0, cut), size) > max) cut--;
        words.push(cur.slice(0, cut));
        cur = cur.slice(cut);
      }
      if (cur) words.push(cur);
    }
    const lines: string[] = [];
    let cur = "";
    let idx = 0;
    for (; idx < words.length; idx++) {
      const t = cur ? cur + " " + words[idx] : words[idx];
      if (font.widthOfTextAtSize(t, size) <= max) cur = t;
      else {
        lines.push(cur);
        cur = words[idx];
        if (lines.length === maxLines) break;
      }
    }
    if (lines.length < maxLines && cur) {
      lines.push(cur);
      idx = words.length;
    }
    if (idx < words.length && lines.length) {
      lines[lines.length - 1] = this.fit(lines[lines.length - 1] + " " + words[idx], font, size, max);
    }
    return lines;
  }


  /** Boxed label/value cell */
  cell(x: number, w: number, yTop: number, h: number, label: string, value: string, required?: boolean) {
    const p = this.page;
    p.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: LINE, borderWidth: 0.6 });
    const lbl = this.fit(label + (required ? " *" : ""), this.bold, 6.5, w - 8);
    p.drawText(lbl, { x: x + 4, y: yTop - 9, size: 6.5, font: this.bold, color: required ? RED : GREY });
    const maxLines = Math.max(1, Math.floor((h - 13) / 9.5));
    const lines = this.wrap((value || "").trim(), this.font, 8, w - 8, maxLines);
    lines.forEach((ln, i) => {
      p.drawText(ln, { x: x + 4, y: yTop - 19.5 - i * 9.5, size: 8, font: this.font, color: BLACK });
    });
  }

  /** Lines needed for a value inside a cell of width w */
  private linesNeeded(value: string, w: number) {
    return Math.max(1, this.wrap((value || "").trim(), this.font, 8, w - 8, 6).length || 1);
  }

  grid(fields: RmaField[], values: RmaValues, cols: number) {
    this.flushHead(52);
    const gap = 6;
    const cw = (W - gap * (cols - 1)) / cols;
    let i = 0;
    while (i < fields.length) {
      const row: RmaField[] = [];
      let full = false;
      const f = fields[i];
      if (f.type === "textarea") {
        full = true;
        row.push(f);
        i++;
      } else {
        for (let c = 0; c < cols && i < fields.length && fields[i].type !== "textarea"; c++) row.push(fields[i++]);
      }
      const w = full ? W : cw;
      const needed = Math.max(...row.map((r) => this.linesNeeded(values[r.key], w)), full ? 2 : 1);
      const h = Math.max(23, 14 + needed * 9.5);
      this.ensure(h + 3);
      const top = this.y;
      row.forEach((rf, idx) => {
        this.cell(M + idx * (cw + gap), w, top, h, rf.label, values[rf.key], rf.required);
      });
      this.y -= h + 3;
    }
  }


  table(fields: RmaField[], values: RmaValues, cols: 1 | 2) {
    const gap = 8;
    const colW = cols === 2 ? (W - gap) / 2 : W;
    const headH = 13;
    const per = Math.ceil(fields.length / cols);
    const chunks: RmaField[][] = [];
    for (let c = 0; c < cols; c++) chunks.push(fields.slice(c * per, (c + 1) * per));
    const rows = Math.max(...chunks.map((c) => c.length));
    const labelW = colW * (cols === 2 ? 0.58 : 0.66);
    // pre-compute wrapped content + per-row heights (shared across columns)
    const cellLines: { lbl: string[]; val: string[] }[][] = chunks.map((chunk) =>
      chunk.map((f) => ({
        lbl: this.wrap(f.label, this.font, 7, labelW - 8, 3),
        val: this.wrap((values[f.key] || "").trim(), this.bold, 7, colW - labelW - 8, 5),
      })),
    );
    const rowHs: number[] = [];
    for (let ri = 0; ri < rows; ri++) {
      let ln = 1;
      cellLines.forEach((col) => {
        const c = col[ri];
        if (c) ln = Math.max(ln, c.lbl.length, c.val.length);
      });
      rowHs.push(Math.max(13, 5 + ln * 8.5));
    }
    const total = headH + rowHs.reduce((a, b) => a + b, 0);
    this.flushHead(total);
    this.ensure(total + 6);
    const top = this.y;
    chunks.forEach((chunk, ci) => {
      const x = M + ci * (colW + gap);
      const p = this.page;
      const colHeight = headH + rowHs.slice(0, chunk.length).reduce((a, b) => a + b, 0);
      p.drawRectangle({ x, y: top - headH, width: colW, height: headH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.6 });
      p.drawText("ITEM", { x: x + 4, y: top - headH + 4.5, size: 6.5, font: this.bold, color: BLACK });
      p.drawText("RESULT", { x: x + labelW + 4, y: top - headH + 4.5, size: 6.5, font: this.bold, color: BLACK });
      p.drawLine({ start: { x: x + labelW, y: top }, end: { x: x + labelW, y: top - colHeight }, thickness: 0.6, color: LINE });
      let yTop = top - headH;
      chunk.forEach((f, ri) => {
        const h = rowHs[ri];
        p.drawRectangle({ x, y: yTop - h, width: colW, height: h, borderColor: LINE, borderWidth: 0.6 });
        const { lbl, val } = cellLines[ci][ri];
        lbl.forEach((ln, i) => p.drawText(ln, { x: x + 4, y: yTop - 9 - i * 8.5, size: 7, font: this.font, color: BLACK }));
        val.forEach((ln, i) =>
          p.drawText(ln, { x: x + labelW + 4, y: yTop - 9 - i * 8.5, size: 7, font: this.bold, color: BLACK }),
        );
        yTop -= h;
      });
    });
    this.y = top - total - 4;
  }

  trace(columns: { key: string; label: string; width: number }[], rows: TraceRow[]) {
    const headH = 14;
    const data = rows.filter((r) => columns.some((c) => (r[c.key] || "").trim()));
    const list = data.length ? data : rows.slice(0, 3);
    const wrapped = list.map((r) =>
      columns.map((c) => this.wrap((r[c.key] || "").trim(), this.font, 7, W * c.width - 6, 3)),
    );
    const rowHs = wrapped.map((cells) => Math.max(14, 5 + Math.max(1, ...cells.map((c) => c.length)) * 8.5));
    const total = headH + rowHs.reduce((a, b) => a + b, 0);
    this.flushHead(total);
    this.ensure(total + 6);
    const top = this.y;
    const p = this.page;
    let x = M;
    p.drawRectangle({ x: M, y: top - headH, width: W, height: headH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.6 });
    columns.forEach((c) => {
      const cw = W * c.width;
      p.drawText(this.fit(c.label.toUpperCase(), this.bold, 6.3, cw - 6), {
        x: x + 3,
        y: top - headH + 4.5,
        size: 6.3,
        font: this.bold,
        color: BLACK,
      });
      x += cw;
    });
    let yTop = top - headH;
    wrapped.forEach((cells, ri) => {
      const h = rowHs[ri];
      let cx = M;
      columns.forEach((c, ci) => {
        const cw = W * c.width;
        p.drawRectangle({ x: cx, y: yTop - h, width: cw, height: h, borderColor: LINE, borderWidth: 0.6 });
        cells[ci].forEach((ln, i) =>
          p.drawText(ln, { x: cx + 3, y: yTop - 10 - i * 8.5, size: 7, font: this.font, color: BLACK }),
        );
        cx += cw;
      });
      yTop -= h;
    });
    this.y = top - total - 4;
  }



  notes(items: string[]) {
    this.flushHead(items.length * 10 + 6);
    this.ensure(items.length * 10 + 6);
    items.forEach((it) => {
      const lines = this.wrap(it, this.font, 6.8, W - 12, 2);
      lines.forEach((ln, i) => {
        this.page.drawText((i === 0 ? "•  " : "   ") + ln, {
          x: M,
          y: this.y - 7,
          size: 6.8,
          font: this.font,
          color: BLACK,
        });
        this.y -= 9;
      });
    });
    this.y -= 2;
  }

  signature(preparedBy: string) {
    this.ensure(40);
    const top = this.y - 4;
    const half = (W - 8) / 2;
    this.cell(M, half, top, 28, "Prepared by", preparedBy);
    this.cell(M + half + 8, half, top, 28, "Date of upload", new Date().toLocaleDateString("en-GB"));
    this.y = top - 32;
  }

  footer() {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(`${this.vendor} RMA form · generated ${new Date().toLocaleDateString("en-GB")} · page ${i + 1}/${pages.length}`, {
        x: M,
        y: 18,
        size: 6.2,
        font: this.font,
        color: GREY,
      });
    });
  }
}

async function loadLogo(pdf: PDFDocument) {
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    return await pdf.embedPng(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

export async function buildRmaPdf(def: RmaFormDef, values: RmaValues, traceRows: TraceRow[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await loadLogo(pdf);
  const d = new Doc(pdf, font, bold, logo, def.docTitle, def.vendor);

  for (const sec of def.sections) {
    d.sectionHead(sec.title);
    if (sec.kind === "grid") d.grid(sec.fields, values, sec.cols);
    else if (sec.kind === "table") d.table(sec.fields, values, sec.cols);
    else if (sec.kind === "trace") d.trace(sec.columns, traceRows);
    else d.notes(sec.items);
  }
  d.signature();
  d.footer();

  pdf.setTitle(`${def.vendor} RMA Form`);
  return await pdf.save();
}

export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
