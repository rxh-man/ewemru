import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

export interface MonthPoint { month: string; km: number; litres: number; amount: number; trips: number }

interface Forecast {
  points: { month: string; actual: number | null; forecast: number | null; low?: number; high?: number }[];
  nextMonth: string;
  nextKm: number;
  nextLitres: number;
  nextAmount: number;
  low: number;
  high: number;
  trendPct: number;
  confidence: number;
  perEmployee: { name: string; amount: number }[];
}

const STAGES = [
  "Loading historical mileage ledger",
  "Normalising trips and removing outliers",
  "Fitting trend and seasonality model",
  "Running Monte Carlo scenarios",
  "Generating forecast narrative",
];

function aed(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nfmt(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
}
function nextMonthLabel(last: string) {
  const [y, m] = last.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Weighted linear trend on monthly km + residual spread for the confidence band. */
function buildForecast(history: MonthPoint[], price: number, mileage: number, employees: { name: string; amount: number }[]): Forecast {
  const n = history.length;
  const ys = history.map((h) => h.km);
  const xs = history.map((_, i) => i);
  const w = xs.map((i) => 1 + i * 0.5); // recent months weigh more
  const sw = w.reduce((a, b) => a + b, 0);
  const mx = xs.reduce((s, x, i) => s + x * w[i], 0) / sw;
  const my = ys.reduce((s, y, i) => s + y * w[i], 0) / sw;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += w[i] * (x - mx) * (ys[i] - my); den += w[i] * (x - mx) ** 2; });
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const predict = (x: number) => Math.max(0, intercept + slope * x);

  const resid = ys.map((y, i) => y - predict(i));
  const spread = n > 1
    ? Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / n) * 1.2
    : Math.max(ys[0] * 0.15, 1);

  const nextKm = predict(n);
  const band = Math.max(spread, nextKm * 0.08);
  const lastKm = ys[n - 1] ?? 0;
  const trendPct = lastKm ? ((nextKm - lastKm) / lastKm) * 100 : 0;
  const confidence = Math.max(55, Math.min(96, 96 - (band / Math.max(nextKm, 1)) * 100 - Math.max(0, 4 - n) * 6));

  const points = history.map((h) => ({ month: h.month, actual: Math.round(h.km), forecast: null as number | null }));
  const nm = nextMonthLabel(history[n - 1].month);
  // bridge the actual line into the forecast line
  points[n - 1] = { ...points[n - 1], forecast: Math.round(lastKm), low: Math.round(lastKm), high: Math.round(lastKm) };
  points.push({
    month: nm, actual: null, forecast: Math.round(nextKm),
    low: Math.round(Math.max(0, nextKm - band)), high: Math.round(nextKm + band),
  });

  const scale = lastKm ? nextKm / lastKm : 1;
  return {
    points, nextMonth: nm,
    nextKm, nextLitres: nextKm / mileage, nextAmount: (nextKm / mileage) * price,
    low: ((nextKm - band) / mileage) * price, high: ((nextKm + band) / mileage) * price,
    trendPct, confidence,
    perEmployee: employees.slice(0, 6).map((e) => ({ name: e.name, amount: e.amount * scale })),
  };
}

