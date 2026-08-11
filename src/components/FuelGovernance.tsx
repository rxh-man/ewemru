import { useMemo, useState } from "react";
import eandLogo from "@/assets/eand.png";
import { FuelAssistant } from "@/components/FuelAssistant";
import { FuelForecast } from "@/components/FuelForecast";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

const SUPER_98_PRICE = 3.49; // AED per litre — UAE, August 2026
const SPECIAL_95_PRICE = 3.29; // AED per litre — UAE, August 2026
const MILEAGE = 11; // km per litre (fleet standard)
// e& themed red spectrum — deep crimson to brand red
const RED = ["#4a0505", "#7a0a0a", "#a30f0f", "#c41212", "#e60000", "#ff4d4d"];

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

function toDate(s: string): Date | null {
  const t = (s || "").trim();
  if (!t) return null;
  // supports "8/5/2026" and "2026-08-05"
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = m ? new Date(+m[3], +m[1] - 1, +m[2]) : new Date(t);
  return isNaN(d.getTime()) ? null : d;
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FuelGovernance({ rows }: { rows: Row[] }) {
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const allTrips: Trip[] = useMemo(() => {
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

  const trips = useMemo(() => {
    if (!from && !to) return allTrips;
    const f = from ? new Date(from + "T00:00:00") : null;
    const t2 = to ? new Date(to + "T23:59:59") : null;
    return allTrips.filter((t) => {
      const d = toDate(t.date);
      if (!d) return false;
      if (f && d < f) return false;
      if (t2 && d > t2) return false;
      return true;
    });
  }, [allTrips, from, to]);

  const preset = (days: number | "month" | "all") => {
    const now = new Date();
    if (days === "all") { setFrom(""); setTo(""); return; }
    if (days === "month") {
      setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setTo(iso(now));
      return;
    }
    const start = new Date(now);
    start.setDate(start.getDate() - days + 1);
    setFrom(iso(start));
    setTo(iso(now));
  };


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
        totalKm, litres, amount: litres * SUPER_98_PRICE,
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
  const totalAmount = totalLitres * SUPER_98_PRICE;
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

  /** Monthly history from ALL trips (ignores the date filter) so the forecast always has full history. */
  const monthly = useMemo(() => {
    const m = new Map<string, { km: number; trips: number }>();
    for (const t of allTrips) {
      const d = toDate(t.date);
      if (!d || t.km === null) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = m.get(key) ?? { km: 0, trips: 0 };
      cur.km += t.km; cur.trips += 1;
      m.set(key, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({
        month,
        km: Math.round(v.km * 10) / 10,
        litres: Math.round((v.km / MILEAGE) * 10) / 10,
        amount: Math.round((v.km / MILEAGE) * SUPER_98_PRICE * 100) / 100,
        trips: v.trips,
      }));
  }, [allTrips]);

  const active = employees.find((e) => e.id === detail);

  const selectedRows = filtered.filter((e) => selected[e.id]);
  const approvalRows = selectedRows.length ? selectedRows : filtered;


  const aiDataset = useMemo(() => ({
    pricePerLitre: SUPER_98_PRICE,
    special95: SPECIAL_95_PRICE,
    kmPerLitre: MILEAGE,
    period: { from: from || "start", to: to || "latest" },
    totals: { employees: employees.length, totalKm: Math.round(totalKm * 10) / 10, litres: Math.round(totalLitres * 10) / 10, payableAed: Math.round(totalAmount * 100) / 100, trips: trips.length, needReview: flaggedCount },
    employees: employees.map((e) => ({
      id: e.id, name: e.name, trips: e.tripCount,
      totalKm: Math.round(e.totalKm * 10) / 10,
      avgKmPerTrip: Math.round(e.avgKm * 10) / 10,
      litres: Math.round(e.litres * 10) / 10,
      payableAed: Math.round(e.amount * 100) / 100,
      needReview: e.flagged,
      tripLog: e.trips.map((t) => ({ date: t.date, site: t.site, logged: t.raw, km: t.km, hasProof: !!t.link })),
    })),
    dailyKm: byDate,
  }), [employees, trips, byDate, from, to, totalKm, totalLitres, totalAmount, flaggedCount]);


  async function downloadApproval() {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const logoBytes = await fetch(eandLogo).then((r) => r.arrayBuffer());
    const logo = await doc.embedPng(logoBytes);
    const logoDims = logo.scale(48 / logo.height);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const RED_C = rgb(0.86, 0.15, 0.15);
    const DARK = rgb(0.07, 0.07, 0.07);
    const period = from || to ? `${from || "start"} to ${to || "today"}` : "All dates";

    let page = doc.addPage([595, 842]);
    let y = 0;
    const newPage = (first: boolean) => {
      if (!first) page = doc.addPage([595, 842]);
      page.drawRectangle({ x: 0, y: 762, width: 595, height: 80, color: rgb(0.29, 0.02, 0.02) });
      page.drawImage(logo, { x: 40, y: 778, width: logoDims.width, height: logoDims.height });
      const tx = 40 + logoDims.width + 18;
      page.drawText("Fuel Governance / Mileage Reimbursement Approval", { x: tx, y: 806, size: 13, font: bold, color: rgb(1, 1, 1) });
      page.drawText(`Period: ${period}   |   Super 98 AED ${SUPER_98_PRICE.toFixed(2)}/L   |   Mileage ${MILEAGE} km/L`,
        { x: tx, y: 788, size: 8, font, color: rgb(0.9, 0.9, 0.9) });
      y = 730;
      page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 20, color: rgb(0.96, 0.93, 0.93) });
      const heads: [string, number][] = [["Employee ID", 44], ["Name", 130], ["Trips", 280], ["Total KM", 325], ["Litres", 395], ["Payable (AED)", 455]];
      heads.forEach(([h, x]) => page.drawText(h, { x, y: y + 2, size: 8, font: bold, color: DARK }));
      y -= 18;
    };
    newPage(true);

    for (const e of approvalRows) {
      if (y < 150) newPage(false);
      const cells: [string, number][] = [
        [e.id, 44], [(e.name || "-").slice(0, 28), 130], [String(e.tripCount), 280],
        [km(e.totalKm), 325], [km(e.litres), 395], [aed(e.amount), 455],
      ];
      cells.forEach(([t, x]) => page.drawText(t, { x, y: y + 2, size: 8, font, color: DARK }));
      page.drawLine({ start: { x: 40, y: y - 3 }, end: { x: 555, y: y - 3 }, thickness: 0.4, color: rgb(0.87, 0.87, 0.87) });
      y -= 16;
    }

    if (y < 190) newPage(false);
    y -= 8;
    const tKm = approvalRows.reduce((s, e) => s + e.totalKm, 0);
    const tL = approvalRows.reduce((s, e) => s + e.litres, 0);
    const tA = approvalRows.reduce((s, e) => s + e.amount, 0);
    page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 20, color: rgb(0.96, 0.93, 0.93) });
    page.drawText(`Total: ${approvalRows.length} employees`, { x: 44, y: y + 2, size: 8, font: bold, color: DARK });
    page.drawText(km(tKm), { x: 325, y: y + 2, size: 8, font: bold, color: DARK });
    page.drawText(km(tL), { x: 395, y: y + 2, size: 8, font: bold, color: DARK });
    page.drawText(`AED ${aed(tA)}`, { x: 455, y: y + 2, size: 8, font: bold, color: RED_C });

    y -= 70;
    page.drawText("Approval", { x: 40, y, size: 10, font: bold, color: RED_C });
    y -= 40;
    [["Prepared by", 40], ["Reviewed by", 220], ["Approved by", 400]].forEach(([label, x]) => {
      page.drawLine({ start: { x: x as number, y }, end: { x: (x as number) + 140, y }, thickness: 0.8, color: DARK });
      page.drawText(String(label), { x: x as number, y: y - 12, size: 8, font, color: DARK });
      page.drawText("Name / Signature / Date", { x: x as number, y: y - 24, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
    });
    page.drawText(`Generated ${new Date().toLocaleString("en-AE")} | Delivery & Operations`,
      { x: 40, y: 40, size: 7, font, color: rgb(0.5, 0.5, 0.5) });

    const bytes = await doc.save();
    const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Fuel-Approval-${from || "all"}_${to || "all"}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }


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
      <div className="rounded-xl overflow-hidden border border-border bg-gradient-to-br from-[#4a0505] via-[#a30f0f] to-[#111] p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">Fuel Governance</h2>
            <p className="text-[11px] text-white/70 mt-0.5">
              Employee-wise mileage reimbursement · Super 98 AED {SUPER_98_PRICE.toFixed(2)}/L · Special 95 AED {SPECIAL_95_PRICE.toFixed(2)}/L (UAE, Aug 2026) · Fleet mileage {MILEAGE} km/L
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 w-full lg:w-auto">
            <KPI label="Employees" value={String(employees.length)} />
            <KPI label="Total Distance" value={`${km(totalKm)} km`} />
            <KPI label="Fuel Used" value={`${km(totalLitres)} L`} sub={`@ ${MILEAGE} km/L`} />
            <KPI label="Payable" value={`AED ${aed(totalAmount)}`} sub={`Super 98 @ AED ${SUPER_98_PRICE}/L`} />
            <KPI label="Trips Logged" value={String(trips.length)} sub={flaggedCount ? `${flaggedCount} need review` : "all readings valid"} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input placeholder="Search employee or ID…" value={q} onChange={(e) => setQ(e.target.value)}
          className="h-9 px-3 text-sm border border-input rounded-md bg-white w-full sm:w-72" />
        <div className="flex items-center gap-1.5 flex-wrap">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="h-9 px-2 text-xs border border-input rounded-md bg-white" />
          <span className="text-[11px] text-muted-foreground">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="h-9 px-2 text-xs border border-input rounded-md bg-white" />
          {([["All", "all"], ["7d", 7], ["30d", 30], ["This month", "month"]] as [string, number | "month" | "all"][]).map(([label, v]) => (
            <button key={label} onClick={() => preset(v)}
              className="h-9 px-2.5 text-[11px] font-medium rounded-md border border-border bg-white hover:bg-secondary">{label}</button>
          ))}
        </div>
        <button onClick={downloadApproval}
          className="h-9 px-3 rounded-md bg-[#dc2626] text-white text-[11px] font-semibold hover:opacity-90">
          Download Approval PDF{selectedRows.length ? ` (${selectedRows.length})` : ""}
        </button>
        <span className="text-[11px] text-muted-foreground">{filtered.length} of {employees.length} employees</span>
      </div>

      <FuelForecast
        history={monthly}
        price={SUPER_98_PRICE}
        mileage={MILEAGE}
        employees={employees.map((e) => ({ name: e.name || e.id, amount: e.amount }))}
        dataset={aiDataset}
      />

      <FuelAssistant dataset={aiDataset} />


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
          <span className="text-[10px] text-muted-foreground">Litres = km ÷ {MILEAGE} · Payable = litres × AED {SUPER_98_PRICE} (Super 98)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary text-muted-foreground">
              <tr>
                {["", "Employee ID", "Name", "Trips", "Total KM", "Avg KM/Trip", "Litres", "Payable (AED)", "Review", ""].map((h) => (
                  <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-secondary/50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={!!selected[e.id]}
                      onChange={(ev) => setSelected((s) => ({ ...s, [e.id]: ev.target.checked }))} />
                  </td>
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
                <td className="px-3 py-2" colSpan={4}>Total · {filtered.length} employees</td>
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
                  <td className="px-2 py-1.5">{t.km !== null ? `AED ${aed((t.km / MILEAGE) * SUPER_98_PRICE)}` : "—"}</td>
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
