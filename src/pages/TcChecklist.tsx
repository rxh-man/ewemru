import { useState } from "react";
import { TC_HEADER, TC_ITEMS, TC_ANSWERS, type TcValues } from "@/lib/tcChecklist";
import { buildTcPdf } from "@/lib/tcPdf";
import { downloadPdf } from "@/lib/rmaPdf";
import { Toaster, toast } from "sonner";
import eandLogo from "@/assets/eand.png";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Download, FileCheck2, RotateCcw, ShieldCheck } from "lucide-react";

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
      <div className="min-h-screen bg-secondary">
        <Toaster position="top-center" richColors />
        <header className="border-b border-border bg-foreground text-background">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-4">
              <img src={eandLogo} alt="e&" className="h-8 w-auto" />
              <div className="h-7 w-px bg-background/20" />
              <div className="font-heading text-sm font-semibold">Quality Assurance</div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-background/70">
              <span className="h-2 w-2 bg-primary" />
              Field tool ready
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
          <section className="mb-10 border-l-4 border-primary pl-5 sm:flex sm:items-end sm:justify-between sm:pl-7">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">T&amp;C Quality Portal</p>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight text-foreground sm:text-5xl">Testing &amp; Commissioning</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Complete a consistent site-quality inspection and issue a verified, single-page commissioning record.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-foreground">Controlled quality record</div>
                <div className="text-xs text-muted-foreground">10 verification points</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.45fr_0.75fr_0.75fr]">
            <div className="flex min-h-72 flex-col justify-between rounded-lg bg-primary p-7 text-primary-foreground shadow-lg sm:p-9">
              <div>
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-md bg-primary-foreground/15">
                  <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold">Start a new inspection</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-primary-foreground/80">
                  Record site details, verify every quality item, and generate the completed document.
                </p>
              </div>
              <Button onClick={start} className="mt-8 w-full justify-between bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-52">
                Begin checklist <ArrowRight aria-hidden="true" />
              </Button>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <FileCheck2 className="h-7 w-7 text-primary" aria-hidden="true" />
              <h2 className="mt-8 text-lg font-bold text-card-foreground">Quality scope</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Site identity, installation checks, comments, verifier name and date.</p>
              <div className="mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-primary">10 required decisions</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <Download className="h-7 w-7 text-primary" aria-hidden="true" />
              <h2 className="mt-8 text-lg font-bold text-card-foreground">Ready for handover</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">A clean PDF is downloaded automatically and named using the GW serial number.</p>
              <div className="mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-primary">Single-page PDF</div>
            </div>
          </section>

          <div className="mt-8 flex items-start gap-3 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            No inspection data is stored. Your completed PDF is generated locally in this browser.
          </div>
        </main>
      </div>
    );
  }

  const steps = ["Site details", "Quality checklist", "Commissioned by"];
  const last = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-secondary pb-28">
      <Toaster position="top-center" richColors />
      <header className="sticky top-0 z-20 bg-foreground text-background shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={eandLogo} alt="e&" className="h-6 w-auto" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">T &amp; C Checklist</div>
              <div className="text-[10px] text-background/60 truncate">Quality assurance · {steps[step]}</div>
            </div>
          </div>
          <Button onClick={() => setStarted(false)} variant="ghost" size="sm" className="shrink-0 text-background/70 hover:bg-background/10 hover:text-background"><RotateCcw />Start over</Button>
        </div>
        <div className="h-1 bg-background/15">
          <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-7 space-y-3">
        <div className="mb-5 border-l-4 border-primary pl-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-primary">Step {step + 1} of {steps.length}</div>
          <h1 className="mt-1 text-2xl font-bold text-foreground">{steps[step]}</h1>
        </div>

        {step === 0 &&
          TC_HEADER.map((f) => (
            <label key={f.key} className="block rounded-md border border-border bg-card p-4">
              <span className="block text-xs font-semibold text-card-foreground mb-1.5">
                {f.label}
                {f.required && <span className="text-primary"> *</span>}
              </span>
              <input
                type={f.type === "date" ? "date" : "text"}
                value={values[f.key] || ""}
                placeholder={f.placeholder}
                maxLength={120}
                onChange={(e) => set(f.key, e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
          ))}

        {step === 1 &&
          TC_ITEMS.map((it, i) => (
            <div key={it.key} className="rounded-md border border-border bg-card p-4">
              <div className="text-sm font-semibold text-card-foreground mb-3">
                {i + 1}. {it.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {TC_ANSWERS.map((a) => (
                  <Button
                    key={a}
                    variant="outline"
                    onClick={() => set(it.key, values[it.key] === a ? "" : a)}
                    className={`h-9 min-w-16 text-xs shadow-none ${
                      values[it.key] === a
                        ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                        : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5"
                    }`}
                  >
                    {values[it.key] === a && <Check aria-hidden="true" />}
                    {a}
                  </Button>
                ))}
              </div>
              <input
                value={values[`c_${it.key}`] || ""}
                onChange={(e) => set(`c_${it.key}`, e.target.value)}
                placeholder="Comments (optional)"
                maxLength={140}
                className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}

        {step === 2 && (
          <>
            <label className="block rounded-md border border-border bg-card p-4">
              <span className="block text-xs font-semibold text-card-foreground mb-1.5">
                Name<span className="text-primary"> *</span>
              </span>
              <input
                value={values.name || ""}
                onChange={(e) => set("name", e.target.value)}
                maxLength={80}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block rounded-md border border-border bg-card p-4">
              <span className="block text-xs font-semibold text-card-foreground mb-1.5">Date</span>
              <input
                type="date"
                value={values.signDate || ""}
                onChange={(e) => set("signDate", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <p className="text-[11px] text-muted-foreground px-1">
              The PDF will be saved as {(values.gw || "GW S/No").trim() || "GW S/No"}.pdf
            </p>
          </>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-2">
          <Button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            variant="outline"
            className="h-12 flex-1"
          >
            <ArrowLeft /> Back
          </Button>
          {last ? (
            <Button
              onClick={generate}
              disabled={busy}
              className="h-12 flex-[2] font-semibold"
            >
              {busy ? "Generating…" : <><Download /> Submit &amp; download PDF</>}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setStep((s) => s + 1);
                window.scrollTo({ top: 0 });
              }}
              className="h-12 flex-[2] bg-foreground text-background hover:bg-foreground/90"
            >
              Next <ArrowRight />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
