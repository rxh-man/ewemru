import { useMemo, useState } from "react";
import { RMA_FORMS, type RmaFormDef, type RmaField } from "@/lib/rmaForms";
import { buildRmaPdf, downloadPdf, type RmaValues, type TraceRow } from "@/lib/rmaPdf";
import { Toaster, toast } from "sonner";
import eandLogo from "@/assets/eand.png";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function RmaForms() {
  const [active, setActive] = useState<RmaFormDef | null>(null);
  const [values, setValues] = useState<RmaValues>({});
  const [rows, setRows] = useState<TraceRow[]>([{}, {}, {}]);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  const steps = useMemo(() => (active ? active.sections.filter((s) => s.kind !== "notes") : []), [active]);

  function open(def: RmaFormDef) {
    setActive(def);
    setStep(0);
    setRows([{}, {}, {}]);
    const init: RmaValues = {};
    def.sections.forEach((s) => {
      if (s.kind === "grid" || s.kind === "table")
        s.fields.forEach((f) => {
          if (f.type === "date") init[f.key] = today();
        });
    });
    setValues(init);
    window.scrollTo({ top: 0 });
  }

  function set(key: string, v: string) {
    setValues((p) => ({ ...p, [key]: v }));
  }

  function missing(): RmaField[] {
    if (!active) return [];
    const out: RmaField[] = [];
    active.sections.forEach((s) => {
      if (s.kind === "grid" || s.kind === "table")
        s.fields.forEach((f) => {
          if (f.required && !(values[f.key] || "").trim()) out.push(f);
        });
    });
    return out;
  }

  async function generate() {
    if (!active) return;
    const miss = missing();
    if (miss.length) {
      toast.error(`Please fill: ${miss.map((m) => m.label).join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      const bytes = await buildRmaPdf(active, values, rows);
      const tag = (values.sr || values.ref || values.company || "form").toString().replace(/[^\w-]+/g, "_");
      downloadPdf(bytes, `${active.vendor}_RMA_${tag}.pdf`);
      toast.success("PDF generated and downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Could not generate the PDF");
    } finally {
      setBusy(false);
    }
  }

  if (!active) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <Toaster position="top-center" richColors />
        <header className="bg-[#111] text-white">
          <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
            <img src={eandLogo} alt="e&" className="h-7 w-auto" />
            <div>
              <h1 className="text-base font-semibold leading-tight">RMA Form Generator</h1>
              <p className="text-[11px] text-white/60">Field team support · no login required</p>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-sm text-muted-foreground mb-4">
            Pick the vendor, answer the short list of questions, and a clean single-file PDF downloads automatically.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {RMA_FORMS.map((f) => (
              <button
                key={f.id}
                onClick={() => open(f)}
                className="text-left rounded-xl border border-border bg-white p-4 hover:border-[#dc2626] hover:shadow-sm transition"
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-[#dc2626]">{f.vendor}</div>
                <div className="mt-1 text-sm font-medium text-[#111]">{f.docTitle}</div>
                <div className="mt-1 text-xs text-muted-foreground">{f.blurb}</div>
                <div className="mt-3 text-xs font-medium text-[#111]">Start form →</div>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  const section = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-[#fafafa] pb-28">
      <Toaster position="top-center" richColors />
      <header className="bg-[#111] text-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={eandLogo} alt="e&" className="h-6 w-auto" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{active.vendor} RMA</div>
              <div className="text-[10px] text-white/60 truncate">{section?.title}</div>
            </div>
          </div>
          <button onClick={() => setActive(null)} className="text-[11px] text-white/70 hover:text-white shrink-0">
            Change vendor
          </button>
        </div>
        <div className="h-0.5 bg-white/15">
          <div className="h-full bg-[#dc2626] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {steps.length}
        </div>

        {section && (section.kind === "grid" || section.kind === "table") && (
          <div className="space-y-3">
            {section.fields.map((f) => (
              <Field key={f.key} field={f} value={values[f.key] || ""} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        )}

        {section && section.kind === "trace" && (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border border-border bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#111]">Device {i + 1}</span>
                  {rows.length > 1 && (
                    <button
                      onClick={() => setRows(rows.filter((_, j) => j !== i))}
                      className="text-[11px] text-[#dc2626]"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {section.columns.map((c) => (
                    <label key={c.key} className="block">
                      <span className="block text-[11px] font-medium text-muted-foreground mb-1">{c.label}</span>
                      <input
                        value={r[c.key] || ""}
                        onChange={(e) =>
                          setRows(rows.map((rr, j) => (j === i ? { ...rr, [c.key]: e.target.value } : rr)))
                        }
                        className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-[#dc2626]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              onClick={() => setRows([...rows, {}])}
              className="w-full rounded-lg border border-dashed border-border py-2.5 text-sm font-medium text-[#111] bg-white"
            >
              + Add another device
            </button>
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-white/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex-1 rounded-lg border border-border py-3 text-sm font-medium text-[#111] disabled:opacity-40"
          >
            Back
          </button>
          {last ? (
            <button
              onClick={generate}
              disabled={busy}
              className="flex-[2] rounded-lg bg-[#dc2626] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Generating…" : "Submit & download PDF"}
            </button>
          ) : (
            <button
              onClick={() => {
                setStep((s) => s + 1);
                window.scrollTo({ top: 0 });
              }}
              className="flex-[2] rounded-lg bg-[#111] py-3 text-sm font-semibold text-white"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ field, value, onChange }: { field: RmaField; value: string; onChange: (v: string) => void }) {
  const label = (
    <span className="block text-xs font-semibold text-[#111] mb-1.5">
      {field.label}
      {field.required && <span className="text-[#dc2626]"> *</span>}
    </span>
  );

  if (field.type === "choice") {
    return (
      <div className="rounded-lg border border-border bg-white p-3">
        {label}
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map((o) => (
            <button
              key={o}
              onClick={() => onChange(value === o ? "" : o)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                value === o
                  ? "border-[#dc2626] bg-[#dc2626] text-white"
                  : "border-border bg-white text-[#111] hover:border-[#dc2626]"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <label className="block rounded-lg border border-border bg-white p-3">
      {label}
      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={600}
          placeholder={field.placeholder}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-[#dc2626]"
        />
      ) : (
        <input
          type={field.type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={160}
          placeholder={field.placeholder}
          className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-[#dc2626]"
        />
      )}
    </label>
  );
}
