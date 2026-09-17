import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AGENTS, AI_MODELS, HISTORY, MODEL_META, agentFindings, applyQuestion, compute, fmtM, fmtN, forecast,
  type Forecast, type Twin, type TwinResult,
} from "@/lib/twin";
import { Bar, Kpi, Panel, Table, Tag, Td, Th } from "./ui";

const AXIS = { stroke: "#5b5b66", fontSize: 10 };
const TIP = { background: "#141417", border: "1px solid #2c2c32", borderRadius: 8, fontSize: 11, color: "#fff" };

const SUGGESTED = [
  "What happens if the client increases the requirement to 50,000 meters?",
  "What happens if productivity drops by 20%?",
  "Can we complete this project in five months?",
  "What is the maximum reseller rate we can afford?",
  "What happens if rectification increases from 5% to 10%?",
  "What happens if fuel increases by 15%?",
  "What is the minimum client price required to maintain a 15% margin?",
];

export function TwinAI({
  t, r, f, model, setModel, onApply,
}: {
  t: Twin; r: TwinResult; f: Forecast; model: string;
  setModel: (m: string) => void; onApply: (twin: Twin, label: string) => void;
}) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<null | {
    label: string; notes: string[]; matched: boolean; twin: Twin; res: TwinResult;
  }>(null);

  const compare = useMemo(
    () => ["Statistical Forecast", "Regression Model", "Gradient Boosting", "Hybrid AI Model"].map((m) => forecast(t, m)),
    [t],
  );
  const agents = useMemo(() => agentFindings(t, r, f), [t, r, f]);
  const trend = useMemo(
    () => HISTORY.map((h) => ({ name: h.name.replace(/ (Phase|Deployment|Retrofit).*/, ""), productivity: h.productivity, margin: h.marginPct, rect: h.rectificationPct })),
    [],
  );

  function ask(question: string) {
    const w = applyQuestion(t, question);
    setAnswer({ label: question, notes: w.notes, matched: w.matched, twin: w.twin, res: compute(w.twin) });
    setQ("");
  }

  const delta = (a: number, b: number, unitLabel = "") => {
    const d = a - b;
    const sign = d > 0 ? "+" : "";
    return `${sign}${unitLabel === "AED" ? fmtM(d) : fmtN(d, 1)}${unitLabel === "%" ? " pts" : ""}`;
  };

  return (
    <div className="space-y-4">
      <Panel
        title="AI forecast engine"
        subtitle="The engine is replaceable — statistical, ML or LLM layers plug into the same twin"
        right={
          <select value={model} onChange={(e) => setModel(e.target.value)}
            className="h-8 px-2 rounded-md bg-[#0d0d0f] border border-[#2c2c32] text-[12px] text-white">
            {AI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Kpi label="Forecast cost" value={fmtM(f.cost)} sub={`Plan ${fmtM(r.totalCost)}`} />
          <Kpi label={`Forecast cost / ${t.project.unit.replace(/s$/, "")}`} value={`AED ${fmtN(f.costPerUnit)}`} />
          <Kpi label="Forecast margin" value={`${f.marginPct.toFixed(1)}%`} tone={f.marginPct >= t.targets.marginPct ? "good" : "warn"} />
          <Kpi label="Expected completion" value={new Date(f.completion).toLocaleDateString("en-GB")} sub={`${f.months.toFixed(1)} months`} />
          <Kpi label="Forecast workforce" value={fmtN(f.workforce)} sub={`${fmtN(f.monthlyCapacity)} ${t.project.unit}/month`} />
          <Kpi label="Forecast fleet" value={fmtN(f.fleetCount)} />
          <Kpi label="Expected rectification" value={`${f.rectificationPct.toFixed(1)}%`} tone={f.rectificationPct > 7 ? "warn" : "default"} />
          <Kpi label="Peak cash" value={fmtM(Math.abs(f.peakCash))} sub={`Burn ${fmtM(f.monthlyBurn)}/mo`} />
          <Kpi label="Break-even client price" value={`AED ${fmtN(f.breakEvenPrice)}`} />
          <Kpi label="Max partner rate" value={`AED ${fmtN(f.maxPartnerRate)}`} />
          <Kpi label="Schedule risk" value={`${f.scheduleRisk.toFixed(0)}%`} tone={f.scheduleRisk > 60 ? "bad" : f.scheduleRisk > 40 ? "warn" : "good"} />
          <Kpi label="Cost overrun risk" value={`${f.costRisk.toFixed(0)}%`} tone={f.costRisk > 60 ? "bad" : f.costRisk > 40 ? "warn" : "good"} />
        </div>

        <div className="mt-4 grid md:grid-cols-[220px_1fr] gap-4 items-start">
          <div className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Forecast confidence</p>
            <p className="font-heading text-2xl font-bold text-white mt-1">{f.confidence}%</p>
            <div className="mt-2"><Bar pct={f.confidence} tone={f.confidenceLabel === "High" ? "good" : f.confidenceLabel === "Medium" ? "warn" : "bad"} /></div>
            <p className="text-[11px] text-white/50 mt-2">{f.confidenceLabel} — this measures data and model coverage, not statistical certainty.</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#f87171]">Why this confidence?</p>
            <ul className="mt-1.5 space-y-1">
              {f.reasons.map((x) => <li key={x} className="text-[12px] text-white/70">· {x}</li>)}
            </ul>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              <Tag>{MODEL_META[model]?.engine ?? "Demo engine"}</Tag>
              <Tag>Training: {MODEL_META[model]?.training ?? "—"}</Tag>
              <Tag>Last trained: {MODEL_META[model]?.lastTrained ?? "—"}</Tag>
              <Tag>Coverage: {MODEL_META[model]?.coverage ?? "—"}</Tag>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="AI model comparison" subtitle="Same twin, four engines — see where they disagree">
          <Table>
            <thead>
              <tr className="border-b border-[#26262b]">
                <Th>Forecast</Th>{compare.map((c) => <Th key={c.model} right>{c.model.replace(" Forecast", "").replace(" Model", "")}</Th>)}
              </tr>
            </thead>
            <tbody>
              {([
                ["Cost", (c: Forecast) => fmtM(c.cost)],
                ["Duration (months)", (c: Forecast) => c.months.toFixed(1)],
                ["Workforce", (c: Forecast) => fmtN(c.workforce)],
                ["Rectification %", (c: Forecast) => c.rectificationPct.toFixed(1)],
                ["Margin %", (c: Forecast) => c.marginPct.toFixed(1)],
                ["Confidence %", (c: Forecast) => `${c.confidence}`],
              ] as [string, (c: Forecast) => string][]).map(([label, fn]) => (
                <tr key={label} className="border-b border-[#1e1e22]">
                  <Td>{label}</Td>{compare.map((c) => <Td key={c.model} right>{fn(c)}</Td>)}
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="text-[10px] text-white/35 mt-2">
            Tree-based and neural engines are not connected in this prototype; they run through a transparent demo simulation
            with capped confidence until a real model endpoint is configured.
          </p>
        </Panel>

        <Panel title="Project knowledge base" subtitle="Historical actuals used as reference data by the forecast engine">
          <Table>
            <thead>
              <tr className="border-b border-[#26262b]">
                <Th>Project</Th><Th right>Qty</Th><Th right>People</Th><Th right>Prod.</Th><Th right>Months</Th><Th right>Rect %</Th><Th right>Margin</Th>
              </tr>
            </thead>
            <tbody>
              {HISTORY.map((h) => (
                <tr key={h.name} className="border-b border-[#1e1e22]">
                  <Td>{h.name}<span className="block text-[10px] text-white/35">{h.client} · {h.year} · {h.region} · {h.complexity}</span></Td>
                  <Td right>{fmtN(h.quantity)}</Td><Td right>{h.workforce}</Td><Td right>{h.productivity}</Td>
                  <Td right>{h.durationMonths}</Td><Td right>{h.rectificationPct}</Td><Td right>{h.marginPct}%</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="h-40 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="#232329" vertical={false} />
                <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 9 }} />
                <YAxis tick={AXIS} />
                <Tooltip contentStyle={TIP} />
                <Line dataKey="productivity" stroke="#dc2626" strokeWidth={2} dot />
                <Line dataKey="margin" stroke="#22c55e" strokeWidth={2} dot />
                <Line dataKey="rect" stroke="#f59e0b" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-2 mt-1"><Tag tone="good">Historical actual</Tag><Tag tone="brand">Current simulation</Tag><Tag tone="warn">AI forecast</Tag></div>
        </Panel>
      </div>

      <Panel title="Ask the digital twin" subtitle="Type a what-if question — the twin recalculates and explains the impact">
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. What happens if the client increases the requirement to 50,000 meters?"
            className="flex-1 h-10 px-3 rounded-md bg-[#0d0d0f] border border-[#2c2c32] text-[13px] text-white outline-none focus:border-[#dc2626]" />
          <button type="submit" className="h-10 px-4 rounded-md bg-[#dc2626] text-white text-[12px] font-semibold hover:opacity-90">Simulate</button>
        </form>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {SUGGESTED.map((s) => (
            <button key={s} onClick={() => ask(s)} className="text-[10px] px-2 py-1 rounded-full border border-[#2f2f36] text-white/60 hover:border-[#dc2626] hover:text-white">{s}</button>
          ))}
        </div>

        {answer && (
          <div className="mt-4 rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-3.5">
            <p className="text-[12px] text-white/90 font-medium">{answer.label}</p>
            {!answer.matched && (
              <p className="text-[11px] text-[#fbbf24] mt-1">
                No quantitative change was recognised in that question. Reference figures below are the current twin.
                Try naming a number, a percentage, a rate, a duration or a quantity.
              </p>
            )}
            {answer.notes.length > 0 && (
              <ul className="mt-2 space-y-0.5">{answer.notes.map((n) => <li key={n} className="text-[11px] text-white/60">· {n}</li>)}</ul>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
              <Kpi label="Financial impact" value={fmtM(answer.res.grossProfit - r.grossProfit)} sub={`Gross profit ${fmtM(answer.res.grossProfit)}`} tone={answer.res.grossProfit >= r.grossProfit ? "good" : "bad"} />
              <Kpi label="Margin impact" value={`${delta(answer.res.marginPct, r.marginPct, "%")}`} sub={`${answer.res.marginPct.toFixed(1)}% forecast`} tone={answer.res.marginPct >= r.marginPct ? "good" : "bad"} />
              <Kpi label="Operational impact" value={`${delta(answer.res.workforce, r.workforce)} people`} sub={`${answer.res.workforce} total · ${answer.res.fleetCount} vehicles`} />
              <Kpi label="Schedule impact" value={`${delta(answer.res.requiredMonths, r.requiredMonths)} months`} sub={`${answer.res.requiredMonths.toFixed(1)} months required`} />
              <Kpi label="Cost impact" value={fmtM(answer.res.totalCost - r.totalCost)} sub={`Total ${fmtM(answer.res.totalCost)}`} />
              <Kpi label="Cash impact" value={fmtM(Math.abs(answer.res.peakCash) - Math.abs(r.peakCash))} sub={`Peak ${fmtM(Math.abs(answer.res.peakCash))}`} />
              <Kpi label="Risk impact" value={fmtM(answer.res.risks.reduce((a, x) => a + x.exposure, 0) - r.risks.reduce((a, x) => a + x.exposure, 0))} sub={`${answer.res.risks.length} risks`} tone="warn" />
              <Kpi label="Twin status" value={answer.res.status.label} tone={answer.res.status.level === "green" ? "good" : answer.res.status.level === "amber" ? "warn" : "bad"} />
            </div>
            <p className="text-[11px] text-white/55 mt-2.5">
              Assumptions held constant: pricing, cost library, payment terms and delivery model unless the question changed them.
            </p>
            {answer.matched && (
              <button onClick={() => onApply(answer.twin, answer.label)}
                className="mt-3 h-8 px-3 rounded-md border border-[#dc2626] text-[11px] text-white hover:bg-[#dc2626]/15">
                Apply this change to the twin
              </button>
            )}
          </div>
        )}
      </Panel>

      <Panel title="AI agent architecture" subtitle="Specialised agents read the same twin and report on their own domain">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {AGENTS.map((a) => (
            <div key={a.key} className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-3">
              <p className="font-heading text-[12.5px] font-semibold text-white">{a.name}</p>
              <p className="text-[10px] text-white/40">{a.role}</p>
              <ul className="mt-1.5 space-y-1">
                {(agents[a.key] ?? []).map((x) => <li key={x} className="text-[11px] text-white/70 leading-relaxed">· {x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
