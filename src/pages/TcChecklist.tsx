import { useState } from "react";
import { TC_HEADER, TC_ITEMS, TC_ANSWERS, type TcValues } from "@/lib/tcChecklist";
import { qaHeader, QA_ITEMS, QA_ANSWERS, QA_SIGNERS, QA_MATERIALS, QA_PROJECTS, type QaProject, type QaValues } from "@/lib/qaqcChecklist";
import { buildTcPdf } from "@/lib/tcPdf";
import { buildQaPdf } from "@/lib/qaqcPdf";
import { downloadPdf } from "@/lib/rmaPdf";
import { Toaster, toast } from "sonner";
import eandLogo from "@/assets/eand.png";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Download, FileCheck2, RotateCcw, ShieldCheck } from "lucide-react";

type Kind = "tc" | "qa";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function safeName(v: string, fallback: string) {
  const base = (v || "").trim() || fallback;
  return base.replace(/[^\w\- ]+/g, "_").replace(/\s+/g, "_");
}

export default function TcChecklist() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [project, setProject] = useState<QaProject>("ewe");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<TcValues & QaValues>({});

  function set(k: string, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  function start(k: Kind, p: QaProject = "ewe") {
    setProject(p);
    if (k === "tc") setValues({ tcDate: today(), signDate: today() });
    else {
      const init: QaValues = { date: today() };
      QA_SIGNERS.forEach((s) => { init[`${s.key}_date`] = today(); });
      setValues(init);
    }
    setStep(0);
    setKind(k);
    window.scrollTo({ top: 0 });
  }

  async function generate() {
    const missing: string[] = [];
    const header = kind === "tc" ? TC_HEADER : QA_HEADER;
    const items = kind === "tc" ? TC_ITEMS : QA_ITEMS;
    header.forEach((f) => {
      if (f.required && !(values[f.key] || "").trim()) missing.push(f.label);
    });
    if (kind === "tc" && !(values.name || "").trim()) missing.push("Name");
    if (kind === "qa" && !(values.s1_name || "").trim()) missing.push("e& QA/QC name");
    const unanswered = items.filter((i) => !values[i.key]).length;
    if (missing.length) {
      toast.error(`Please fill: ${missing.join(", ")}`);
      return;
    }
    if (unanswered) {
      toast.error(`${unanswered} item${unanswered > 1 ? "s" : ""} still unanswered`);
      return;
    }
    setBusy(true);
    try {
      if (kind === "tc") {
        const bytes = await buildTcPdf(values);
        downloadPdf(bytes, `${safeName(values.building, "TC_Checklist")}.pdf`);
      } else {
        const bytes = await buildQaPdf(values);
        downloadPdf(bytes, `${safeName(values.site, "QAQC_Checklist")}.pdf`);
      }
      toast.success("Checklist generated and downloaded");
    } catch (e: any) {
      toast.error(e?.message || "Could not generate the PDF");
    } finally {
      setBusy(false);
    }
  }

  if (!kind) {
    return (
      <div className="min-h-screen bg-secondary">
        <Toaster position="top-center" richColors />
        <header className="border-b border-border bg-foreground text-background">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
            <div className="flex items-center gap-4">
              <img src={eandLogo} alt="e&" className="h-8 w-auto" />
              <div className="h-7 w-px bg-background/20" />
              <div className="font-heading text-sm font-semibold">Inspect · Quality Assurance</div>
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Inspect · Quality Portal</p>
              <h1 className="max-w-3xl text-3xl font-bold leading-tight text-foreground sm:text-5xl">Site quality checklists</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Choose an inspection, complete every verification point, and issue a clean single-page record named after the site.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
              <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-foreground">Controlled quality records</div>
                <div className="text-xs text-muted-foreground">2 inspection types</div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="flex min-h-72 flex-col justify-between rounded-lg bg-primary p-7 text-primary-foreground shadow-lg sm:p-9">
              <div>
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-md bg-primary-foreground/15">
                  <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold">Testing &amp; Commissioning</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-primary-foreground/80">
                  Gateway commissioning verification: firmware, profile, signal, ping and reporting checks.
                </p>
              </div>
              <Button onClick={() => start("tc")} className="mt-8 w-full justify-between bg-primary-foreground text-primary hover:bg-primary-foreground/90 sm:w-56">
                Begin T&amp;C checklist <ArrowRight aria-hidden="true" />
              </Button>
            </div>

            <div className="flex min-h-72 flex-col justify-between rounded-lg border border-border bg-card p-7 shadow-sm sm:p-9">
              <div>
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <FileCheck2 className="h-6 w-6 text-primary" aria-hidden="true" />
                </div>
                <h2 className="text-2xl font-bold text-card-foreground">QA/QC Checklist</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Gateway installation inspection: enclosure, containment, cabling, labels, SIM, activation and DLMS connectivity.
                </p>
              </div>
              <Button onClick={() => start("qa")} className="mt-8 w-full justify-between bg-foreground text-background hover:bg-foreground/90 sm:w-56">
                Begin QA/QC checklist <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </section>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-6">
              <Download className="h-7 w-7 text-primary" aria-hidden="true" />
              <h2 className="mt-6 text-lg font-bold text-card-foreground">Ready for handover</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">A clean PDF downloads automatically, named using the building or site name you enter.</p>
              <div className="mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-primary">Single-page PDF</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-6">
              <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
              <h2 className="mt-6 text-lg font-bold text-card-foreground">Nothing is stored</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Every document is produced locally in this browser; no inspection data leaves the device.</p>
              <div className="mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-primary">Private by design</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isTc = kind === "tc";
  const header = isTc ? TC_HEADER : QA_HEADER;
  const items = isTc ? TC_ITEMS : QA_ITEMS;
  const answers = isTc ? TC_ANSWERS : QA_ANSWERS;
  const steps = isTc
    ? ["Site details", "Quality checklist", "Commissioned by"]
    : ["Site details", "Installation checklist", "Material list", "Reviewed & verified by"];
  const stepName = steps[step];
  const last = step === steps.length - 1;
  const title = isTc ? "T & C Checklist" : "QA/QC Checklist";
  const fileLabel = isTc ? (values.building || "Building Name") : (values.site || "Site Name");

  return (
    <div className="min-h-screen bg-secondary pb-28">
      <Toaster position="top-center" richColors />
      <header className="sticky top-0 z-20 bg-foreground text-background shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={eandLogo} alt="e&" className="h-6 w-auto" />
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{title}</div>
              <div className="text-[10px] text-background/60 truncate">Inspect · {steps[step]}</div>
            </div>
          </div>
          <Button onClick={() => setKind(null)} variant="ghost" size="sm" className="shrink-0 text-background/70 hover:bg-background/10 hover:text-background"><RotateCcw />Start over</Button>
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
          header.map((f) => (
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
          items.map((it, i) => (
            <div key={it.key} className="rounded-md border border-border bg-card p-4">
              <div className="text-sm font-semibold text-card-foreground mb-3">
                {i + 1}. {it.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {answers.map((a) => (
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
              {!isTc && (
                <input
                  value={values[`r_${it.key}`] || ""}
                  onChange={(e) => set(`r_${it.key}`, e.target.value)}
                  placeholder="Rectification check (optional)"
                  maxLength={100}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              )}
            </div>
          ))}

        {stepName === "Material list" && (
          <>
            <p className="px-1 text-[11px] text-muted-foreground">
              Enter the quantity used on site. Leave blank where not applicable.
            </p>
            {QA_MATERIALS.map((m) =>
              m.section ? (
                <div key={m.key} className="rounded-md bg-foreground px-4 py-2.5 text-xs font-semibold text-background">
                  {m.no ? `${m.no} · ` : ""}{m.label}
                </div>
              ) : (
                <div key={m.key} className="rounded-md border border-border bg-card p-4">
                  <div className="text-[11px] font-semibold text-primary">{m.no}</div>
                  <div className="mt-1 text-xs leading-relaxed text-card-foreground">{m.label}</div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="rounded border border-border px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{m.unit}</span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={values[`q_${m.key}`] || ""}
                      onChange={(e) => set(`q_${m.key}`, e.target.value)}
                      placeholder="Qty"
                      className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              ),
            )}
          </>
        )}

        {stepName === "Commissioned by" && (
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
          </>
        )}

        {stepName === "Reviewed & verified by" && (
          <>
            <label className="block rounded-md border border-border bg-card p-4">
              <span className="block text-xs font-semibold text-card-foreground mb-1.5">General comments</span>
              <textarea
                value={values.general || ""}
                onChange={(e) => set("general", e.target.value)}
                maxLength={280}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            {QA_SIGNERS.map((s, i) => (
              <div key={s.key} className="rounded-md border border-border bg-card p-4">
                <div className="text-xs font-semibold text-card-foreground mb-3">
                  {s.label}
                  {i === 0 && <span className="text-primary"> *</span>}
                </div>
                <input
                  value={values[`${s.key}_name`] || ""}
                  onChange={(e) => set(`${s.key}_name`, e.target.value)}
                  placeholder="Name"
                  maxLength={80}
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  type="date"
                  value={values[`${s.key}_date`] || ""}
                  onChange={(e) => set(`${s.key}_date`, e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </>
        )}

        {last && (
          <p className="text-[11px] text-muted-foreground px-1">
            The PDF will be saved as {fileLabel}.pdf
          </p>
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
            <Button onClick={generate} disabled={busy} className="h-12 flex-[2] font-semibold">
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
