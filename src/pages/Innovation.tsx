import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { toast } from "sonner";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

const APPROVERS: { role: string; name: string }[] = [
  { role: "End User", name: "AMR MOHAMED HAMED RASHWAN" },
  { role: "Section Head", name: "Asaad Tawfik" },
  { role: "Division Head", name: "Abubaker Mohamed Almarzooqi" },
  { role: "Budgeting & Cost Control", name: "George Abili" },
  { role: "Manager - Business Commercial Management", name: "Bassem Elbashandy" },
  { role: "Director – Business Commercial Management & Budgeting", name: "Michael Thabit" },
  { role: "Senior Vice President – Business Strategy & Planning", name: "Hazim Deyab" },
];
const ABOVE_500K = { role: "Group Chief AI Network & Solutions Officer", name: "Haitham Abdulrazzak" };

async function extractPdfText(file: File): Promise<{ text: string; bytes: Uint8Array }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const loadingTask = (pdfjsLib as any).getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const p = await pdf.getPage(i);
    const c = await p.getTextContent();
    text += c.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return { text, bytes };
}

function scrape(text: string): { po: string; invoice: string; amount: string } {
  const t = text.replace(/\s+/g, " ");
  const pick = (patterns: RegExp[]) => {
    for (const re of patterns) { const m = t.match(re); if (m) return (m[1] || "").trim(); }
    return "";
  };
  const po = pick([
    /(?:Vendor\s*PO\s*(?:No\.?|Number)?|Purchase\s*Order\s*(?:No\.?|Number)?|PO\s*(?:No\.?|Number|#))\s*[:\-]?\s*([A-Z0-9\-\/]{4,})/i,
    /\bPO\s*[:#\-]\s*([A-Z0-9\-\/]{4,})/i,
  ]);
  const invoice = pick([
    /(?:Invoice\s*(?:No\.?|Number|#)|Vendor\s*Invoice\s*(?:No\.?|Number)?|Tax\s*Invoice\s*(?:No\.?|#)?)\s*[:\-]?\s*([A-Z0-9\-\/]{3,})/i,
    /\bINV[\s\-#:]*([A-Z0-9\-\/]{3,})/i,
  ]);
  const amount = pick([
    /(?:Total\s*(?:Amount|Due|Payable)|Grand\s*Total|Amount\s*Due)\s*[:\-]?\s*(?:AED|USD|EUR|SAR)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ]);
  return { po, invoice, amount };
}

async function buildCoverPage(fields: {
  vendorName: string; poNumber: string; invoiceNumber: string;
  projectName: string; scope: string; amount: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0.07, 0.07, 0.07);
  const grey = rgb(0.85, 0.85, 0.85);
  const red = rgb(0.86, 0.15, 0.15);

  // Title
  page.drawText("PAYMENT CERTIFICATION FORM", { x: 90, y: 780, size: 18, font: bold, color: black });
  page.drawLine({ start: { x: 50, y: 765 }, end: { x: 545, y: 765 }, thickness: 1.2, color: red });

  // Info table
  const rows: [string, string][] = [
    ["Vendor Invoice Number", fields.invoiceNumber || "—"],
    ["Vendor PO No", fields.poNumber || "—"],
    ["Project Name / Contract Ref.", fields.projectName || "—"],
    ["Scope of Work", fields.scope || "—"],
    ["Vendor Name", fields.vendorName || "—"],
    ["Amount & Currency", fields.amount || "—"],
  ];
  let y = 730;
  const rowH = 32, labelW = 210, valueW = 285, xL = 50, xV = xL + labelW;
  for (const [k, v] of rows) {
    page.drawRectangle({ x: xL, y: y - rowH, width: labelW, height: rowH, borderColor: grey, borderWidth: 0.7 });
    page.drawRectangle({ x: xV, y: y - rowH, width: valueW, height: rowH, borderColor: grey, borderWidth: 0.7 });
    page.drawText(k, { x: xL + 8, y: y - 20, size: 10, font: bold, color: black });
    page.drawText(String(v).slice(0, 60), { x: xV + 8, y: y - 20, size: 10, font, color: black });
    y -= rowH;
  }

  // Signatures table
  y -= 20;
  page.drawText("Approvals", { x: 50, y, size: 11, font: bold, color: black });
  y -= 12;
  const colW = [230, 130, 80, 55];
  const headers = ["Role", "Name", "Signature", "Date"];
  const drawRow = (vals: string[], hy: number, isHead = false) => {
    let x = 50;
    for (let i = 0; i < 4; i++) {
      page.drawRectangle({ x, y: hy - 22, width: colW[i], height: 22, borderColor: grey, borderWidth: 0.6,
        color: isHead ? rgb(0.96,0.96,0.96) : undefined });
      page.drawText(vals[i] || "", { x: x + 6, y: hy - 15, size: 9, font: isHead ? bold : font, color: black });
      x += colW[i];
    }
  };
  drawRow(headers, y, true); y -= 22;
  for (const a of APPROVERS) { drawRow([a.role, a.name, "", ""], y); y -= 22; }
  // Above 500k header
  let x = 50;
  page.drawRectangle({ x, y: y - 22, width: colW.reduce((a,b)=>a+b,0), height: 22,
    color: rgb(0.99,0.94,0.94), borderColor: grey, borderWidth: 0.6 });
  page.drawText("Approval for Invoice Above AED 500k", { x: x + 6, y: y - 15, size: 9, font: bold, color: red });
  y -= 22;
  drawRow([ABOVE_500K.role, ABOVE_500K.name, "", ""], y); y -= 22;

  // Footer
  page.drawText(`Generated ${new Date().toLocaleString()}`, { x: 50, y: 40, size: 8, font, color: rgb(0.4,0.4,0.4) });

  return await doc.save();
}

export default function Innovation() {
  const nav = useNavigate();
  const session = getSession();
  useEffect(() => { if (!session) nav("/"); }, [session, nav]);

  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 3000); return () => clearTimeout(t); }, []);

  const [vendorName, setVendorName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [scope, setScope] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPdfChange(f: File | null) {
    if (!f) { setPdfFile(null); setPdfBytes(null); return; }
    setPdfFile(f);
    setBusy(true);
    try {
      const { text, bytes } = await extractPdfText(f);
      setPdfBytes(bytes);
      const scraped = scrape(text);
      if (scraped.po && !poNumber) setPoNumber(scraped.po);
      if (scraped.invoice && !invoiceNumber) setInvoiceNumber(scraped.invoice);
      if (scraped.amount && !amount) setAmount(scraped.amount);
      toast.success("PDF scanned — fields auto-filled where possible");
      // Auto-generate & download
      setTimeout(() => generate(bytes, {
        po: scraped.po || poNumber,
        invoice: scraped.invoice || invoiceNumber,
        amt: scraped.amount || amount,
      }), 300);
    } catch (e: any) {
      toast.error("Could not read PDF: " + (e?.message ?? e));
    } finally { setBusy(false); }
  }

  async function generate(bytesOverride?: Uint8Array, overrides?: { po?: string; invoice?: string; amt?: string }) {
    const bytes = bytesOverride ?? pdfBytes;
    if (!bytes) { toast.error("Upload a PDF first"); return; }
    setBusy(true);
    try {
      const coverBytes = await buildCoverPage({
        vendorName, projectName, scope,
        poNumber: overrides?.po ?? poNumber,
        invoiceNumber: overrides?.invoice ?? invoiceNumber,
        amount: overrides?.amt ?? amount,
      });
      const out = await PDFDocument.create();
      const cover = await PDFDocument.load(coverBytes);
      const original = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const c = await out.copyPages(cover, cover.getPageIndices());
      c.forEach((p) => out.addPage(p));
      const o = await out.copyPages(original, original.getPageIndices());
      o.forEach((p) => out.addPage(p));
      const finalBytes = await out.save();
      // Convert to plain ArrayBuffer for Blob (avoids TS SharedArrayBuffer typing issue)
      const ab = new ArrayBuffer(finalBytes.byteLength);
      new Uint8Array(ab).set(finalBytes);
      const blob = new Blob([ab], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeVendor = (vendorName || "vendor").replace(/[^a-z0-9]+/gi, "_");
      const safeInv = (overrides?.invoice ?? invoiceNumber ?? "invoice").replace(/[^a-z0-9]+/gi, "_");
      a.href = url;
      a.download = `Payment_Certificate_${safeVendor}_${safeInv}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Certificate generated and downloaded");
    } catch (e: any) {
      toast.error("Failed to build PDF: " + (e?.message ?? e));
    } finally { setBusy(false); }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white transition-opacity duration-700">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full border-2 border-[#dc2626] border-t-transparent animate-spin" />
          <p className="mt-5 text-sm font-semibold text-[#111] tracking-wide">Loading Innovation Tools</p>
          <p className="mt-1 text-xs text-muted-foreground">Preparing certification builder…</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell session={session!}>
      <div className={`space-y-6 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#dc2626]">Innovation Tools</p>
          <h1 className="text-xl font-semibold text-[#111] mt-1">Payment Certificate Builder</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Upload a vendor invoice PDF. We'll auto-fill PO / Invoice numbers, prepend the certification form, and download the merged file.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-lg border border-border bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#111]">Certificate Details</h2>
            <Field label="Vendor Name *" value={vendorName} onChange={setVendorName} placeholder="Type vendor name" />
            <Field label="Project Name / Contract Ref." value={projectName} onChange={setProjectName} />
            <Field label="Scope of Work" value={scope} onChange={setScope} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vendor PO No (scraped)" value={poNumber} onChange={setPoNumber} />
              <Field label="Invoice No (scraped)" value={invoiceNumber} onChange={setInvoiceNumber} />
            </div>
            <Field label="Amount & Currency" value={amount} onChange={setAmount} placeholder="AED 0.00" />
          </div>

          <div className="rounded-lg border border-border bg-white p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#111]">Invoice PDF</h2>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-[#dc2626] transition">
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)} />
              <div className="text-sm font-medium text-[#111]">
                {pdfFile ? pdfFile.name : "Click to upload PDF"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {pdfFile ? `${(pdfFile.size / 1024).toFixed(0)} KB` : "PO / Invoice numbers will be extracted automatically"}
              </div>
            </div>

            <button
              disabled={!pdfBytes || busy || !vendorName}
              onClick={() => generate()}
              className="w-full h-10 rounded-md bg-[#dc2626] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
              {busy ? "Working…" : "Generate & Download Certificate"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              The certification form (with all approvers) is added as page 1, followed by your uploaded PDF.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-[#111] mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 border border-input rounded-md text-xs bg-white focus:outline-none focus:border-[#dc2626]" />
    </label>
  );
}
