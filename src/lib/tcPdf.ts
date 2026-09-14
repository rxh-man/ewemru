import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { TC_ITEMS, type TcValues } from "./tcChecklist";
import logoUrl from "@/assets/eand.png";

const A4: [number, number] = [595.28, 841.89];
const M = 42;
const W = A4[0] - M * 2;
const BLACK = rgb(0, 0, 0);
const GREY = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.35, 0.35, 0.35);
const HEAD_BG = rgb(0.93, 0.93, 0.93);

function wrap(text: string, font: PDFFont, size: number, max: number, maxLines = 4) {
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
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= max) cur = t;
    else {
      if (lines.length === maxLines - 1) {
        cur = t;
        break;
      }
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fmtDate(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB");
}

export async function buildTcPdf(values: TcValues) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  let y = A4[1] - M;

  let logo: any = null;
  try {
    const res = await fetch(logoUrl);
    if (res.ok) logo = await pdf.embedPng(new Uint8Array(await res.arrayBuffer()));
  } catch { /* logo optional */ }

  if (logo) {
    const h = 16;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M + W - w, y: y - h, width: w, height: h });
  }
  page.drawText("Testing & Commissioning Checklist", { x: M, y: y - 12, size: 14, font: bold, color: BLACK });
  y -= 24;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1.4, color: BLACK });
  y -= 16;

  // header cells 2 x 2
  const gap = 8;
  const cw = (W - gap) / 2;
  const pairs: [string, string][] = [
    ["Building Name", values.building || ""],
    ["T & C Date", fmtDate(values.tcDate || "")],
    ["GW S/No", values.gw || ""],
    ["IP Address", values.ip || ""],
    ["SIM ICCID", values.iccid || ""],
    ["Employee ID", values.employeeId || ""],
  ];
  for (let r = 0; r < Math.ceil(pairs.length / 2); r++) {
    const h = 30;
    for (let c = 0; c < 2; c++) {
      const cell = pairs[r * 2 + c];
      if (!cell) continue;
      const [label, value] = cell;
      const x = M + c * (cw + gap);
      page.drawRectangle({ x, y: y - h, width: cw, height: h, borderColor: LINE, borderWidth: 0.7 });
      page.drawText(label, { x: x + 5, y: y - 10, size: 7, font: bold, color: GREY });
      const ln = wrap(value, font, 9, cw - 10, 1);
      if (ln[0]) page.drawText(ln[0], { x: x + 5, y: y - 22, size: 9, font, color: BLACK });
    }
    y -= h + gap;
  }
  y -= 6;

  // checklist table
  const colAnswer = 42;
  const colComments = 150;
  const colItem = W - colAnswer * 3 - colComments;
  const xs = [M, M + colItem, M + colItem + colAnswer, M + colItem + colAnswer * 2, M + colItem + colAnswer * 3];
  const widths = [colItem, colAnswer, colAnswer, colAnswer, colComments];
  const headers = ["QUALITY ITEM", "YES", "NO", "N/A", "COMMENTS"];
  const headH = 18;

  page.drawRectangle({ x: M, y: y - headH, width: W, height: headH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.7 });
  headers.forEach((h, i) => {
    const tw = bold.widthOfTextAtSize(h, 7.5);
    const cx = i === 0 || i === 4 ? xs[i] + 5 : xs[i] + (widths[i] - tw) / 2;
    page.drawText(h, { x: cx, y: y - headH + 6, size: 7.5, font: bold, color: BLACK });
  });
  let top = y - headH;

  TC_ITEMS.forEach((it, idx) => {
    const label = `${idx + 1}. ${it.label}`;
    const lblLines = wrap(label, font, 8, colItem - 10, 3);
    const cmtLines = wrap(values[`c_${it.key}`] || "", font, 7.5, colComments - 10, 3);
    const rows = Math.max(lblLines.length, cmtLines.length, 1);
    const h = Math.max(22, 8 + rows * 10);
    // cells
    for (let i = 0; i < 5; i++) {
      page.drawRectangle({ x: xs[i], y: top - h, width: widths[i], height: h, borderColor: LINE, borderWidth: 0.6 });
    }
    lblLines.forEach((ln, i) => page.drawText(ln, { x: xs[0] + 5, y: top - 13 - i * 10, size: 8, font, color: BLACK }));
    cmtLines.forEach((ln, i) => page.drawText(ln, { x: xs[4] + 5, y: top - 13 - i * 10, size: 7.5, font, color: BLACK }));
    const ans = values[it.key] || "";
    const marks = ["YES", "NO", "N/A"];
    marks.forEach((m, i) => {
      if (ans !== m) return;
      const tick = "X";
      const tw = bold.widthOfTextAtSize(tick, 10);
      page.drawText(tick, {
        x: xs[i + 1] + (colAnswer - tw) / 2,
        y: top - h / 2 - 3.5,
        size: 10,
        font: bold,
        color: BLACK,
      });
    });
    top -= h;
  });

  y = top - 22;
  page.drawText("COMMISSIONED & VERIFIED BY", { x: M, y, size: 8.5, font: bold, color: BLACK });
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: BLACK });
  y -= 8;

  const half = (W - gap) / 2;
  const h2 = 30;
  const sign: [string, string][] = [
    ["Name", values.name || ""],
    ["Date", fmtDate(values.signDate || "")],
  ];
  sign.forEach(([label, value], i) => {
    const x = M + i * (half + gap);
    page.drawRectangle({ x, y: y - h2, width: half, height: h2, borderColor: LINE, borderWidth: 0.7 });
    page.drawText(label, { x: x + 5, y: y - 10, size: 7, font: bold, color: GREY });
    const ln = wrap(value, font, 9, half - 10, 1);
    if (ln[0]) page.drawText(ln[0], { x: x + 5, y: y - 22, size: 9, font, color: BLACK });
  });

  page.drawText(
    `e& Etisalat · Testing & Commissioning Checklist · generated ${new Date().toLocaleDateString("en-GB")}`,
    { x: M, y: 22, size: 6.4, font, color: GREY },
  );

  pdf.setTitle("Testing & Commissioning Checklist");
  return await pdf.save();
}
