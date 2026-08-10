import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const FUEL_PRICE = 3.49; // AED per litre — UAE, August 2026
const MILEAGE = 11; // km per litre (fleet standard)
const RED = ["#7f1d1d", "#991b1b", "#b91c1c", "#dc2626", "#ef4444", "#f87171"];

type Row = Record<string, string>;

interface Trip {
  ts: string;
  date: string;
  id: string;
  name: string;
  site: string;
  km: number | null;
  raw: string;
  link: string;
  flagged: boolean;
}

/** Parses "15KM", "170m", "3 km", "From Home to Site 1 -13KM", "45625" */
function parseKm(raw: string): { km: number | null; flagged: boolean } {
  const s = (raw || "").trim();
  if (!s) return { km: null, flagged: false };
  const m = s.match(/(\d+(?:\.\d+)?)\s*(km|kms|k|m|meters?|mtr)?\s*$/i)
    || s.match(/(\d+(?:\.\d+)?)\s*(km|kms|m)?/i);
  if (!m) return { km: null, flagged: true };
  let v = parseFloat(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "m" || unit.startsWith("meter") || unit === "mtr") v = v / 1000;
  if (!isFinite(v) || v <= 0) return { km: null, flagged: true };
  // Odometer readings / typos — a single field trip above 500 km is not credible
  if (v > 500) return { km: null, flagged: true };
  return { km: v, flagged: false };
}

function splitId(raw: string): { id: string; name: string } {
  const s = (raw || "").trim();
  const i = s.indexOf("-");
  if (i > 0) return { id: s.slice(0, i).trim(), name: s.slice(i + 1).trim() };
  return { id: s, name: "" };
}

function aed(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function km(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 1 });
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/70">{label}</p>
      <p className="text-lg font-semibold text-white leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-white/60">{sub}</p>}
    </div>
  );
}

