import { useState } from "react";
import { TC_HEADER, TC_ITEMS, TC_ANSWERS, type TcValues } from "@/lib/tcChecklist";
import { buildTcPdf } from "@/lib/tcPdf";
import { downloadPdf } from "@/lib/rmaPdf";
import { Toaster, toast } from "sonner";
import eandLogo from "@/assets/eand.png";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TcChecklist() {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<TcValues>({ tcDate: today(), signDate: today() });

  function set(k: string, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  function start() {
    setValues({ tcDate: today(), signDate: today() });
    setStep(0);
    setStarted(true);
    window.scrollTo({ top: 0 });
  }

  async function generate() {
    const missing: string[] = [];
    TC_HEADER.forEach((f) => {
      if (f.required && !(values[f.key] || "").trim()) missing.push(f.label);
    });
    if (!(values.name || "").trim()) missing.push("Name");
    const unanswered = TC_ITEMS.filter((i) => !values[i.key]).length;
    if (missing.length) {
      toast.error(`Please fill: ${missing.join(", ")}`);
      return;
    }
    if (unanswered) {
      toast.error(`${unanswered} quality item${unanswered > 1 ? "s" : ""} still unanswered`);
      return;
    }
    setBusy(true);
    try {
      const bytes = await buildTcPdf(values);
      const name = (values.gw || "TC_Checklist").trim().replace(/[^\w-]+/g, "_");
      downloadPdf(bytes, `${name}.pdf`);
      toast.success("Checklist generated and downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Could not generate the PDF");
    } finally {
      setBusy(false);
    }
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden">
        <Toaster position="top-center" richColors />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-[spin_60s_linear_infinite] opacity-[0.03]"
            style={{ background: "conic-gradient(from 0deg, transparent 0deg, var(--primary) 60deg, transparent 120deg)" }}
          />
        </div>
        <header className="relative bg-[#111] text-white">
          <div className="max-w-3xl mx-auto px-4 py-5 flex items-center gap-3">
            <img src={eandLogo} alt="e&" className="h-7 w-auto" />
            <div>
              <h1 className="text-base font-semibold leading-tight">T &amp; C Checklist Generator</h1>
              <p className="text-[11px] text-white/60">Field team support · no login required</p>
            </div>
          </div>
        </header>

        <main className="relative max-w-3xl mx-auto px-4 py-10">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary mb-4">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
              Automated commissioning records
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Testing &amp; Commissioning Checklist
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
              Answer the guided questions and the filled checklist downloads as a clean single-page PDF, named by GW S/No.
            </p>
          </div>

          <button
            onClick={start}
            className="group block w-full text-left rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-xl"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-primary">e&amp; Etisalat</div>
            <div className="mt-3 text-sm font-semibold text-card-foreground">TESTING &amp; COMMISSIONING CHECKLIST</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Site details, 10 quality items with comments, name and date
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-primary">
              Start form <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </div>
          </button>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            No data is stored on our servers. The PDF is built locally in your browser.
          </p>
        </main>
      </div>
    );
  }

  const steps = ["Site details", "Quality checklist", "Commissioned by"];
  const last = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-[#fafafa] pb-28">
      <Toaster position="top-center" richColors />
      <header className="bg-[#111] text-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={eandLogo} alt="e&" className="h-6 w-auto" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">T &amp; C Checklist</div>
              <div className="text-[10px] text-white/60 truncate">{steps[step]}</div>
            </div>
          </div>
          <button onClick={() => setStarted(false)} className="text-[11px] text-white/70 hover:text-white shrink-0">
            Start over
          </button>
        </div>
        <div className="h-0.5 bg-white/15">
          <div className="h-full bg-[#dc2626] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of {steps.length}
        </div>

        {step === 0 &&
          TC_HEADER.map((f) => (
            <label key={f.key} className="block rounded-lg border border-border bg-white p-3">
              <span className="block text-xs font-semibold text-[#111] mb-1.5">
                {f.label}
                {f.required && <span className="text-[#dc2626]"> *</span>}
              </span>
              <input
                type={f.type === "date" ? "date" : "text"}
                value={values[f.key] || ""}
                placeholder={f.placeholder}
                maxLength={120}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-[#dc2626]"
              />
            </label>
          ))}

        {step === 1 &&
          TC_ITEMS.map((it, i) => (
            <div key={it.key} className="rounded-lg border border-border bg-white p-3">
              <div className="text-xs font-semibold text-[#111] mb-2">
                {i + 1}. {it.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {TC_ANSWERS.map((a) => (
                  <button
                    key={a}
                    onClick={() => set(it.key, values[it.key] === a ? "" : a)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      values[it.key] === a
                        ? "border-[#dc2626] bg-[#dc2626] text-white"
                        : "border-border bg-white text-[#111] hover:border-[#dc2626]"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <input
                value={values[`c_${it.key}`] || ""}
                onChange={(e) => set(`c_${it.key}`, e.target.value)}
                placeholder="Comments (optional)"
                maxLength={140}
                className="mt-2 w-full rounded-md border border-border px-3 py-2 text-xs outline-none focus:border-[#dc2626]"
              />
            </div>
          ))}

        {step === 2 && (
          <>
            <label className="block rounded-lg border border-border bg-white p-3">
              <span className="block text-xs font-semibold text-[#111] mb-1.5">
                Name<span className="text-[#dc2626]"> *</span>
              </span>
              <input
                value={values.name || ""}
                onChange={(e) => set("name", e.target.value)}
                maxLength={80}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-[#dc2626]"
              />
            </label>
            <label className="block rounded-lg border border-border bg-white p-3">
              <span className="block text-xs font-semibold text-[#111] mb-1.5">Date</span>
              <input
                type="date"
                value={values.signDate || ""}
                onChange={(e) => set("signDate", e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-[#dc2626]"
              />
            </label>
            <p className="text-[11px] text-muted-foreground px-1">
              The PDF will be saved as {(values.gw || "GW S/No").trim() || "GW S/No"}.pdf
            </p>
          </>
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
