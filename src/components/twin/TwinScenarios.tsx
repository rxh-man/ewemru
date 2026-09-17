import { useMemo, useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  SCENARIO_PRESETS, clone, compute, fmtM, fmtN, readAudit, scenarioFrom, sensitivity,
  type Twin, type TwinResult,
} from "@/lib/twin";
import { Bar, Kpi, Num, Panel, Table, Tag, Td, Th } from "./ui";

type Set = (mut: (d: Twin) => void) => void;
const AXIS = { stroke: "#5b5b66", fontSize: 10 };
const TIP = { background: "#141417", border: "1px solid #2c2c32", borderRadius: 8, fontSize: 11, color: "#fff" };

export function TwinScenarios({ t, set, r }: { t: Twin; set: Set; r: TwinResult }) {
  const [picked, setPicked] = useState<string[]>(["Base Case", "Reseller Case", "Hybrid Delivery", "AI Optimized"]);
  const audit = readAudit();

  const scenarios = useMemo(
    () => picked.map((name) => { const tw = scenarioFrom(t, name); return { name, twin: tw, res: compute(tw) }; }),
    [t, picked],
  );
  const sens = useMemo(() => sensitivity(t), [t]);
  const tornado = sens.map((s) => ({ name: s.name, swing: +s.marginSwing.toFixed(2) }));
  const totalExposure = r.risks.reduce((a, x) => a + x.exposure, 0);

  function toggle(name: string) {
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length >= 5 ? p : [...p, name]));
  }

  const rows: [string, (x: { res: TwinResult; twin: Twin }) => string][] = [
    ["Revenue", (x) => fmtM(x.res.revenue)],
    ["Total cost", (x) => fmtM(x.res.totalCost)],
    ["Cost / unit", (x) => `AED ${fmtN(x.res.costPerUnit)}`],
    ["Workforce", (x) => fmtN(x.res.workforce)],
    ["Fleet", (x) => fmtN(x.res.fleetCount)],
    ["Duration (months)", (x) => x.res.requiredMonths.toFixed(1)],
    ["Partner cost", (x) => fmtM(x.res.partnerCost)],
    ["Risk exposure", (x) => fmtM(x.res.risks.reduce((a, y) => a + y.exposure, 0))],
    ["Cash requirement", (x) => fmtM(Math.abs(x.res.peakCash))],
    ["Margin", (x) => `${x.res.marginPct.toFixed(1)}%`],
    ["Twin status", (x) => x.res.status.label],
  ];

  return (
    <div className="space-y-4">
      <Panel title="Scenario engine" subtitle="Each scenario is an independent copy of the twin assumptions — select up to five to compare">
        <div className="flex flex-wrap gap-1.5">
          {SCENARIO_PRESETS.map((s) => (
            <button key={s} onClick={() => toggle(s)}
              className={`text-[11px] px-2.5 py-1 rounded-full border ${picked.includes(s) ? "border-[#dc2626] bg-[#dc2626]/15 text-white" : "border-[#2f2f36] text-white/55 hover:text-white"}`}>
              {s}
            </button>
          ))}
          <button onClick={() => set((d) => { const s = scenarioFrom(d, d.scenario); Object.assign(d, s); })}
            className="text-[11px] px-2.5 py-1 rounded-full border border-[#2f2f36] text-white/45 hover:text-white">Re-apply current scenario</button>
        </div>
        <Table>
          <thead>
            <tr className="border-b border-[#26262b]"><Th>Metric</Th>{scenarios.map((s) => <Th key={s.name} right>{s.name}</Th>)}</tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-b border-[#1e1e22]">
                <Td>{label}</Td>
                {scenarios.map((s) => <Td key={s.name} right>{fn(s)}</Td>)}
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="text-[10px] text-white/35 mt-3">
          No scenario is declared best — read the trade-offs: partner-heavy models reduce workforce and cash but transfer
          delivery control; accelerated models shorten duration at higher labour and fleet cost.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {scenarios.map((s) => (
            <button key={s.name} onClick={() => set((d) => { Object.assign(d, scenarioFrom(d, s.name)); })}
              className="h-8 px-3 rounded-md border border-[#3a3a42] text-[11px] text-white/75 hover:border-[#dc2626]">
              Load “{s.name}” into the twin
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4">
        <Panel title="What drives the project?" subtitle="Tornado — margin points swing from a ±10% move in each assumption">
          <div className="h-[330px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tornado} layout="vertical" margin={{ top: 5, right: 16, left: 96, bottom: 0 }}>
                <CartesianGrid stroke="#232329" horizontal={false} />
                <XAxis type="number" tick={AXIS} />
                <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 10 }} width={96} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [`${v} margin pts`, "Swing"]} />
                <RBar dataKey="swing" radius={[0, 3, 3, 0]}>
                  {tornado.map((d) => <Cell key={d.name} fill={d.swing >= 0 ? "#22c55e" : "#dc2626"} />)}
                </RBar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sensitivity detail" subtitle="Cost and duration response per assumption">
          <Table>
            <thead><tr className="border-b border-[#26262b]"><Th>Variable</Th><Th right>Margin pts</Th><Th right>Cost</Th><Th right>Months</Th></tr></thead>
            <tbody>
              {sens.map((s) => (
                <tr key={s.name} className="border-b border-[#1e1e22]">
                  <Td>{s.name}</Td>
                  <Td right><span className={s.marginSwing >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}>{s.marginSwing.toFixed(2)}</span></Td>
                  <Td right>{fmtM(s.costSwing)}</Td>
                  <Td right>{s.monthsSwing.toFixed(2)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      </div>

      <Panel title="Feasibility check" subtitle="Each test shows the calculation, not a bare yes or no">
        <div className="grid md:grid-cols-2 gap-2.5">
          {r.feasibility.map((x) => (
            <div key={x.name} className={`rounded-lg border px-3 py-2.5 ${x.pass ? "border-[#22c55e]/35 bg-[#22c55e]/[0.05]" : "border-[#ef4444]/35 bg-[#ef4444]/[0.05]"}`}>
              <div className="flex items-center justify-between">
                <p className="font-heading text-[12.5px] font-semibold text-white">{x.name}</p>
                <Tag tone={x.pass ? "good" : "bad"}>{x.pass ? "Feasible" : "Constraint breached"}</Tag>
              </div>
              <p className="text-[11px] text-white/65 mt-1">{x.detail}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Risk digital twin" subtitle={`Risks generated dynamically from current assumptions — total exposure ${fmtM(totalExposure)}`}>
        <Table>
          <thead><tr className="border-b border-[#26262b]"><Th>Risk</Th><Th right>Probability</Th><Th right>Impact</Th><Th right>Exposure</Th><Th>Severity</Th><Th>Mitigation</Th><Th>Owner</Th></tr></thead>
          <tbody>
            {r.risks.map((x) => (
              <tr key={x.name} className="border-b border-[#1e1e22]">
                <Td>{x.name}</Td>
                <Td right>{(x.probability * 100).toFixed(0)}%</Td>
                <Td right>{fmtM(x.impact)}</Td>
                <Td right>{fmtM(x.exposure)}</Td>
                <Td><Tag tone={x.severity === "High" ? "bad" : x.severity === "Medium" ? "warn" : "good"}>{x.severity}</Tag></Td>
                <Td><span className="text-white/60">{x.mitigation}</span></Td>
                <Td><span className="text-white/60">{x.owner}</span></Td>
              </tr>
            ))}
            {!r.risks.length && <tr><Td>No risk triggered at the current assumptions.</Td></tr>}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Project decision room" subtitle="Executive constraints — the simulator tests which combinations are feasible">
        <div className="grid md:grid-cols-4 gap-2.5">
          <Kpi label="Project" value={`${fmtN(t.project.quantity)} ${t.project.unit}`} sub={`${t.project.client} · ${t.project.projectName}`} />
          <Kpi label="Commercial" value={fmtM(r.revenue)} sub={`AED ${fmtN(r.revenuePerUnit)} per unit`} />
          <Kpi label="Forecast cost" value={fmtM(r.totalCost)} />
          <Kpi label="Margin" value={`${r.marginPct.toFixed(1)}%`} tone={r.marginPct >= t.targets.marginPct ? "good" : "bad"} />
          <Kpi label="Delivery" value={`${r.requiredMonths.toFixed(1)} months`} sub={`Constraint ${t.targets.scheduleMonths}`} />
          <Kpi label="Resource requirement" value={`${fmtN(r.workforce)} people`} sub={`${r.fleetCount} vehicles`} />
          <Kpi label="Key sensitivity" value={sens[0]?.name ?? "—"} sub={`${Math.abs(sens[0]?.marginSwing ?? 0).toFixed(1)} margin pts per 10%`} />
          <Kpi label="Largest risk" value={r.risks[0]?.name ?? "None"} sub={r.risks[0] ? fmtM(r.risks[0].exposure) : ""} tone="warn" />
        </div>

        <p className="text-[10px] uppercase tracking-[0.14em] text-[#f87171] mt-4">Decision inputs</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
          <Num label="Target margin %" value={t.targets.marginPct} step={0.5} onChange={(v) => set((d) => { d.targets.marginPct = v; })} />
          <Num label="Required completion (months)" value={t.targets.scheduleMonths} step={0.5} onChange={(v) => set((d) => { d.targets.scheduleMonths = v; })} />
          <Num label="Maximum cost" value={t.targets.maxCost} step={250000} prefix="AED" onChange={(v) => set((d) => { d.targets.maxCost = v; })} />
          <Num label="Maximum workforce" value={t.targets.maxWorkforce} onChange={(v) => set((d) => { d.targets.maxWorkforce = v; })} />
          <Num label="Maximum fleet" value={t.targets.maxFleet} onChange={(v) => set((d) => { d.targets.maxFleet = v; })} />
          <Num label="Maximum partner rate" value={t.targets.maxPartnerRate} prefix="AED" onChange={(v) => set((d) => { d.targets.maxPartnerRate = v; })} />
          <Num label="Acceptable risk (% of revenue)" value={t.targets.riskAppetite} step={0.5} onChange={(v) => set((d) => { d.targets.riskAppetite = v; })} />
          <div className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Feasible combinations</p>
            <p className="font-heading text-[15px] font-semibold text-white mt-1">
              {r.feasibility.filter((x) => x.pass).length} / {r.feasibility.length} checks pass
            </p>
            <div className="mt-1.5"><Bar pct={(r.feasibility.filter((x) => x.pass).length / r.feasibility.length) * 100} tone={r.feasibility.every((x) => x.pass) ? "good" : "warn"} /></div>
          </div>
        </div>
      </Panel>

      <Panel title="Audit log" subtitle="Every assumption change is traceable with its financial impact">
        {audit.length === 0 ? (
          <p className="text-[12px] text-white/45">No changes recorded in this session yet. Run the twin after editing an assumption to record the impact.</p>
        ) : (
          <Table>
            <thead><tr className="border-b border-[#26262b]"><Th>Change</Th><Th>From</Th><Th>To</Th><Th>Impact</Th><Th>By</Th><Th right>When</Th></tr></thead>
            <tbody>
              {audit.slice(0, 30).map((a) => (
                <tr key={a.id} className="border-b border-[#1e1e22]">
                  <Td>{a.field}</Td><Td>{a.from}</Td><Td>{a.to}</Td>
                  <Td><span className="text-white/60">{a.impact}</span></Td><Td>{a.by}</Td>
                  <Td right><span className="text-white/40">{new Date(a.at).toLocaleString("en-GB")}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <p className="text-[10px] text-white/30">
        Scenario copies are held in memory from the current twin; loading one overwrites the working assumptions.
        Use “Save twin” on the control bar to persist a version. {clone({ ok: 1 }) ? "" : ""}
      </p>
    </div>
  );
}
