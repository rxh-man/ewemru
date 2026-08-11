import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { InsightEmployee } from "@/components/FuelInsights";

type Sev = "high" | "medium" | "low";
interface Alert { sev: Sev; who: string; title: string; detail: string }

const SEV_STYLE: Record<Sev, string> = {
  high: "bg-[#4a0505] text-white",
  medium: "bg-[#dc2626] text-white",
  low: "bg-[#fee2e2] text-[#7a0a0a]",
};

export function FuelAlerts({ employees, dataset }: { employees: InsightEmployee[]; dataset: unknown }) {
  const [recs, setRecs] = useState("");
  const [busy, setBusy] = useState(false);

  const alerts = useMemo(() => {
    const out: Alert[] = [];
    for (const e of employees) {
      const who = e.name || e.id;
      const valid = e.trips.filter((t) => t.km !== null);

      // duplicate readings
      const counts = new Map<number, number>();
      for (const t of valid) counts.set(t.km as number, (counts.get(t.km as number) ?? 0) + 1);
      const dups = [...counts.entries()].filter(([, c]) => c > 1);
      if (dups.length) {
        out.push({
          sev: dups.some(([, c]) => c > 2) ? "high" : "medium",
          who,
          title: "Duplicate KM readings",
          detail: dups.slice(0, 3).map(([km, c]) => `${km} km logged ${c}x`).join(", "),
        });
      }

      // sudden surge vs own average
      const avg = valid.length ? valid.reduce((s, t) => s + (t.km as number), 0) / valid.length : 0;
      const surge = valid.filter((t) => avg > 0 && (t.km as number) >= avg * 2)
        .sort((a, b) => (b.km as number) - (a.km as number));
      if (surge.length) {
        out.push({
          sev: (surge[0].km as number) >= avg * 3 ? "high" : "medium",
          who,
          title: "Sudden KM surge",
          detail: `${Math.round(surge[0].km as number)} km on ${surge[0].date || "unknown date"} vs personal average ${Math.round(avg)} km${surge.length > 1 ? ` (+${surge.length - 1} more)` : ""}`,
        });
      }

      // entries needing review
      if (e.flagged) {
        out.push({ sev: "high", who, title: "Unreadable / implausible reading", detail: `${e.flagged} entr${e.flagged === 1 ? "y" : "ies"} marked for review` });
      }

      // missing proof
      const noProof = e.trips.filter((t) => !t.link).length;
      if (noProof && e.tripCount) {
        const pct = (noProof / e.tripCount) * 100;
        if (pct >= 40) out.push({ sev: pct >= 75 ? "medium" : "low", who, title: "Missing odometer proof", detail: `${noProof} of ${e.tripCount} trips without a photo (${pct.toFixed(0)}%)` });
      }
    }
    const rank: Record<Sev, number> = { high: 0, medium: 1, low: 2 };
    return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
  }, [employees]);

  const counts = {
    high: alerts.filter((a) => a.sev === "high").length,
    medium: alerts.filter((a) => a.sev === "medium").length,
    low: alerts.filter((a) => a.sev === "low").length,
  };

  async function recommend() {
    if (busy) return;
    setBusy(true);
    setRecs("");
    try {
      const { data } = await supabase.functions.invoke("fuel-ai", {
        body: {
          messages: [{
            role: "user",
            content: `These governance alerts were detected: ${JSON.stringify(alerts.slice(0, 25))}. Write 4 short markdown bullets of recommendations: who to challenge first, what evidence to request, one control to add to the process, and expected AED saving direction. Under 90 words, no preamble.`,
          }],
          dataset,
        },
      });
      const reply = (data as { reply?: string })?.reply;
      setRecs(reply?.trim() || "No recommendation returned.");
    } catch (e) {
      setRecs(`Could not generate recommendations: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#4a0505] to-[#c41212] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs font-semibold text-white">AI Alerts & Recommendations</p>
          <p className="text-[10px] text-white/70">Duplicate readings, KM surges, review flags and missing proof - with suggested actions</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/85">{counts.high} high · {counts.medium} medium · {counts.low} low</span>
          <button onClick={recommend} disabled={busy || !alerts.length}
            className="h-8 px-3 rounded-md bg-[#111] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50">
            {busy ? "Drafting…" : "Get recommendations"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!alerts.length && (
          <p className="text-[11px] text-muted-foreground">No governance alerts for the trips currently in view.</p>
        )}

        {alerts.length > 0 && (
          <div className="border border-border rounded-md overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-1.5 font-semibold">Severity</th>
                  <th className="px-3 py-1.5 font-semibold">Employee</th>
                  <th className="px-3 py-1.5 font-semibold">Alert</th>
                  <th className="px-3 py-1.5 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${SEV_STYLE[a.sev]}`}>{a.sev}</span>
                    </td>
                    <td className="px-3 py-1.5 font-medium text-[#111]">{a.who}</td>
                    <td className="px-3 py-1.5">{a.title}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{a.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(recs || busy) && (
          <div className="border border-border rounded-md p-3">
            <p className="text-[11px] font-semibold text-[#111] mb-1.5">Recommended actions</p>
            {recs
              ? <p className="text-[11px] text-[#111] whitespace-pre-wrap leading-relaxed">{recs}</p>
              : <p className="text-[11px] text-muted-foreground animate-pulse">Reviewing alerts against the ledger…</p>}
          </div>
        )}
      </div>
    </div>
  );
}