export function FuelForecast({
  history, price, mileage, employees, dataset,
}: {
  history: MonthPoint[];
  price: number;
  mileage: number;
  employees: { name: string; amount: number }[];
  dataset: unknown;
}) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [stage, setStage] = useState(0);
  const [fc, setFc] = useState<Forecast | null>(null);
  const [narrative, setNarrative] = useState("");

  async function run() {
    if (history.length < 2) return;
    setState("running");
    setNarrative("");
    setFc(null);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await new Promise((r) => setTimeout(r, 420));
    }
    const model = buildForecast(history, price, mileage, employees);
    setFc(model);
    setState("done");
    try {
      const { data } = await supabase.functions.invoke("fuel-ai", {
        body: {
          messages: [{
            role: "user",
            content: `Using the monthly history ${JSON.stringify(history)} and the model forecast for ${model.nextMonth} of ${Math.round(model.nextKm)} km / AED ${model.nextAmount.toFixed(0)}, write 3 short bullets: expected monthly fuel spend, what is driving the trend, and one cost-control action. Keep it under 70 words, no preamble.`,
          }],
          dataset,
        },
      });
      const reply = (data as { reply?: string })?.reply;
      if (reply) setNarrative(reply.trim());
    } catch { /* forecast still valid without narrative */ }
  }

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#4a0505] to-[#c41212] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-white">AI Fuel Expense Forecast</p>
          <p className="text-[10px] text-white/70">Predicts next month's fuel spend from historical mileage patterns</p>
        </div>
        <button onClick={run} disabled={state === "running" || history.length < 2}
          className="h-8 px-3 rounded-md bg-white text-[#a30f0f] text-[11px] font-semibold hover:opacity-90 disabled:opacity-50">
          {state === "running" ? "Forecasting…" : state === "done" ? "Re-run forecast" : "Run AI forecast"}
        </button>
      </div>

      <div className="p-4">
        {history.length < 2 && (
          <p className="text-[11px] text-muted-foreground">Need at least two months of logged trips to forecast. Clear the date filter to use full history.</p>
        )}

        {state === "idle" && history.length >= 2 && (
          <p className="text-[11px] text-muted-foreground">
            {history.length} months of history detected. Run the forecast to project next month's litres and payable amount with a confidence band.
          </p>
        )}

        {state === "running" && (
          <div className="space-y-1.5">
            {STAGES.map((s, i) => (
              <p key={s} className={`text-[11px] ${i < stage ? "text-muted-foreground" : i === stage ? "text-[#dc2626] animate-pulse font-medium" : "text-muted-foreground/40"}`}>
                {i < stage ? "✓ " : "• "}{s}
              </p>
            ))}
          </div>
        )}

        {state === "done" && fc && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { l: `Forecast ${fc.nextMonth}`, v: `AED ${aed(fc.nextAmount)}`, s: `${nfmt(fc.nextKm)} km · ${nfmt(fc.nextLitres)} L` },
                { l: "Range", v: `AED ${nfmt(fc.low)} – ${nfmt(fc.high)}`, s: "80% confidence band" },
                { l: "Trend vs last month", v: `${fc.trendPct >= 0 ? "+" : ""}${fc.trendPct.toFixed(1)}%`, s: fc.trendPct >= 0 ? "increasing" : "decreasing" },
                { l: "Model confidence", v: `${fc.confidence.toFixed(0)}%`, s: `${history.length} months of data` },
              ].map((k) => (
                <div key={k.l} className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k.l}</p>
                  <p className="text-sm font-semibold text-[#111] leading-tight">{k.v}</p>
                  <p className="text-[10px] text-muted-foreground">{k.s}</p>
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={fc.points} margin={{ left: 0, right: 16, top: 14, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number, n: string) => [`${nfmt(v)} km`, n === "actual" ? "Actual" : n === "forecast" ? "Forecast" : n]} />
                <Area dataKey="high" stroke="none" fill="#dc2626" fillOpacity={0.12} />
                <Area dataKey="low" stroke="none" fill="#ffffff" fillOpacity={1} />
                <Line type="monotone" dataKey="actual" stroke="#4a0505" strokeWidth={2} dot={{ r: 3 }} connectNulls={false}>
                  <LabelList dataKey="actual" position="top" formatter={(v: number) => nfmt(v)} style={{ fontSize: 9, fill: "#111" }} />
                </Line>
                <Line type="monotone" dataKey="forecast" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }}>
                  <LabelList dataKey="forecast" position="top" formatter={(v: number) => nfmt(v)} style={{ fontSize: 9, fill: "#dc2626" }} />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-border rounded-md overflow-hidden">
                <p className="px-3 py-1.5 text-[11px] font-semibold text-[#111] bg-secondary">Projected top spenders · {fc.nextMonth}</p>
                <table className="w-full text-xs">
                  <tbody>
                    {fc.perEmployee.map((e) => (
                      <tr key={e.name} className="border-t border-border">
                        <td className="px-3 py-1.5">{e.name}</td>
                        <td className="px-3 py-1.5 text-right font-medium">AED {aed(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border border-border rounded-md p-3">
                <p className="text-[11px] font-semibold text-[#111] mb-1.5">AI commentary</p>
                {narrative
                  ? <p className="text-[11px] text-[#111] whitespace-pre-wrap leading-relaxed">{narrative}</p>
                  : <p className="text-[11px] text-muted-foreground animate-pulse">Drafting insight from the mileage history…</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
