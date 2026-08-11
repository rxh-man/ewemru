import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell,
} from "recharts";

export interface InsightEmployee {
  id: string;
  name: string;
  totalKm: number;
  litres: number;
  amount: number;
  tripCount: number;
  flagged: number;
  avgKm: number;
  trips: { date: string; site?: string; raw?: string; km: number | null; link?: string }[];
}

const REDS = ["#4a0505", "#7a0a0a", "#a30f0f", "#c41212", "#dc2626", "#ef4444"];

function nfmt(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}
function aed(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FuelInsights({
  employees, price, mileage, dataset,
}: {
  employees: InsightEmployee[];
  price: number;
  mileage: number;
  dataset: unknown;
}) {
  const [open, setOpen] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [busy, setBusy] = useState(false);

  const m = useMemo(() => {
    const totalKm = employees.reduce((s, e) => s + e.totalKm, 0);
    const totalAmount = totalKm / mileage * price;
    const trips = employees.reduce((s, e) => s + e.tripCount, 0);
    const sorted = [...employees].sort((a, b) => b.totalKm - a.totalKm);
    const top5 = sorted.slice(0, 5).reduce((s, e) => s + e.totalKm, 0);
    const proof = employees.flatMap((e) => e.trips).filter((t) => t.link).length;
    let duplicates = 0;
    for (const e of employees) {
      const seen = new Map<string, number>();
      for (const t of e.trips) {
        if (t.km === null) continue;
        const k = String(t.km);
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
      duplicates += [...seen.values()].filter((c) => c > 1).length;
    }
    return {
      totalKm, totalAmount, trips,
      costPerKm: totalKm ? totalAmount / totalKm : 0,
      avgKmPerEmployee: employees.length ? totalKm / employees.length : 0,
      avgKmPerTrip: trips ? totalKm / trips : 0,
      concentration: totalKm ? (top5 / totalKm) * 100 : 0,
      proofPct: trips ? (proof / trips) * 100 : 0,
      duplicates,
      review: employees.reduce((s, e) => s + e.flagged, 0),
      chart: sorted.slice(0, 8).map((e, i) => ({
        name: e.name || e.id,
        amount: Math.round(e.amount),
        fill: REDS[i % REDS.length],
      })),
    };
  }, [employees, mileage, price]);

  async function run() {
    setOpen(true);
    if (narrative || busy) return;
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("fuel-ai", {
        body: {
          messages: [{
            role: "user",
            content: "Give exactly 4 short markdown bullets of consumption insights: efficiency of km per trip, spend concentration across employees, any consumption anomaly worth checking, and one efficiency action. Under 80 words, no preamble.",
          }],
          dataset,
        },
      });
      const reply = (data as { reply?: string })?.reply;
      setNarrative(reply?.trim() || "No insight returned.");
    } catch (e) {
      setNarrative(`Could not generate insight: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const kpis = [
    { l: "Cost per KM", v: `AED ${m.costPerKm.toFixed(3)}`, s: `${mileage} km/L at AED ${price.toFixed(2)}` },
    { l: "Avg KM per employee", v: nfmt(m.avgKmPerEmployee), s: `${employees.length} employees in view` },
    { l: "Avg KM per trip", v: nfmt(m.avgKmPerTrip), s: `${nfmt(m.trips)} trips logged` },
    { l: "Top 5 share of KM", v: `${m.concentration.toFixed(1)}%`, s: "spend concentration" },
    { l: "Proof attached", v: `${m.proofPct.toFixed(0)}%`, s: "trips with odometer photo" },
    { l: "Repeat readings", v: nfmt(m.duplicates), s: `${nfmt(m.review)} entries need review` },
  ];

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#4a0505] to-[#c41212] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-white">AI Consumption Insights</p>
          <p className="text-[10px] text-white/70">Efficiency, concentration and anomaly signals from the trips in view</p>
        </div>
        <button onClick={run} disabled={busy}
          className="h-8 px-3 rounded-md bg-[#111] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50">
          {busy ? "Analysing…" : open ? "Refresh insights" : "Generate insights"}
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</p>
              <p className="text-sm font-semibold text-[#111] leading-tight">{k.v}</p>
              <p className="text-[10px] text-muted-foreground">{k.s}</p>
            </div>
          ))}
        </div>

        {open && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-border rounded-md p-2">
              <p className="text-[11px] font-semibold text-[#111] px-1 pb-1">Payable concentration (AED)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={m.chart} margin={{ left: 0, right: 12, top: 14, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-18} textAnchor="end" height={44} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`AED ${aed(v)}`, "Payable"]} />
                  <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                    {m.chart.map((d) => <Cell key={d.name} fill={d.fill} />)}
                    <LabelList dataKey="amount" position="top" formatter={(v: number) => nfmt(v)} style={{ fontSize: 9, fill: "#111" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border border-border rounded-md p-3">
              <p className="text-[11px] font-semibold text-[#111] mb-1.5">AI commentary</p>
              {narrative
                ? <p className="text-[11px] text-[#111] whitespace-pre-wrap leading-relaxed">{narrative}</p>
                : <p className="text-[11px] text-muted-foreground animate-pulse">Reading the mileage ledger…</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