export function FuelGovernance({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<string | null>(null);

  const trips: Trip[] = useMemo(() => {
    return rows.map((r) => {
      const rawId = r["Employee ID"] ?? "";
      const { id, name } = splitId(rawId);
      const rawKm = r["KMs Consumed"] ?? "";
      const { km: k, flagged } = parseKm(rawKm);
      const ts = r["Timestamp"] ?? "";
      return {
        ts, date: ts.split(" ")[0] || "",
        id: id || "Unknown", name,
        site: r["Home to site 01"] ?? "",
        km: k, raw: rawKm, flagged,
        link: r["Upload Map Screenshot"] ?? "",
      };
    }).filter((t) => t.id && t.id !== "Unknown");
  }, [rows]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of trips) if (t.name && (m.get(t.id) ?? "").length < t.name.length) m.set(t.id, t.name);
    return m;
  }, [trips]);

  const employees = useMemo(() => {
    const m = new Map<string, { id: string; name: string; trips: Trip[] }>();
    for (const t of trips) {
      const e = m.get(t.id) ?? { id: t.id, name: nameById.get(t.id) || t.id, trips: [] };
      e.trips.push(t);
      m.set(t.id, e);
    }
    return [...m.values()].map((e) => {
      const valid = e.trips.filter((t) => t.km !== null);
      const totalKm = valid.reduce((s, t) => s + (t.km as number), 0);
      const litres = totalKm / MILEAGE;
      return {
        ...e,
        totalKm, litres, amount: litres * FUEL_PRICE,
        tripCount: e.trips.length,
        flagged: e.trips.filter((t) => t.flagged).length,
        avgKm: valid.length ? totalKm / valid.length : 0,
      };
    }).sort((a, b) => b.totalKm - a.totalKm);
  }, [trips, nameById]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return employees;
    return employees.filter((e) => e.id.toLowerCase().includes(s) || e.name.toLowerCase().includes(s));
  }, [employees, q]);

  const totalKm = employees.reduce((s, e) => s + e.totalKm, 0);
  const totalLitres = totalKm / MILEAGE;
  const totalAmount = totalLitres * FUEL_PRICE;
  const flaggedCount = trips.filter((t) => t.flagged).length;

  const topChart = filtered.slice(0, 12).map((e) => ({ name: e.name || e.id, km: Math.round(e.totalKm * 10) / 10, amount: Math.round(e.amount) }));
  const payChart = [...filtered].sort((a, b) => b.amount - a.amount).slice(0, 12)
    .map((e) => ({ name: e.name || e.id, amount: Math.round(e.amount * 100) / 100 }));

  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trips) if (t.km !== null && t.date) m.set(t.date, (m.get(t.date) ?? 0) + t.km);
    return [...m.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([date, v]) => ({ date, km: Math.round(v * 10) / 10 }));
  }, [trips]);

  const active = employees.find((e) => e.id === detail);

  if (rows.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-white p-6 text-center text-xs text-muted-foreground">
        No fuel governance entries found in the source sheet yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-xl overflow-hidden border border-border bg-gradient-to-br from-[#7f1d1d] via-[#b91c1c] to-[#111] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">Fuel Governance</h2>
            <p className="text-[11px] text-white/70 mt-0.5">
              Employee-wise mileage reimbursement · Petrol AED {FUEL_PRICE.toFixed(2)}/litre (UAE, Aug 2026) · Fleet mileage {MILEAGE} km/litre
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full lg:w-auto">
            <KPI label="Employees" value={String(employees.length)} />
            <KPI label="Total Distance" value={`${km(totalKm)} km`} />
            <KPI label="Fuel Used" value={`${km(totalLitres)} L`} sub={`@ ${MILEAGE} km/L`} />
            <KPI label="Payable" value={`AED ${aed(totalAmount)}`} sub={`@ AED ${FUEL_PRICE}/L`} />
            <KPI label="Trips Logged" value={String(trips.length)} sub={flaggedCount ? `${flaggedCount} need review` : "all readings valid"} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input placeholder="Search employee or ID…" value={q} onChange={(e) => setQ(e.target.value)}
          className="h-9 px-3 text-sm border border-input rounded-md bg-white w-full sm:w-72" />
        <span className="text-[11px] text-muted-foreground">{filtered.length} of {employees.length} employees</span>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="border border-border rounded-lg bg-white p-3">
          <p className="text-xs font-semibold text-[#111] mb-2">Distance Travelled by Employee (km)</p>
          <ResponsiveContainer width="100%" height={Math.max(240, topChart.length * 28)}>
            <BarChart data={topChart} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} interval={0} />
              <Tooltip formatter={(v: number) => [`${km(v)} km`, "Distance"]} />
              <Bar dataKey="km" radius={[0, 4, 4, 0]}>
                {topChart.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                <LabelList dataKey="km" position="right" style={{ fontSize: 10, fill: "#111" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-border rounded-lg bg-white p-3">
          <p className="text-xs font-semibold text-[#111] mb-2">Amount Payable by Employee (AED)</p>
          <ResponsiveContainer width="100%" height={Math.max(240, payChart.length * 28)}>
            <BarChart data={payChart} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} interval={0} />
              <Tooltip formatter={(v: number) => [`AED ${aed(v)}`, "Payable"]} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {payChart.map((_, i) => <Cell key={i} fill={RED[(i + 2) % RED.length]} />)}
                <LabelList dataKey="amount" position="right" formatter={(v: number) => aed(v)} style={{ fontSize: 10, fill: "#111" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-white p-3">
        <p className="text-xs font-semibold text-[#111] mb-2">Daily Distance Trend (km)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={byDate} margin={{ left: 0, right: 16, top: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number) => [`${km(v)} km`, "Distance"]} />
            <Line type="monotone" dataKey="km" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }}>
              <LabelList dataKey="km" position="top" style={{ fontSize: 9, fill: "#111" }} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-[#111]">Employee-wise Fuel Reimbursement</span>
          <span className="text-[10px] text-muted-foreground">Litres = km ÷ {MILEAGE} · Payable = litres × AED {FUEL_PRICE}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                {["Employee ID", "Name", "Trips", "Total KM", "Avg KM/Trip", "Litres", "Payable (AED)", "Review", ""].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-secondary/50">
                  <td className="px-3 py-2 font-medium text-[#111]">{e.id}</td>
                  <td className="px-3 py-2">{e.name || "—"}</td>
                  <td className="px-3 py-2">{e.tripCount}</td>
                  <td className="px-3 py-2 font-semibold">{km(e.totalKm)} km</td>
                  <td className="px-3 py-2">{km(e.avgKm)} km</td>
                  <td className="px-3 py-2">{km(e.litres)} L</td>
                  <td className="px-3 py-2 font-semibold text-[#dc2626]">AED {aed(e.amount)}</td>
                  <td className="px-3 py-2">{e.flagged ? <span className="text-amber-700">{e.flagged} entry(s)</span> : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setDetail(e.id)} className="text-[#dc2626] hover:underline whitespace-nowrap">Trips &amp; proof</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-secondary/60 font-semibold text-[#111]">
                <td className="px-3 py-2" colSpan={3}>Total · {filtered.length} employees</td>
                <td className="px-3 py-2">{km(filtered.reduce((s, e) => s + e.totalKm, 0))} km</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">{km(filtered.reduce((s, e) => s + e.litres, 0))} L</td>
                <td className="px-3 py-2 text-[#dc2626]">AED {aed(filtered.reduce((s, e) => s + e.amount, 0))}</td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Trip detail with attachment links */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{active?.name || active?.id} · Trip Log</DialogTitle>
            <DialogDescription className="text-xs">
              {active && `${active.tripCount} trips · ${km(active.totalKm)} km · ${km(active.litres)} L · AED ${aed(active.amount)} payable`}
            </DialogDescription>
          </DialogHeader>
          <table className="w-full text-xs">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                {["Date / Time", "Site", "Logged", "KM", "Payable", "Attachment"].map((h) => (
                  <th key={h} className="text-left font-medium px-2 py-1.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active?.trips.map((t, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-2 py-1.5 whitespace-nowrap">{t.ts}</td>
                  <td className="px-2 py-1.5">{t.site || "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{t.raw || "—"}</td>
                  <td className="px-2 py-1.5">{t.km !== null ? `${km(t.km)} km` : <span className="text-amber-700">review</span>}</td>
                  <td className="px-2 py-1.5">{t.km !== null ? `AED ${aed((t.km / MILEAGE) * FUEL_PRICE)}` : "—"}</td>
                  <td className="px-2 py-1.5">
                    {t.link
                      ? <a href={t.link} target="_blank" rel="noopener noreferrer" className="text-[#dc2626] hover:underline">Open map proof</a>
                      : <span className="text-muted-foreground">none</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    </div>
  );
}
