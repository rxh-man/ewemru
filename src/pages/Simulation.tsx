import { useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import eandLogo from "@/assets/eand.png";
import {
  clone, compute, demoTwin, fmtM, fmtN, forecast, loadTwin, pushAudit, saveTwin,
  twinLogin, twinLogout, twinSession, type Twin, type TwinSession,
} from "@/lib/twin";
import { TwinAI } from "@/components/twin/TwinAI";
import { TwinCommercial } from "@/components/twin/TwinCommercial";
import { TwinConfig } from "@/components/twin/TwinConfig";
import { TwinExec } from "@/components/twin/TwinExec";
import { TwinScenarios } from "@/components/twin/TwinScenarios";

const TABS = ["Executive", "Configure", "Commercial", "AI Forecast", "Scenarios & Decision"] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------- diff for audit ----------------------------- */
type Leaf = { path: string; value: number | string };
function leaves(obj: unknown, prefix = ""): Leaf[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === "number" || typeof obj === "string") return [{ path: prefix, value: obj }];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return [];
}

export default function Simulation() {
  const [session, setSession] = useState<TwinSession | null>(() => twinSession());
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const [twin, setTwin] = useState<Twin>(() => loadTwin() ?? demoTwin());
  const [committed, setCommitted] = useState<Twin>(() => clone(loadTwin() ?? demoTwin()));
  const [tab, setTab] = useState<Tab>("Executive");
  const [model, setModel] = useState<string>("Hybrid AI Model");
  const [runs, setRuns] = useState(0);

  const result = useMemo(() => compute(twin), [twin]);
  const fc = useMemo(() => forecast(twin, model), [twin, model, runs]);
  const dirty = useMemo(() => JSON.stringify(twin) !== JSON.stringify(committed), [twin, committed]);

  function set(mut: (d: Twin) => void) {
    setTwin((prev) => { const next = clone(prev); mut(next); next.updatedAt = new Date().toISOString(); return next; });
  }

  function runTwin() {
    const before = compute(committed);
    const after = result;
    const a = leaves(committed), b = leaves(twin);
    const map = new Map(a.map((x) => [x.path, x.value]));
    const changes = b.filter((x) => map.has(x.path) && map.get(x.path) !== x.value);
    for (const c of changes.slice(0, 12)) {
      pushAudit({
        field: c.path,
        from: String(map.get(c.path)),
        to: String(c.value),
        by: session?.name ?? "Unknown",
        impact: `${fmtM(after.totalCost - before.totalCost)} cost · ${(after.marginPct - before.marginPct).toFixed(2)} margin pts`,
      });
    }
    setCommitted(clone(twin));
    setRuns((n) => n + 1);
    toast.success(`Digital twin recalculated — ${changes.length} assumption${changes.length === 1 ? "" : "s"} changed`, {
      description: `${fmtM(result.totalCost)} cost · ${result.marginPct.toFixed(1)}% margin · ${result.requiredMonths.toFixed(1)} months`,
    });
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const s = twinLogin(u, p);
            if (!s) { setErr("Incorrect username or password"); return; }
            setErr(""); setSession(s);
          }}
          className="w-full max-w-sm rounded-2xl border border-[#26262b] bg-[#131316] p-6"
        >
          <img src={eandLogo} alt="e&" className="h-8 w-auto" />
          <h1 className="font-heading text-xl font-bold text-white mt-4">Project Digital Twin</h1>
          <p className="text-[12px] text-white/50 mt-1">Simulate. Forecast. Optimize. Decide.</p>
          <label className="block mt-5">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Username</span>
            <input value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none"
              className="mt-1 w-full h-10 px-3 rounded-md bg-[#0d0d0f] border border-[#2c2c32] text-[13px] text-white outline-none focus:border-[#dc2626]" />
          </label>
          <label className="block mt-3">
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Password</span>
            <input type="password" value={p} onChange={(e) => setP(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md bg-[#0d0d0f] border border-[#2c2c32] text-[13px] text-white outline-none focus:border-[#dc2626]" />
          </label>
          {err && <p className="text-[11px] text-[#f87171] mt-2">{err}</p>}
          <button type="submit" className="mt-4 w-full h-10 rounded-md bg-[#dc2626] text-white text-[12px] font-semibold hover:opacity-90">
            Enter simulation
          </button>
          <p className="text-[10px] text-white/30 mt-4">
            Simulation environment. All figures inside are modelling data, not actual client commercial rates.
          </p>
        </form>
        <Toaster position="top-center" richColors theme="dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] font-body">
      <header className="sticky top-0 z-20 border-b border-[#26262b] bg-[#0a0a0b]/95 backdrop-blur">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={eandLogo} alt="e&" className="h-6 w-auto" />
              <div>
                <h1 className="font-heading text-[15px] font-bold text-white leading-tight">PROJECT DIGITAL TWIN</h1>
                <p className="text-[10px] text-white/45">Simulate. Forecast. Optimize. Decide.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-[11px] text-white font-medium">{session.name}</p>
                <p className="text-[10px] text-white/40">{session.title}</p>
              </div>
              <button onClick={() => { twinLogout(); setSession(null); }} className="text-[11px] text-white/45 hover:text-white">Logout</button>
            </div>
          </div>

          {/* control bar */}
          <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2 rounded-lg border border-[#26262b] bg-[#131316] px-3 py-2.5">
            {[
              ["Project", twin.name],
              ["Version", twin.version],
              ["Scenario", twin.scenario],
              ["Data quality", `${result.dataQuality}%`],
              ["Last updated", new Date(twin.updatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })],
              ["Model", model],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">{k}</p>
                <p className="text-[12px] text-white font-medium">{v}</p>
              </div>
            ))}
            <div className="flex-1" />
            <div className="flex flex-wrap items-center gap-2">
              {dirty && <span className="text-[10px] text-[#fbbf24]">Assumptions changed — run the twin</span>}
              <button onClick={runTwin} className="h-8 px-3 rounded-md bg-[#dc2626] text-white text-[11px] font-semibold hover:opacity-90">
                RUN DIGITAL TWIN
              </button>
              <button
                onClick={() => {
                  const bumped = { ...twin, version: `V${(parseFloat(twin.version.replace(/[^\d.]/g, "")) + 0.1).toFixed(1)}` };
                  setTwin(bumped); setCommitted(clone(bumped)); saveTwin(bumped);
                  toast.success(`Twin saved as ${bumped.version}`);
                }}
                className="h-8 px-3 rounded-md border border-[#3a3a42] text-[11px] text-white/80 hover:border-[#dc2626]">
                Save twin
              </button>
              <button onClick={() => setTab("Scenarios & Decision")} className="h-8 px-3 rounded-md border border-[#3a3a42] text-[11px] text-white/80 hover:border-[#dc2626]">Compare</button>
              <button onClick={() => { setTab("Executive"); toast.info("Use “Generate business case” for Excel, or print this brief to PDF."); }}
                className="h-8 px-3 rounded-md border border-[#3a3a42] text-[11px] text-white/80 hover:border-[#dc2626]">Export</button>
              <button onClick={() => { const d = demoTwin(); setTwin(d); setCommitted(clone(d)); toast.info("Demo project reloaded"); }}
                className="h-8 px-3 rounded-md border border-[#3a3a42] text-[11px] text-white/50 hover:text-white">Reset demo</button>
            </div>
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {TABS.map((x) => (
              <button key={x} onClick={() => setTab(x)}
                className={`whitespace-nowrap text-[12px] px-3 py-1.5 rounded-md border ${tab === x ? "border-[#dc2626] bg-[#dc2626]/12 text-white" : "border-transparent text-white/50 hover:text-white"}`}>
                {x}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-5">
        {tab === "Executive" && <TwinExec t={twin} r={result} f={fc} onPhase={(ph) => set((d) => { d.phase = ph; })} />}
        {tab === "Configure" && <TwinConfig t={twin} set={set} r={result} />}
        {tab === "Commercial" && <TwinCommercial t={twin} set={set} r={result} />}
        {tab === "AI Forecast" && (
          <TwinAI
            t={twin} r={result} f={fc} model={model} setModel={setModel}
            onApply={(next, label) => {
              setTwin({ ...next, scenario: `What-if: ${label.slice(0, 40)}`, updatedAt: new Date().toISOString() });
              toast.success("What-if applied to the working twin");
            }}
          />
        )}
        {tab === "Scenarios & Decision" && <TwinScenarios t={twin} set={set} r={result} />}

        <p className="text-[10px] text-white/30 mt-6 border-t border-[#1e1e22] pt-3">
          SIMULATION DATA — NOT ACTUAL COMMERCIAL RATES. {fmtN(twin.project.quantity)} {twin.project.unit} ·
          {" "}{twin.project.client} · {twin.version} · {twin.scenario}. Architecture is ready to connect to project,
          ERP, fleet, HR and external AI model sources.
        </p>
      </main>
      <Toaster position="top-center" richColors theme="dark" />
    </div>
  );
}
