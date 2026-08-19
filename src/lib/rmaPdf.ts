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
      const h = 20;
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

  sectionHead(title: string) {
    this.ensure(24);
    this.y -= 4;
    this.page.drawText(title.toUpperCase(), { x: M, y: this.y - 8, size: 8.5, font: this.bold, color: BLACK });
    this.y -= 11;
    this.page.drawLine({
      start: { x: M, y: this.y },
      end: { x: M + W, y: this.y },
      thickness: 0.8,
      color: BLACK,
    });
    this.y -= 5;
  }

  fit(text: string, font: PDFFont, size: number, max: number) {
    if (!text) return "";
    if (font.widthOfTextAtSize(text, size) <= max) return text;
    let s = text;
    while (s.length > 1 && font.widthOfTextAtSize(s + "…", size) > max) s = s.slice(0, -1);
    return s + "…";
  }

  wrap(text: string, font: PDFFont, size: number, max: number, maxLines: number) {
    const words = (text || "").split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(t, size) <= max) cur = t;
      else {
        if (cur) lines.push(cur);
        cur = w;
        if (lines.length === maxLines) break;
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines) lines[maxLines - 1] = this.fit(lines[maxLines - 1], font, size, max);
    return lines;
  }

  /** Boxed label/value cell */
  cell(x: number, w: number, yTop: number, h: number, label: string, value: string, required?: boolean) {
    const p = this.page;
    p.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: LINE, borderWidth: 0.6 });
    const lbl = this.fit(label + (required ? " *" : ""), this.bold, 6.5, w - 8);
    p.drawText(lbl, { x: x + 4, y: yTop - 9, size: 6.5, font: this.bold, color: required ? RED : GREY });
    const lines = this.wrap(value || "—", this.font, 8, w - 8, Math.max(1, Math.floor((h - 14) / 10)));
    lines.forEach((ln, i) => {
      p.drawText(ln, { x: x + 4, y: yTop - 20 - i * 9.5, size: 8, font: this.font, color: BLACK });
    });
  }

  grid(fields: RmaField[], values: RmaValues, cols: number) {
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
      const h = full ? 46 : row.some((r) => (values[r.key] || "").length > 34) ? 34 : 26;
      this.ensure(h + 4);
      const top = this.y;
      row.forEach((rf, idx) => {
        const w = full ? W : cw;
        this.cell(M + idx * (cw + gap), w, top, h, rf.label, values[rf.key], rf.required);
      });
      this.y -= h + 4;
    }
  }

  table(fields: RmaField[], values: RmaValues, cols: 1 | 2) {
    const gap = 8;
    const colW = cols === 2 ? (W - gap) / 2 : W;
    const rowH = 14;
    const per = Math.ceil(fields.length / cols);
    const chunks: RmaField[][] = [];
    for (let c = 0; c < cols; c++) chunks.push(fields.slice(c * per, (c + 1) * per));
    const rows = Math.max(...chunks.map((c) => c.length));
    this.ensure(rowH * (rows + 1) + 6);
    const top = this.y;
    chunks.forEach((chunk, ci) => {
      const x = M + ci * (colW + gap);
      const labelW = colW * 0.66;
      const p = this.page;
      // header
      p.drawRectangle({ x, y: top - rowH, width: colW, height: rowH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.6 });
      p.drawText("ITEM", { x: x + 4, y: top - rowH + 4.5, size: 6.5, font: this.bold, color: BLACK });
      p.drawText("RESULT", { x: x + labelW + 4, y: top - rowH + 4.5, size: 6.5, font: this.bold, color: BLACK });
      p.drawLine({ start: { x: x + labelW, y: top }, end: { x: x + labelW, y: top - rowH * (chunk.length + 1) }, thickness: 0.6, color: LINE });
      chunk.forEach((f, ri) => {
        const yTop = top - rowH * (ri + 1);
        p.drawRectangle({ x, y: yTop - rowH, width: colW, height: rowH, borderColor: LINE, borderWidth: 0.6 });
        p.drawText(this.fit(f.label, this.font, 7, labelW - 8), {
          x: x + 4,
          y: yTop - rowH + 4.5,
          size: 7,
          font: this.font,
          color: BLACK,
        });
        const v = values[f.key] || "—";
        p.drawText(this.fit(v, this.bold, 7, colW - labelW - 8), {
          x: x + labelW + 4,
          y: yTop - rowH + 4.5,
          size: 7,
          font: this.bold,
          color: BLACK,
        });
      });
    });
    this.y = top - rowH * (rows + 1) - 6;
  }

  trace(columns: { key: string; label: string; width: number }[], rows: TraceRow[]) {
    const rowH = 14;
    const data = rows.filter((r) => columns.some((c) => (r[c.key] || "").trim()));
    const list = data.length ? data : rows.slice(0, 3);
    this.ensure(rowH * (list.length + 1) + 6);
    const top = this.y;
    const p = this.page;
    let x = M;
    p.drawRectangle({ x: M, y: top - rowH, width: W, height: rowH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.6 });
    columns.forEach((c) => {
      const cw = W * c.width;
      p.drawText(this.fit(c.label.toUpperCase(), this.bold, 6.3, cw - 6), {
        x: x + 3,
        y: top - rowH + 4.5,
        size: 6.3,
        font: this.bold,
        color: BLACK,
      });
      x += cw;
    });
    list.forEach((r, ri) => {
      const yTop = top - rowH * (ri + 1);
      let cx = M;
      columns.forEach((c) => {
        const cw = W * c.width;
        p.drawRectangle({ x: cx, y: yTop - rowH, width: cw, height: rowH, borderColor: LINE, borderWidth: 0.6 });
        p.drawText(this.fit(r[c.key] || "", this.font, 7, cw - 6), {
          x: cx + 3,
          y: yTop - rowH + 4.5,
          size: 7,
          font: this.font,
          color: BLACK,
        });
        cx += cw;
      });
    });
    this.y = top - rowH * (list.length + 1) - 6;
  }

  notes(items: string[]) {
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
    this.y -= 4;
  }

  signature() {
    this.ensure(40);
    const top = this.y - 6;
    const half = (W - 8) / 2;
    this.cell(M, half, top, 30, "Prepared by (Name & Signature)", "");
    this.cell(M + half + 8, half, top, 30, "Date", new Date().toLocaleDateString("en-GB"));
    this.y = top - 34;
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
