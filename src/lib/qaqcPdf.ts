import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { QA_ITEMS, QA_MATERIALS, QA_PROJECTS, qaSigners, qaHeader, type QaProject, type QaValues } from "./qaqcChecklist";
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
      if (lines.length === maxLines - 1) { cur = t; break; }
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
  return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-GB");
}

export async function buildQaPdf(values: QaValues, project: QaProject = "ewe") {
  const projectName = QA_PROJECTS[project].name;
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
  page.drawText("QA/QC Quality Inspection Checklist", { x: M, y: y - 12, size: 14, font: bold, color: BLACK });
  y -= 24;
  page.drawText(`Project: ${projectName}  |  Supply and Installation of Communication Device for Smart Electricity Meters`, {
    x: M, y: y - 2, size: 8, font, color: GREY,
  });
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1.4, color: BLACK });
  y -= 16;

  const gap = 8;
  const cols = 3;
  const cw = (W - gap * (cols - 1)) / cols;
  const pairs: [string, string][] = qaHeader(project).map((f) => [
    f.label.toUpperCase(),
    f.type === "date" ? fmtDate(values[f.key] || "") : values[f.key] || "",
  ]);
  for (let r = 0; r < Math.ceil(pairs.length / cols); r++) {
    const h = 28;
    for (let c = 0; c < cols; c++) {
      const cell = pairs[r * cols + c];
      if (!cell) continue;
      const [label, value] = cell;
      const x = M + c * (cw + gap);
      page.drawRectangle({ x, y: y - h, width: cw, height: h, borderColor: LINE, borderWidth: 0.7 });
      page.drawText(wrap(label, bold, 6.5, cw - 8, 1)[0] || label, { x: x + 5, y: y - 10, size: 6.5, font: bold, color: GREY });
      const ln = wrap(value, font, 8.5, cw - 10, 1);
      if (ln[0]) page.drawText(ln[0], { x: x + 5, y: y - 21, size: 8.5, font, color: BLACK });
    }
    y -= h + gap;
  }
  y -= 2;

  page.drawText("GATEWAY INSTALLATION CHECKLIST", { x: M, y: y - 8, size: 8.5, font: bold, color: BLACK });
  y -= 16;

  const colSn = 26;
  const colChecked = 46;
  const colRect = 78;
  const colComments = 132;
  const colItem = W - colSn - colChecked - colRect - colComments;
  const widths = [colSn, colItem, colChecked, colComments, colRect];
  const xs: number[] = [];
  let acc = M;
  widths.forEach((w) => { xs.push(acc); acc += w; });
  const headers = ["S.N.", "ITEM", "CHECKED", "COMMENTS", "RECTIFICATION"];
  const headH = 18;

  page.drawRectangle({ x: M, y: y - headH, width: W, height: headH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.7 });
  headers.forEach((h, i) => {
    const tw = bold.widthOfTextAtSize(h, 7);
    const cx = i === 1 || i === 3 ? xs[i] + 4 : xs[i] + (widths[i] - tw) / 2;
    page.drawText(h, { x: cx, y: y - headH + 6, size: 7, font: bold, color: BLACK });
  });
  let top = y - headH;

  QA_ITEMS.forEach((it, idx) => {
    const lblLines = wrap(it.label, font, 8, colItem - 8, 3);
    const cmtLines = wrap(values[`c_${it.key}`] || "", font, 7, colComments - 8, 3);
    const rectLines = wrap(values[`r_${it.key}`] || "", font, 7, colRect - 8, 3);
    const rows = Math.max(lblLines.length, cmtLines.length, rectLines.length, 1);
    const h = Math.max(22, 8 + rows * 10);
    for (let i = 0; i < widths.length; i++) {
      page.drawRectangle({ x: xs[i], y: top - h, width: widths[i], height: h, borderColor: LINE, borderWidth: 0.6 });
    }
    const sn = String(idx + 1);
    page.drawText(sn, { x: xs[0] + (colSn - font.widthOfTextAtSize(sn, 8)) / 2, y: top - h / 2 - 3, size: 8, font, color: BLACK });
    lblLines.forEach((ln, i) => page.drawText(ln, { x: xs[1] + 4, y: top - 13 - i * 10, size: 8, font, color: BLACK }));
    const ans = values[it.key] || "";
    if (ans) {
      const tw = bold.widthOfTextAtSize(ans, 8);
      page.drawText(ans, { x: xs[2] + (colChecked - tw) / 2, y: top - h / 2 - 3, size: 8, font: bold, color: BLACK });
    }
    cmtLines.forEach((ln, i) => page.drawText(ln, { x: xs[3] + 4, y: top - 13 - i * 10, size: 7, font, color: BLACK }));
    rectLines.forEach((ln, i) => page.drawText(ln, { x: xs[4] + 4, y: top - 13 - i * 10, size: 7, font, color: BLACK }));
    top -= h;
  });

  // general comments
  let gy = top - 14;
  page.drawText("GENERAL COMMENTS", { x: M, y: gy, size: 8, font: bold, color: BLACK });
  gy -= 6;
  const gLines = wrap(values.general || "", font, 8, W - 10, 3);
  const gh = Math.max(34, 10 + gLines.length * 10);
  page.drawRectangle({ x: M, y: gy - gh, width: W, height: gh, borderColor: LINE, borderWidth: 0.7 });
  gLines.forEach((ln, i) => page.drawText(ln, { x: M + 5, y: gy - 13 - i * 10, size: 8, font, color: BLACK }));
  gy -= gh + 16;

  page.drawText("REVIEWED & VERIFIED BY", { x: M, y: gy, size: 8.5, font: bold, color: BLACK });
  gy -= 8;
  page.drawLine({ start: { x: M, y: gy }, end: { x: M + W, y: gy }, thickness: 0.8, color: BLACK });
  gy -= 8;

  const half = (W - gap) / 2;
  const bh = project === "taqa" ? 54 : 42;
  qaSigners(project).forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (half + gap);
    const boxY = gy - bh - row * (bh + gap);
    page.drawRectangle({ x, y: boxY, width: half, height: bh, borderColor: LINE, borderWidth: 0.7 });
    const tl = wrap(s.label, bold, 7, half - 10, 1);
    page.drawText(tl[0] || s.label, { x: x + 5, y: boxY + bh - 11, size: 7, font: bold, color: GREY });
    const nm = wrap(values[`${s.key}_name`] || "", font, 8.5, half - 10, 1);
    page.drawText(`Name: ${nm[0] || ""}`, { x: x + 5, y: boxY + bh - 25, size: 8.5, font, color: BLACK });
    if (project === "taqa") {
      const eid = wrap(values[`${s.key}_employeeId`] || "", font, 8.5, half - 10, 1);
      page.drawText(`Employee ID: ${eid[0] || ""}`, { x: x + 5, y: boxY + bh - 38, size: 8.5, font, color: BLACK });
      page.drawText(`Date: ${fmtDate(values[`${s.key}_date`] || "")}`, { x: x + 5, y: boxY + 8, size: 8.5, font, color: BLACK });
    } else {
      page.drawText(`Date: ${fmtDate(values[`${s.key}_date`] || "")}`, { x: x + 5, y: boxY + 8, size: 8.5, font, color: BLACK });
    }
  });

  page.drawText(
    `e& Etisalat - QA/QC Quality Inspection Checklist - generated ${new Date().toLocaleDateString("en-GB")}`,
    { x: M, y: 22, size: 6.4, font, color: GREY },
  );

  // ---------- page 2: material list ----------
  const p2 = pdf.addPage(A4);
  let my = A4[1] - M;
  if (logo) {
    const h = 16;
    const w = (logo.width / logo.height) * h;
    p2.drawImage(logo, { x: M + W - w, y: my - h, width: w, height: h });
  }
  p2.drawText("Material List", { x: M, y: my - 12, size: 14, font: bold, color: BLACK });
  my -= 24;
  p2.drawText(
    `Project: ${projectName}  |  ${values.site || ""}${values.buildingId ? "  |  " + (project === "taqa" ? "Building ID / UNAID: " : "Building ID: ") + values.buildingId : ""}${values.date ? "  |  " + fmtDate(values.date) : ""}`,
    { x: M, y: my - 2, size: 8, font, color: GREY },
  );
  my -= 12;
  p2.drawLine({ start: { x: M, y: my }, end: { x: M + W, y: my }, thickness: 1.4, color: BLACK });
  my -= 16;

  const mNo = 54;
  const mUnit = 56;
  const mQty = 46;
  const mDesc = W - mNo - mUnit - mQty;
  const mW = [mNo, mDesc, mUnit, mQty];
  const mX: number[] = [];
  let macc = M;
  mW.forEach((w) => { mX.push(macc); macc += w; });
  const mHeads = ["ITEM NO.", "EQUIPMENT / MATERIAL", "UNIT", "QTY"];

  p2.drawRectangle({ x: M, y: my - headH, width: W, height: headH, color: HEAD_BG, borderColor: LINE, borderWidth: 0.7 });
  mHeads.forEach((h, i) => {
    const tw = bold.widthOfTextAtSize(h, 7);
    const cx = i === 1 ? mX[i] + 4 : mX[i] + (mW[i] - tw) / 2;
    p2.drawText(h, { x: cx, y: my - headH + 6, size: 7, font: bold, color: BLACK });
  });
  let mTop = my - headH;


  QA_MATERIALS.forEach((m) => {
    const lines = wrap(m.label, m.section ? bold : font, 7, mDesc - 8, 4);
    const h = Math.max(16, 6 + lines.length * 9);
    if (m.section) {
      p2.drawRectangle({ x: M, y: mTop - h, width: W, height: h, color: HEAD_BG, borderColor: LINE, borderWidth: 0.6 });
      p2.drawText(m.no, { x: mX[0] + 4, y: mTop - 11, size: 7, font: bold, color: BLACK });
      lines.forEach((ln, i) => p2.drawText(ln, { x: mX[1] + 4, y: mTop - 11 - i * 9, size: 7, font: bold, color: BLACK }));
    } else {
      for (let i = 0; i < mW.length; i++) {
        p2.drawRectangle({ x: mX[i], y: mTop - h, width: mW[i], height: h, borderColor: LINE, borderWidth: 0.6 });
      }
      p2.drawText(m.no, { x: mX[0] + 4, y: mTop - h / 2 - 3, size: 7, font, color: BLACK });
      lines.forEach((ln, i) => p2.drawText(ln, { x: mX[1] + 4, y: mTop - 11 - i * 9, size: 7, font, color: BLACK }));
      const uw = font.widthOfTextAtSize(m.unit, 7);
      p2.drawText(m.unit, { x: mX[2] + (mUnit - uw) / 2, y: mTop - h / 2 - 3, size: 7, font, color: BLACK });
      const qv = (values[`q_${m.key}`] || "").trim();
      if (qv) {
        const qw = bold.widthOfTextAtSize(qv, 8);
        p2.drawText(qv, { x: mX[3] + (mQty - qw) / 2, y: mTop - h / 2 - 3, size: 8, font: bold, color: BLACK });
      }
    }
    mTop -= h;
  });

  mTop -= 24;

  p2.drawText("PREPARED BY", { x: M, y: mTop, size: 8, font: bold, color: GREY });
  mTop -= 14;
  p2.drawText(`Name: ${values.s1_name || ""}`, { x: M, y: mTop, size: 8.5, font, color: BLACK });
  p2.drawText(`Date: ${fmtDate(values.s1_date || values.date || "")}`, { x: M + W / 2, y: mTop, size: 8.5, font, color: BLACK });

  p2.drawText(
    `e& Etisalat - Material List - generated ${new Date().toLocaleDateString("en-GB")}`,
    { x: M, y: 22, size: 6.4, font, color: GREY },
  );

  pdf.setTitle("Quality Inspection Checklist");
  return await pdf.save();
}
