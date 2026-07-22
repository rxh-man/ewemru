import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { toast } from "sonner";
import templateAsset from "@/assets/payment-certificate-template.pdf.asset.json";

let _templateBytes: Uint8Array | null = null;
async function loadTemplateBytes(): Promise<Uint8Array> {
  if (_templateBytes) return _templateBytes;
  const r = await fetch(templateAsset.url);
  if (!r.ok) throw new Error("Failed to load certificate template");
  _templateBytes = new Uint8Array(await r.arrayBuffer());
  return _templateBytes;
}


type Candidates = { po: string[]; invoice: string[] };

function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    const k = v.trim();
    if (k && !seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function findAll(text: string, re: RegExp): string[] {
  const out: string[] = [];
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m[1]) out.push(m[1]);
    if (m.index === r.lastIndex) r.lastIndex++;
  }
  return out;
}

function extractFromFilename(filename: string): Candidates {
  // strip extension
  const base = filename.replace(/\.pdf$/i, "");
  // Split on common separators to get tokens
  const tokens = base.split(/[\s_\-]+/).filter(Boolean);

  const poRegs = [
    /\bPO[\s_\-]*(?:No\.?|Number|#)?[\s_\-]*([A-Z0-9][A-Z0-9\-\/]{3,})/gi,
    /\bP\.?O\.?[\s_\-]*([0-9]{4,})/gi,
  ];
  const invRegs = [
    /\b(?:Invoice|INV)[\s_\-]*(?:No\.?|Number|#)?[\s_\-]*([A-Z0-9][A-Z0-9\-\/]{2,})/gi,
  ];

  const po = unique(poRegs.flatMap((r) => findAll(base, r)));
  const invoice = unique(invRegs.flatMap((r) => findAll(base, r)));

  // Fallback: numeric tokens (4+ digits) as candidates
  const numTokens = unique(tokens.filter((t) => /^[A-Z0-9\-\/]{4,}$/i.test(t) && /\d/.test(t)));
  return {
    po: po.length ? po : numTokens,
    invoice: invoice.length ? invoice : numTokens,
  };
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

async function buildMergedPdf(fields: {
  vendorName: string; poNumber: string; invoiceNumber: string;
  projectName: string; scope: string; amount: string;
}, originalBytes: Uint8Array): Promise<Uint8Array> {
  const coverBytes = await buildCoverPage(fields);
  const out = await PDFDocument.create();
  const cover = await PDFDocument.load(coverBytes);
  const original = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const c = await out.copyPages(cover, cover.getPageIndices());
  c.forEach((p) => out.addPage(p));
  const o = await out.copyPages(original, original.getPageIndices());
  o.forEach((p) => out.addPage(p));
  return await out.save();
}

function downloadPdf(bytes: Uint8Array, filename: string) {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

type FileEntry = {
  id: string;
  file: File;
  bytes: Uint8Array;
  candidates: Candidates;
  po: string;
  invoice: string;
  amount: string;
};

const MAX_FILES = 5;

export default function Innovation() {
  const nav = useNavigate();
  const session = getSession();
  useEffect(() => { if (!session) nav("/"); }, [session, nav]);

  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 3000); return () => clearTimeout(t); }, []);

  const [vendorName, setVendorName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [scope, setScope] = useState("");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFilesSelected(list: FileList | null) {
    if (!list || list.length === 0) return;
    const remaining = MAX_FILES - entries.length;
    if (remaining <= 0) { toast.error(`Max ${MAX_FILES} PDFs at a time`); return; }
    const files = Array.from(list).slice(0, remaining);
    setBusy(true);
    try {
      const added: FileEntry[] = [];
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const text = await extractPdfText(bytes);
        const c = extractCandidates(text);
        added.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file: f, bytes, candidates: c,
          po: c.po[0] || "",
          invoice: c.invoice[0] || "",
          amount: c.amount[0] || "",
        });
      }
      setEntries((prev) => [...prev, ...added]);
      toast.success(`Scanned ${added.length} PDF${added.length > 1 ? "s" : ""} — review the mapping below`);
    } catch (e: any) {
      toast.error("Could not read PDF: " + (e?.message ?? e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function generateAll() {
    if (!vendorName) { toast.error("Vendor Name is required"); return; }
    if (entries.length === 0) { toast.error("Upload at least one PDF"); return; }
    setBusy(true);
    try {
      for (const e of entries) {
        const merged = await buildMergedPdf({
          vendorName, projectName, scope,
          poNumber: e.po, invoiceNumber: e.invoice, amount: e.amount,
        }, e.bytes);
        const safeVendor = vendorName.replace(/[^a-z0-9]+/gi, "_");
        const safeInv = (e.invoice || "invoice").replace(/[^a-z0-9]+/gi, "_");
        downloadPdf(merged, `Payment_Certificate_${safeVendor}_${safeInv}.pdf`);
        await new Promise((r) => setTimeout(r, 250));
      }
      toast.success(`Generated ${entries.length} certificate${entries.length > 1 ? "s" : ""}`);
    } catch (e: any) {
      toast.error("Failed: " + (e?.message ?? e));
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
            Upload up to {MAX_FILES} vendor invoice PDFs. Review the auto-mapped PO / Invoice numbers, adjust if needed, then generate.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[#111]">Shared Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Vendor Name *" value={vendorName} onChange={setVendorName} placeholder="e.g. TASC" />
            <Field label="Project Name / Contract Ref." value={projectName} onChange={setProjectName} />
            <Field label="Scope of Work" value={scope} onChange={setScope} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111]">Invoice PDFs ({entries.length}/{MAX_FILES})</h2>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={entries.length >= MAX_FILES || busy}
              className="h-8 px-3 rounded-md bg-[#111] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
              + Add PDF(s)
            </button>
            <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
              onChange={(e) => onFilesSelected(e.target.files)} />
          </div>

          {entries.length === 0 ? (
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-10 text-center cursor-pointer hover:border-[#dc2626] transition">
              <div className="text-sm font-medium text-[#111]">Click to upload up to {MAX_FILES} PDFs</div>
              <div className="text-xs text-muted-foreground mt-1">PO No / Invoice No detected automatically — you can re-map any file below</div>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((e, idx) => (
                <div key={e.id} className="border border-border rounded-lg p-4 bg-secondary/30">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#111] truncate">#{idx + 1} · {e.file.name}</div>
                      <div className="text-[11px] text-muted-foreground">{(e.file.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button onClick={() => removeEntry(e.id)}
                      className="text-[11px] font-semibold text-[#dc2626] hover:underline shrink-0">Remove</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <MappedField
                      label="Vendor PO No"
                      value={e.po}
                      candidates={e.candidates.po}
                      onChange={(v) => updateEntry(e.id, { po: v })}
                    />
                    <MappedField
                      label="Vendor Invoice No"
                      value={e.invoice}
                      candidates={e.candidates.invoice}
                      onChange={(v) => updateEntry(e.id, { invoice: v })}
                    />
                    <MappedField
                      label="Amount & Currency"
                      value={e.amount}
                      candidates={e.candidates.amount}
                      onChange={(v) => updateEntry(e.id, { amount: v })}
                      placeholder="AED 0.00"
                    />
                  </div>
                  {(e.candidates.po.length === 0 || e.candidates.invoice.length === 0) && (
                    <p className="mt-2 text-[11px] text-[#dc2626]">
                      {e.candidates.po.length === 0 && "No 'PO No' pattern detected — enter manually. "}
                      {e.candidates.invoice.length === 0 && "No 'Invoice No' pattern detected — enter manually."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            disabled={entries.length === 0 || busy || !vendorName}
            onClick={generateAll}
            className="w-full h-10 rounded-md bg-[#dc2626] text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50">
            {busy ? "Working…" : `Generate & Download ${entries.length > 0 ? entries.length : ""} Certificate${entries.length !== 1 ? "s" : ""}`}
          </button>
          <p className="text-[11px] text-muted-foreground">
            The certification form (with all approvers) is added as page 1 of each merged PDF.
          </p>
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

function MappedField({ label, value, candidates, onChange, placeholder }: {
  label: string; value: string; candidates: string[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const hasCandidates = candidates.length > 0;
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold text-[#111] mb-1">
        {label}
        {hasCandidates && (
          <span className="ml-2 text-[10px] font-medium text-muted-foreground">
            ({candidates.length} detected)
          </span>
        )}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 border border-input rounded-md text-xs bg-white focus:outline-none focus:border-[#dc2626]" />
      {hasCandidates && (
        <div className="mt-1 flex flex-wrap gap-1">
          {candidates.map((c) => (
            <button key={c} type="button" onClick={() => onChange(c)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                c === value
                  ? "bg-[#dc2626] text-white border-[#dc2626]"
                  : "bg-white text-[#111] border-border hover:border-[#dc2626]"
              }`}>
              {c}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
