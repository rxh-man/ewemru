import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { toast } from "sonner";
import templateAsset from "@/assets/payment-certificate-template.pdf.asset.json";

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorker;

let _templateBytes: Uint8Array | null = null;
async function loadTemplateBytes(): Promise<Uint8Array> {
  if (_templateBytes) return _templateBytes;
  const r = await fetch(templateAsset.url);
  if (!r.ok) throw new Error("Failed to load certificate template");
  _templateBytes = new Uint8Array(await r.arrayBuffer());
  return _templateBytes;
}


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
  const templateBytes = await loadTemplateBytes();
  const doc = await PDFDocument.load(templateBytes);
  const page = doc.getPage(0);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0.07, 0.07, 0.07);
  const PH = page.getHeight();

  // Overlay values on the right column of the info table.
  // Coordinates measured from the rendered template (top-based y).
  const size = 10;
  const xVal = 290;
  const rows: [string, number][] = [
    [fields.invoiceNumber, 172],
    [fields.poNumber, 190],
    [fields.projectName, 208],
    [fields.scope, 226],
    [fields.vendorName, 244],
    [fields.amount, 263],
  ];
  for (const [val, top] of rows) {
    if (!val) continue;
    page.drawText(String(val).slice(0, 80), {
      x: xVal, y: PH - top - 10, size, font, color: black,
    });
  }
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
