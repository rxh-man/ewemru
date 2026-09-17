import { useMemo } from "react";
import { Area, AreaChart, Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  clone, compute, fmtM, fmtN, maxPartnerRate, minClientPrice,
  type Owner, type Twin, type TwinResult,
} from "@/lib/twin";
import { Kpi, Num, Panel, Range, Table, Tag, Td, Th, Txt } from "./ui";

type Set = (mut: (d: Twin) => void) => void;
const AXIS = { stroke: "#5b5b66", fontSize: 10 };
const TIP = { background: "#141417", border: "1px solid #2c2c32", borderRadius: 8, fontSize: 11, color: "#fff" };

export function TwinCommercial({ t, set, r }: { t: Twin; set: Set; r: TwinResult }) {
  const unit = t.project.unit.replace(/s$/, "");

  const rateCurve = useMemo(() => {
    const out: { rate: number; eand: number; partner: number; cost: number }[] = [];
    for (let rate = 250; rate <= 480; rate += 10) {
      const c = clone(t); c.partner.mode = "per_unit"; c.partner.perUnit = rate;
      const res = compute(c);
      out.push({
        rate,
        eand: +res.marginPct.toFixed(2),
        partner: +(((rate - rate * 0.78) / rate) * 100).toFixed(2),
        cost: +(res.totalCost / 1_000_000).toFixed(2),
      });
    }
    return out;
  }, [t]);

  const maxRate = useMemo(() => maxPartnerRate(t), [t]);
  const breakEvenRate = useMemo(() => maxPartnerRate(t, 0), [t]);
  const minPrice = useMemo(() => minClientPrice(t), [t]);
  const zeroPrice = useMemo(() => minClientPrice(t, 0), [t]);

  const pl = [
    ["Revenue", r.revenue, true],
    ["Partner / reseller cost", -r.partnerCost],
    ["Labour", -r.labour],
    ["Fleet", -r.fleetCost],
    ["Materials", -r.itemCost.Material],
    ["Equipment", -r.itemCost.Equipment],
    ["Technology", -r.itemCost.Technology],
    ["Operations", -r.itemCost.Operations],
    ["Management & governance", -r.itemCost.Management],
    ["Specialist vendors", -r.itemCost.Partner],
    ["Corporate fees (mgmt / gov / tech)", -r.fees],
    ["Contingency", -r.contingency],
    ["Corporate overhead", -r.overhead],
    ["Gross profit", r.grossProfit, true],
  ] as [string, number, boolean?][];

  function setOwner(name: string, owner: Owner) {
    set((d) => { const a = d.activities.find((x) => x.name === name); if (a) a.owner = owner; });
  }
  const partnerActivities = t.activities.filter((a) => a.owner !== "e&").length;

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Client pricing" subtitle={`What ${t.project.client} pays e& per ${unit}`}>
          <div className="grid grid-cols-2 gap-3">
            <Num label={`Price / ${unit}`} value={t.pricing.perUnit} prefix="AED" onChange={(v) => set((d) => { d.pricing.perUnit = v; })} />
            <Num label="Installation price" value={t.pricing.install} prefix="AED" onChange={(v) => set((d) => { d.pricing.install = v; })} />
            <Num label="Activation price" value={t.pricing.activation} prefix="AED" onChange={(v) => set((d) => { d.pricing.activation = v; })} />
            <Num label="Survey price" value={t.pricing.survey} prefix="AED" onChange={(v) => set((d) => { d.pricing.survey = v; })} />
            <Num label="Commissioning price" value={t.pricing.commissioning} prefix="AED" onChange={(v) => set((d) => { d.pricing.commissioning = v; })} />
            <Num label="Rectification price" value={t.pricing.rectification} prefix="AED" onChange={(v) => set((d) => { d.pricing.rectification = v; })} />
            <Num label={`Monthly service / ${unit}`} value={t.pricing.monthlyService} prefix="AED" onChange={(v) => set((d) => { d.pricing.monthlyService = v; })} />
            <Num label="SLA bonus (total)" value={t.pricing.slaBonus} prefix="AED" step={1000} onChange={(v) => set((d) => { d.pricing.slaBonus = v; })} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Kpi label="All-in unit revenue" value={`AED ${fmtN(r.revenuePerUnit)}`} />
            <Kpi label="Client revenue" value={fmtM(r.revenue)} sub={`${fmtN(t.project.quantity)} ${t.project.unit}`} />
            <Kpi label="Contract value entered" value={fmtM(t.project.contractValue)} />
          </div>
        </Panel>

        <Panel title="Reseller / partner model" subtitle={`Client → e& → partner. Partner delivers ${(t.partner.share * 100).toFixed(0)}% of scope`}>
          <div className="grid grid-cols-2 gap-3">
            <Txt label="Reseller pricing mode" value={t.partner.mode} onChange={(v) => set((d) => { d.partner.mode = v as Twin["partner"]["mode"]; })} options={["per_unit", "fixed", "percent_revenue"]} />
            <Num label={`Partner rate / ${unit}`} value={t.partner.perUnit} prefix="AED" onChange={(v) => set((d) => { d.partner.perUnit = v; })} />
            <Num label="Fixed / milestone fee" value={t.partner.fixedFee} prefix="AED" step={10000} onChange={(v) => set((d) => { d.partner.fixedFee = v; })} />
            <Num label="Percentage of revenue" value={t.partner.percentRevenue} suffix="%" onChange={(v) => set((d) => { d.partner.percentRevenue = v; })} />
            <Num label="Management fee" value={t.partner.mgmtFeePct} suffix="% rev" step={0.1} onChange={(v) => set((d) => { d.partner.mgmtFeePct = v; })} />
            <Num label="Governance fee" value={t.partner.govFeePct} suffix="% rev" step={0.1} onChange={(v) => set((d) => { d.partner.govFeePct = v; })} />
            <Num label="Technology / platform fee" value={t.partner.techFeePct} suffix="% rev" step={0.1} onChange={(v) => set((d) => { d.partner.techFeePct = v; })} />
            <Num label="Contingency" value={t.partner.contingencyPct} suffix="% direct" step={0.5} onChange={(v) => set((d) => { d.partner.contingencyPct = v; })} />
            <Num label="Corporate overhead" value={t.partner.overheadPct} suffix="% direct" step={0.5} onChange={(v) => set((d) => { d.partner.overheadPct = v; })} />
          </div>
          <div className="mt-4">
            <Range label="Partner scope share" value={Math.round(t.partner.share * 100)} min={0} max={100} onChange={(v) => set((d) => { d.partner.share = v / 100; })} format={(v) => `${v}%`} />
          </div>
          <div className="mt-4">
            <Range label={`Partner rate (AED / ${unit})`} value={t.partner.perUnit} min={250} max={480} step={5} onChange={(v) => set((d) => { d.partner.perUnit = v; })} format={(v) => `AED ${v}`} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Kpi label="Client revenue" value={fmtM(r.revenue)} sub={`${fmtN(t.project.quantity)} × AED ${fmtN(r.revenuePerUnit)}`} />
            <Kpi label="Partner cost" value={fmtM(r.partnerCost)} sub={`${fmtN(r.qtyPartner)} × AED ${fmtN(t.partner.perUnit)}`} />
            <Kpi label="e& gross contribution" value={fmtM(r.partnerEconomics.eandContribution)} sub="Revenue − partner cost" />
            <Kpi label="Net project contribution" value={fmtM(r.grossProfit)} tone={r.grossProfit > 0 ? "good" : "bad"} sub="After all e& cost layers" />
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <Panel title="Reseller margin simulator" subtitle="Move the partner rate and watch both sides of the deal">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rateCurve} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#232329" vertical={false} />
                <XAxis dataKey="rate" tick={AXIS} />
                <YAxis tick={AXIS} />
                <Tooltip contentStyle={TIP} formatter={(v: number, n: string) => [n === "cost" ? `AED ${v}M` : `${v}%`, n === "eand" ? "e& margin" : n === "partner" ? "Partner margin" : "Total cost"]} />
                <Line type="monotone" dataKey="eand" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="partner" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <Kpi label="Partner revenue" value={fmtM(r.partnerEconomics.partnerRevenue)} />
            <Kpi label="Partner cost (simulated)" value={fmtM(r.partnerEconomics.partnerCost)} />
            <Kpi label="Partner gross margin" value={`${r.partnerEconomics.partnerMargin.toFixed(1)}%`} />
            <Kpi label="Total project margin" value={`${r.marginPct.toFixed(1)}%`} tone={r.marginPct >= t.targets.marginPct ? "good" : "warn"} />
          </div>
          <p className="text-[10px] text-white/35 mt-2">Partner internal cost is simulated at 78% of the partner rate for illustration only.</p>
        </Panel>

        <Panel title="Commercial break-even engine" subtitle="Solved numerically against the current assumptions">
          <div className="space-y-2.5">
            <div className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Maximum partner rate</p>
              <p className="font-heading text-lg font-semibold text-white">AED {fmtN(maxRate)} / {unit}</p>
              <p className="text-[11px] text-white/50">Highest rate e& can pay while holding a {t.targets.marginPct}% margin. Current rate AED {fmtN(t.partner.perUnit)} — headroom AED {fmtN(maxRate - t.partner.perUnit)}.</p>
            </div>
            <div className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Zero-margin partner rate</p>
              <p className="font-heading text-lg font-semibold text-white">AED {fmtN(breakEvenRate)} / {unit}</p>
              <p className="text-[11px] text-white/50">Above this rate the project loses money.</p>
            </div>
            <div className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Minimum client price</p>
              <p className="font-heading text-lg font-semibold text-white">AED {fmtN(minPrice)} / {unit}</p>
              <p className="text-[11px] text-white/50">Base price required for a {t.targets.marginPct}% margin (excludes the AED {fmtN(t.pricing.install + t.pricing.activation + t.pricing.survey + t.pricing.commissioning)} of add-on prices). Break-even price AED {fmtN(zeroPrice)}.</p>
            </div>
            <Num label="Target margin used above" value={t.targets.marginPct} suffix="%" step={0.5} onChange={(v) => set((d) => { d.targets.marginPct = v; })} />
          </div>
        </Panel>
      </div>

      <Panel title="Reseller activity mapping" subtitle={`Click any cell to move ownership — ${partnerActivities} of ${t.activities.length} activities sit outside e&`}>
        <Table>
          <thead><tr className="border-b border-[#26262b]"><Th>Activity</Th><Th>e&</Th><Th>Reseller</Th><Th>Subcontractor</Th></tr></thead>
          <tbody>
            {t.activities.map((a) => (
              <tr key={a.name} className="border-b border-[#1e1e22]">
                <Td>{a.name}</Td>
                {(["e&", "Reseller", "Subcontractor"] as Owner[]).map((o) => (
                  <Td key={o}>
                    <button onClick={() => setOwner(a.name, o)}
                      className={`h-6 w-9 rounded border text-[12px] ${a.owner === o ? "border-[#dc2626] bg-[#dc2626]/20 text-white" : "border-[#2c2c32] text-white/25 hover:border-[#3d3d45]"}`}>
                      {a.owner === o ? "✓" : ""}
                    </button>
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="text-[10px] text-white/35 mt-3">
          Ownership drives the operational narrative; the financial split is set by the partner scope share and pricing mode above.
        </p>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Financial digital twin" subtitle="Project P&L simulation">
          <Table>
            <tbody>
              {pl.map(([label, value, bold]) => (
                <tr key={label} className={`border-b border-[#1e1e22] ${bold ? "bg-white/[0.03]" : ""}`}>
                  <Td className={bold ? "font-semibold" : ""}>{label}</Td>
                  <Td right className={bold ? "font-semibold" : ""}>{fmtM(value)}</Td>
                  <Td right><span className="text-white/40">{r.revenue ? ((Math.abs(value) / r.revenue) * 100).toFixed(1) : "0"}%</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Kpi label="Gross margin" value={`${r.marginPct.toFixed(1)}%`} tone={r.marginPct >= t.targets.marginPct ? "good" : "warn"} />
            <Kpi label={`Cost / ${unit}`} value={`AED ${fmtN(r.costPerUnit)}`} />
            <Kpi label="Break-even revenue" value={fmtM(r.totalCost)} />
            <Kpi label="Cash requirement" value={fmtM(Math.abs(r.peakCash))} />
          </div>
        </Panel>

        <Panel title="Cash flow simulation" subtitle={`Client terms ${t.cash.clientDays} days · partner terms ${t.cash.partnerDays} days · advance ${t.cash.advancePct}%`}>
          <div className="grid grid-cols-3 gap-3">
            <Num label="Client payment days" value={t.cash.clientDays} step={15} onChange={(v) => set((d) => { d.cash.clientDays = v; })} />
            <Num label="Partner payment days" value={t.cash.partnerDays} step={15} onChange={(v) => set((d) => { d.cash.partnerDays = v; })} />
            <Num label="Mobilisation advance %" value={t.cash.advancePct} onChange={(v) => set((d) => { d.cash.advancePct = v; })} />
          </div>
          <div className="h-44 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r.cash.map((c) => ({ ...c, cum: c.cumulative / 1_000_000 }))} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#232329" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} />
                <YAxis tick={AXIS} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [`AED ${v.toFixed(2)}M`, "Cumulative cash"]} />
                <Area type="monotone" dataKey="cum" stroke="#dc2626" fill="#dc2626" fillOpacity={0.18} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-32 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.cash.map((c) => ({ label: c.label, net: +(c.net / 1_000_000).toFixed(2) }))} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#232329" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} />
                <YAxis tick={AXIS} />
                <Tooltip contentStyle={TIP} formatter={(v: number) => [`AED ${v.toFixed(2)}M`, "Net cash"]} />
                <RBar dataKey="net" fill="#3b82f6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Kpi label="Peak funding requirement" value={fmtM(Math.abs(r.peakCash))} tone="warn" />
            <Kpi label="Monthly burn" value={fmtM(r.monthlyBurn)} />
            <Kpi label="Closing cash" value={fmtM(r.cash[r.cash.length - 1]?.cumulative ?? 0)} tone={(r.cash[r.cash.length - 1]?.cumulative ?? 0) > 0 ? "good" : "bad"} />
          </div>
          <div className="mt-2"><Tag tone="warn">Reseller scenarios pay the partner before client settlement</Tag></div>
        </Panel>
      </div>
    </div>
  );
}
