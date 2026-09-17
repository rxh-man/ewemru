import { useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  DELIVERY_MODELS, LIFECYCLE, execBrief, fmtM, fmtN, planActual, sensitivity,
  type Forecast, type Twin, type TwinResult,
} from "@/lib/twin";
import { Bar, Kpi, Panel, Table, Tag, Td, Th } from "./ui";

export function TwinExec({
  t, r, f, onPhase,
}: { t: Twin; r: TwinResult; f: Forecast; onPhase: (p: string) => void }) {
  const brief = useMemo(() => execBrief(t, r, f), [t, r, f]);
  const pa = useMemo(() => planActual(t, r, f), [t, r, f]);
  const drivers = useMemo(() => sensitivity(t).slice(0, 3), [t]);
  const dm = DELIVERY_MODELS.find((d) => d.key === t.project.delivery)!;
  const statusTone = r.status.level === "green" ? "good" : r.status.level === "amber" ? "warn" : "bad";
  const dot = r.status.level === "green" ? "🟢" : r.status.level === "amber" ? "🟠" : "🔴";

  function exportBusinessCase() {
    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: (string | number)[][]) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name.slice(0, 31));

    add("Executive Summary", [
      ["SIMULATION DATA — NOT ACTUAL COMMERCIAL RATES"],
      ["Client", t.project.client], ["Project", t.project.projectName],
      ["Scope", `${t.project.quantity} ${t.project.unit}`], ["Delivery model", dm.name],
      ["Version", t.version], ["Scenario", t.scenario], ["Phase", t.phase],
      [], ["Revenue", r.revenue], ["Total cost", r.totalCost], ["Gross profit", r.grossProfit],
      ["Margin %", +r.marginPct.toFixed(2)], ["Cost per unit", +r.costPerUnit.toFixed(2)],
      ["Workforce", r.workforce], ["Fleet", r.fleetCount],
      ["Required months", +r.requiredMonths.toFixed(2)], ["Forecast completion", r.completion],
      ["Peak funding", Math.abs(r.peakCash)], ["Data quality %", r.dataQuality],
      ["Twin status", r.status.label], ...r.status.why.map((w) => ["Why", w]),
    ]);
    add("Financial Model", [
      ["Line", "AED"], ["Revenue", r.revenue], ["Partner cost", r.partnerCost], ["Labour", r.labour],
      ["Fleet", r.fleetCost], ...Object.entries(r.itemCost).map(([k, v]) => [k, v]),
      ["Corporate fees", r.fees], ["Contingency", r.contingency], ["Overhead", r.overhead],
      ["Total cost", r.totalCost], ["Gross profit", r.grossProfit], ["Margin %", +r.marginPct.toFixed(2)],
    ]);
    add("Cash Flow", [["Month", "Revenue", "Cost", "Net", "Cumulative"],
      ...r.cash.map((c) => [c.label, +c.revenue.toFixed(0), +c.cost.toFixed(0), +c.net.toFixed(0), +c.cumulative.toFixed(0)])]);
    add("BOQ & Cost Library", [["Category", "Item", "Unit", "Rate", "Qty", "Frequency", "Owner", "Source", "Confidence"],
      ...t.items.map((i) => [i.category, i.name, i.unit, i.rate, i.qty, i.freq, i.owner, i.source, i.confidence])]);
    add("Resources", [["Role", "Count"], ["Technicians", r.headcount.techs], ["Supervisors", r.headcount.sup],
      ["Engineers", r.headcount.eng], ["Coordinators", r.headcount.coord], ["QA/QC", r.headcount.qa],
      ["HSE", r.headcount.hse], ["Total", r.workforce], ["Vehicles", r.fleetCount]]);
    add("Risks", [["Risk", "Probability", "Impact AED", "Exposure AED", "Severity", "Mitigation", "Owner"],
      ...r.risks.map((x) => [x.name, x.probability, +x.impact.toFixed(0), +x.exposure.toFixed(0), x.severity, x.mitigation, x.owner])]);
    add("AI Forecast", [["Model", f.model], ["Cost", +f.cost.toFixed(0)], ["Cost/unit", +f.costPerUnit.toFixed(0)],
      ["Margin %", +f.marginPct.toFixed(2)], ["Months", +f.months.toFixed(2)], ["Workforce", f.workforce],
      ["Rectification %", +f.rectificationPct.toFixed(2)], ["Confidence %", f.confidence],
      ...f.reasons.map((x) => ["Basis", x])]);
    add("Sensitivity", [["Variable", "Margin swing (pts)", "Cost swing AED", "Duration swing (months)"],
      ...sensitivity(t).map((s) => [s.name, +s.marginSwing.toFixed(2), +s.costSwing.toFixed(0), +s.monthsSwing.toFixed(2)])]);
    add("Assumptions", [["Group", "Field", "Value"],
      ...Object.entries(t.pricing).map(([k, v]) => ["Pricing", k, v as number]),
      ...Object.entries(t.partner).map(([k, v]) => ["Partner", k, v as number | string]),
      ...Object.entries(t.productivity).map(([k, v]) => ["Productivity", k, v as number]),
      ...Object.entries(t.workforce).map(([k, v]) => ["Workforce", k, v as number]),
      ...Object.entries(t.fleet).map(([k, v]) => ["Fleet", k, v as number]),
      ...Object.entries(t.cash).map(([k, v]) => ["Cash", k, v as number]),
      ...Object.entries(t.targets).map(([k, v]) => ["Targets", k, v as number]),
    ]);
    XLSX.writeFile(wb, `Business_Case_${t.name.replace(/\s+/g, "_")}_${t.version}.xlsx`);
    toast.success("Business case exported");
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-[1.4fr_1fr] gap-4">
        <div className={`rounded-xl border border-[#26262b] bg-gradient-to-br from-[#1a0606] to-[#131316] p-5`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#f87171]">{t.project.client} — {t.project.category}</p>
          <h2 className="font-heading text-2xl font-bold text-white mt-1">{t.project.projectName}</h2>
          <p className="text-[12px] text-white/60 mt-1">
            {fmtN(t.project.quantity)} {t.project.unit} · {t.project.durationMonths}-month target · {t.project.region} · {dm.code} {dm.name}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Tag tone="brand">{t.version}</Tag>
            <Tag>{t.scenario}</Tag>
            <Tag>{t.phase}</Tag>
            <Tag tone={r.dataQuality >= 80 ? "good" : r.dataQuality >= 60 ? "warn" : "bad"}>Data quality {r.dataQuality}%</Tag>
          </div>
        </div>
        <div className={`rounded-xl border p-5 ${r.status.level === "green" ? "border-[#22c55e]/40 bg-[#22c55e]/[0.06]" : r.status.level === "amber" ? "border-[#f59e0b]/40 bg-[#f59e0b]/[0.06]" : "border-[#ef4444]/40 bg-[#ef4444]/[0.06]"}`}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Digital twin status</p>
          <p className="font-heading text-xl font-bold text-white mt-1">{dot} {r.status.label}</p>
          <ul className="mt-2 space-y-1">
            {r.status.why.map((w) => <li key={w} className="text-[11px] text-white/65 leading-relaxed">· {w}</li>)}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Kpi label="Contract value" value={fmtM(t.project.contractValue)} sub={t.project.contractType} />
        <Kpi label="Forecast revenue" value={fmtM(r.revenue)} sub={`AED ${fmtN(r.revenuePerUnit)}/${t.project.unit.replace(/s$/, "")}`} />
        <Kpi label="Forecast cost" value={fmtM(r.totalCost)} sub={`Burn ${fmtM(r.monthlyBurn)}/mo`} />
        <Kpi label="Forecast margin" value={`${r.marginPct.toFixed(1)}%`} tone={r.marginPct >= t.targets.marginPct ? "good" : r.marginPct > 0 ? "warn" : "bad"} sub={`Target ${t.targets.marginPct}%`} />
        <Kpi label={`Cost / ${t.project.unit.replace(/s$/, "")}`} value={`AED ${fmtN(r.costPerUnit)}`} sub={`Revenue AED ${fmtN(r.revenuePerUnit)}`} />
        <Kpi label="Workforce" value={fmtN(r.workforce)} sub={`${r.headcount.techs} technicians`} tone={r.workforce > t.targets.maxWorkforce ? "bad" : "default"} />
        <Kpi label="Fleet" value={fmtN(r.fleetCount)} sub={`${t.fleet.techPerVehicle} techs/vehicle`} tone={r.fleetCount > t.targets.maxFleet ? "bad" : "default"} />
        <Kpi label="Forecast completion" value={new Date(r.completion).toLocaleDateString("en-GB")} sub={`${r.requiredMonths.toFixed(1)} months required`} tone={r.requiredMonths > t.targets.scheduleMonths ? "warn" : "good"} />
        <Kpi label="Risk exposure" value={fmtM(r.risks.reduce((a, x) => a + x.exposure, 0))} sub={`${r.risks.length} open risks`} tone="warn" />
        <Kpi label="Cash requirement" value={fmtM(Math.abs(r.peakCash))} sub={`${t.cash.clientDays}-day client terms`} />
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        <Panel title="Digital twin architecture" subtitle="How the real project maps to the simulation">
          <div className="space-y-1.5">
            {[
              { k: "Client", v: `${t.project.client} — ${fmtN(t.project.quantity)} ${t.project.unit}` },
              { k: "e& project", v: `${t.project.projectName} · ${t.project.contractType} · ${t.project.currency}` },
              { k: "Delivery model", v: `${dm.name} — partner scope ${(t.partner.share * 100).toFixed(0)}%` },
              { k: "Field execution", v: `${r.headcount.techs} technicians · ${r.fleetCount} vehicles · ${fmtN(r.qtyEand)} ${t.project.unit} in-house` },
              { k: "Data", v: `Productivity ${t.productivity.perTechPerDay}/day · rectification ${(t.productivity.rectificationRate * 100).toFixed(1)}% · SLA ${t.project.slaTargetPct}%` },
              { k: "AI engine", v: `${f.model} · confidence ${f.confidence}% (${f.confidenceLabel})` },
              { k: "Executive output", v: `${fmtM(r.revenue)} revenue · ${fmtM(r.totalCost)} cost · ${r.marginPct.toFixed(1)}% margin · ${r.requiredMonths.toFixed(1)} months` },
            ].map((row, i, arr) => (
              <div key={row.k}>
                <div className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#f87171]">{row.k}</p>
                  <p className="text-[12px] text-white/80 mt-0.5">{row.v}</p>
                </div>
                {i < arr.length - 1 && <p className="text-center text-white/25 text-[11px] leading-none py-0.5">↓</p>}
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="What drives this project" subtitle="Top three assumptions by margin impact (±10%)">
            {drivers.map((d) => (
              <div key={d.name} className="mb-3 last:mb-0">
                <div className="flex justify-between text-[12px] text-white/80">
                  <span>{d.name}</span>
                  <span className="tabular-nums">{Math.abs(d.marginSwing).toFixed(1)} pts · {fmtM(Math.abs(d.costSwing))}</span>
                </div>
                <div className="mt-1"><Bar pct={(Math.abs(d.marginSwing) / Math.abs(drivers[0].marginSwing || 1)) * 100} /></div>
              </div>
            ))}
          </Panel>

          <Panel title="Digital twin lifecycle" subtitle="The same twin follows the project end to end">
            <div className="flex flex-wrap gap-1.5">
              {LIFECYCLE.map((p) => (
                <button key={p} onClick={() => onPhase(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border ${p === t.phase ? "border-[#dc2626] bg-[#dc2626]/15 text-white" : "border-[#2f2f36] text-white/55 hover:text-white"}`}>
                  {p}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Plan vs forecast vs actual" subtitle="Actuals are demo execution data — the variance feeds the learning loop">
        <Table>
          <thead><tr className="border-b border-[#26262b]"><Th>Metric</Th><Th right>Plan</Th><Th right>AI forecast</Th><Th right>Actual</Th><Th right>Variance</Th></tr></thead>
          <tbody>
            {pa.map((row) => {
              const v = row.plan ? ((row.actual - row.plan) / row.plan) * 100 : 0;
              const fmt = (n: number) => (row.unit === "AED" ? fmtM(n) : fmtN(n, 1) + (row.unit === "%" ? "%" : ""));
              return (
                <tr key={row.metric} className="border-b border-[#1e1e22]">
                  <Td>{row.metric}</Td><Td right>{fmt(row.plan)}</Td><Td right>{fmt(row.forecast)}</Td><Td right>{fmt(row.actual)}</Td>
                  <Td right><span className={v > 2 ? "text-[#f87171]" : v < -2 ? "text-[#fbbf24]" : "text-[#4ade80]"}>{v > 0 ? "+" : ""}{v.toFixed(1)}%</span></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>

      <Panel
        title="Executive project brief"
        subtitle="Generated from the current twin assumptions and the selected forecast model"
        right={
          <button onClick={exportBusinessCase}
            className="h-8 px-3 rounded-md bg-[#dc2626] text-white text-[11px] font-semibold hover:opacity-90">
            Generate business case
          </button>
        }
      >
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
          {brief.map((b) => (
            <div key={b.heading}>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#f87171]">{b.heading}</p>
              {b.lines.map((l) => <p key={l} className="text-[12px] text-white/75 leading-relaxed mt-1">{l}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/35 mt-4">
          Export includes executive summary, scope, delivery and commercial model, BOQ, resource plan, financial model,
          cash flow, risks, forecasts, sensitivity and assumptions. Use the browser print dialog for a PDF of this brief.
        </p>
      </Panel>
    </div>
  );
}
