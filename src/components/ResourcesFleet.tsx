import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";

type Row = {
  project: string;
  vendor: string;
  type: string;
  count: number;
  bcNo: string;
  poStart: string;
  poEnd: string;
  comments: string;
  temp: string;
  perm: string;
  priority: string;
  section: "outsourcing" | "fleet" | "transformResource" | "transformFleet";
};

const HEADER_TOKENS = ["project name", "vendors - os", "type", "count", "business case no"];

function parseDate(s: string): Date | null {
  if (!s || s === "?" ) return null;
  const t = s.trim();
  // formats like 1-Jan-26, 30-Jun-26
  const m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const [, d, mon, y] = m;
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const mi = months[mon.toLowerCase()];
    if (mi === undefined) return null;
    const yr = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(yr, mi, Number(d));
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function isReplacementRow(r: string[]): boolean {
  const joined = r.join(" ").toLowerCase();
  return joined.includes("replacement");
}

function parseFleet(raw: string[][]): { rows: Row[]; transformR: Row[]; transformF: Row[] } {
  const rows: Row[] = [];
  const transformR: Row[] = [];
  const transformF: Row[] = [];
  let section: Row["section"] | null = null;

  for (const r of raw) {
    if (!r || r.length === 0 || r.every((c) => !c || !c.trim())) continue;
    const first = (r[0] || "").trim();
    const firstLow = first.toLowerCase();
    if (firstLow.includes("iot project outsourcing")) { section = "outsourcing"; continue; }
    if (firstLow.includes("iot project fleet vendor")) { section = "fleet"; continue; }
    if (firstLow.includes("transformation plan to emind")) { section = "transformResource"; continue; }
    if (firstLow.includes("transformation plan to fleet")) { section = "transformFleet"; continue; }
    // Summary blocks at the bottom of the sheet — stop parsing register lines
    if (firstLow === "owner" || firstLow === "emind" || firstLow === "shared service") { section = null; continue; }
    // skip header rows
    if (HEADER_TOKENS.every((tok, i) => (r[i] || "").toLowerCase().includes(tok.split(" ")[0]))) continue;
    if (firstLow === "project name" || firstLow === "type") continue;
    if (!section) continue;

    // Replacement rows (e.g. Hertz / TAQA - Replacement) are informational — do not count in KPIs/tables
    if ((section === "outsourcing" || section === "fleet") && isReplacementRow(r)) continue;

    if (section === "transformFleet") {
      // 2-col block: Type | Count
      transformF.push({
        project: r[0] || "",
        vendor: "",
        type: r[0] || "",
        count: Number((r[1] || "").toString().replace(/[^\d.-]/g, "")) || 0,
        bcNo: "", poStart: "", poEnd: "", comments: "", temp: "", perm: "", priority: "",
        section,
      });
      continue;
    }

    const base: Row = {
      project: r[0] || "",
      vendor: r[1] || "",
      type: r[2] || "",
      count: Number((r[3] || "").toString().replace(/[^\d.-]/g, "")) || 0,
      bcNo: r[4] || "",
      poStart: r[5] || "",
      poEnd: r[6] || "",
      comments: r[7] || "",
      temp: r[8] || "",
      perm: r[9] || "",
      priority: r[10] || "",
      section,
    };
    if (section === "outsourcing" || section === "fleet") rows.push(base);
    else if (section === "transformResource") transformR.push(base);
  }
  return { rows, transformR, transformF };
}

const RED_PALETTE = ["#dc2626", "#ef4444", "#f87171", "#fca5a5", "#b91c1c", "#7f1d1d", "#991b1b", "#fecaca"];

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function expiryBadge(dLeft: number | null) {
  if (dLeft === null) return { label: "—", cls: "bg-secondary text-muted-foreground" };
  if (dLeft < 0) return { label: `Expired ${Math.abs(dLeft)}d ago`, cls: "bg-red-100 text-red-700 border border-red-200" };
  if (dLeft < 60) return { label: `${dLeft}d left`, cls: "bg-yellow-100 text-yellow-800 border border-yellow-200" };
  return { label: `${dLeft}d left`, cls: "bg-green-100 text-green-700 border border-green-200" };
}

export function ResourcesFleet({ fleetRaw }: { fleetRaw: string[][] }) {
  const { rows, transformR, transformF } = useMemo(() => parseFleet(fleetRaw || []), [fleetRaw]);
  const [filter, setFilter] = useState<"all" | "resource" | "fleet">("all");
  const [projectFilter, setProjectFilter] = useState<string>("");

  const filtered = useMemo(() => rows.filter((r) => {
    if (filter === "resource" && r.section !== "outsourcing") return false;
    if (filter === "fleet" && r.section !== "fleet") return false;
    if (projectFilter && !r.project.toLowerCase().includes(projectFilter.toLowerCase())) return false;
    return true;
  }), [rows, filter, projectFilter]);

  const totalResources = rows.filter((r) => r.section === "outsourcing").reduce((a, b) => a + b.count, 0);
  const totalFleet = rows.filter((r) => r.section === "fleet").reduce((a, b) => a + b.count, 0);
  const targetEmind = transformR.reduce((a, b) => a + b.count, 0);
  const fleetTargetShared = transformF.reduce((a, b) => a + b.count, 0);

  const byProject = useMemo(() => {
    const m = new Map<string, { resource: number; fleet: number }>();
    for (const r of rows) {
      const key = r.project || "—";
      const cur = m.get(key) || { resource: 0, fleet: 0 };
      if (r.section === "outsourcing") cur.resource += r.count;
      else if (r.section === "fleet") cur.fleet += r.count;
      m.set(key, cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v, total: v.resource + v.fleet }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const byVendor = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.vendor || "—", (m.get(r.vendor || "—") || 0) + r.count);
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const byPriority = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.priority || "—";
      m.set(k, (m.get(k) || 0) + r.count);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  const expiring = useMemo(() => rows
    .map((r) => ({ ...r, end: parseDate(r.poEnd), dLeft: daysUntil(parseDate(r.poEnd)) }))
    .filter((r) => r.dLeft !== null)
    .sort((a, b) => (a.dLeft as number) - (b.dLeft as number)), [rows]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#dc2626] text-white p-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">CBO Level · Live from sheet</div>
          <h2 className="text-2xl font-semibold mt-1">Resources &amp; Fleet</h2>
          <p className="text-xs opacity-80 mt-1 max-w-2xl">Outsourced resources and fleet units across IOT projects, transformation targets to eMind and Shared Service fleet.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <Kpi label="Total Resources (Outsourced)" value={totalResources} sub={`${rows.filter((r) => r.section === "outsourcing").length} contracts`} />
            <Kpi label="Total Fleet Units" value={totalFleet} sub={`${rows.filter((r) => r.section === "fleet").length} contracts`} />
            <Kpi label="Target · eMind Resources" value={targetEmind} sub="Transformation plan" />
            <Kpi label="Target · Shared Fleet" value={fleetTargetShared} sub="Fleet RFQ pool" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex border border-border rounded-md overflow-hidden bg-white">
          {([
            { k: "all", l: "All" },
            { k: "resource", l: "Resources" },
            { k: "fleet", l: "Fleet" },
          ] as const).map((t) => (
            <button key={t.k} onClick={() => setFilter(t.k)}
              className={`px-3 h-8 text-[11px] font-semibold border-r border-border last:border-r-0 ${filter === t.k ? "bg-[#dc2626] text-white" : "text-[#111] hover:bg-secondary"}`}>
              {t.l}
            </button>
          ))}
        </div>
        <input value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
          placeholder="Filter by project…"
          className="h-8 px-3 text-xs border border-input rounded-md bg-white w-56" />
        <div className="ml-auto text-[11px] text-muted-foreground">{filtered.length} rows · {filtered.reduce((a, b) => a + b.count, 0)} units</div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Units by Project (Resource vs Fleet)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byProject} layout="vertical" margin={{ left: 20, right: 30 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="resource" stackId="a" fill="#dc2626" name="Resource">
                <LabelList dataKey="resource" position="insideRight" fill="#fff" fontSize={10} />
              </Bar>
              <Bar dataKey="fleet" stackId="a" fill="#7f1d1d" name="Fleet">
                <LabelList dataKey="fleet" position="insideRight" fill="#fff" fontSize={10} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Units by Vendor">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byVendor} layout="vertical" margin={{ left: 20, right: 30 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#dc2626">
                <LabelList dataKey="value" position="right" fontSize={11} />
                {byVendor.map((_, i) => <Cell key={i} fill={RED_PALETTE[i % RED_PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Priority Split">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byPriority} dataKey="value" nameKey="name" outerRadius={80} label={{ fontSize: 11 }}>
                {byPriority.map((_, i) => <Cell key={i} fill={RED_PALETTE[i % RED_PALETTE.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Transformation to eMind · Target Resources">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={transformR.map((r) => ({ name: r.project, value: r.count }))}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#dc2626">
                <LabelList dataKey="value" position="top" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Expiry watch */}
      <div className="rounded-lg border border-border bg-white">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[#111]">PO Expiry Watch</div>
            <div className="text-[11px] text-muted-foreground">Ordered by soonest PO end date</div>
          </div>
        </div>
        <div className="max-h-[360px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Project</th>
                <th className="text-left px-3 py-2">Vendor</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Count</th>
                <th className="text-left px-3 py-2">PO End</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((r, i) => {
                const b = expiryBadge(r.dLeft);
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-[#111]">{r.project}</td>
                    <td className="px-3 py-2">{r.vendor}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.count}</td>
                    <td className="px-3 py-2">{r.poEnd || "—"}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.cls}`}>{b.label}</span></td>
                    <td className="px-3 py-2">{r.priority || "—"}</td>
                  </tr>
                );
              })}
              {expiring.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No dated POs found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full table */}
      <div className="rounded-lg border border-border bg-white">
        <div className="px-4 py-3 border-b border-border">
          <div className="text-xs font-semibold text-[#111]">Full Register</div>
          <div className="text-[11px] text-muted-foreground">Every line as it appears in the sheet · with temporary &amp; permanent solutions</div>
        </div>
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 sticky top-0 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Section</th>
                <th className="text-left px-3 py-2">Project</th>
                <th className="text-left px-3 py-2">Vendor</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Count</th>
                <th className="text-left px-3 py-2">BC No</th>
                <th className="text-left px-3 py-2">PO Start</th>
                <th className="text-left px-3 py-2">PO End</th>
                <th className="text-left px-3 py-2">Comments</th>
                <th className="text-left px-3 py-2">Temporary Solution</th>
                <th className="text-left px-3 py-2">Permanent Solution</th>
                <th className="text-left px-3 py-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-[10px] uppercase text-muted-foreground">{r.section === "outsourcing" ? "Resource" : "Fleet"}</td>
                  <td className="px-3 py-2 font-medium text-[#111]">{r.project}</td>
                  <td className="px-3 py-2">{r.vendor}</td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.count}</td>
                  <td className="px-3 py-2">{r.bcNo}</td>
                  <td className="px-3 py-2">{r.poStart}</td>
                  <td className="px-3 py-2">{r.poEnd}</td>
                  <td className="px-3 py-2 max-w-[220px]">{r.comments}</td>
                  <td className="px-3 py-2 max-w-[220px]">{r.temp}</td>
                  <td className="px-3 py-2 max-w-[220px]">{r.perm}</td>
                  <td className="px-3 py-2">{r.priority}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-6 text-center text-muted-foreground">No rows match your filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transformation plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-white p-4">
          <div className="text-xs font-semibold text-[#111]">Transformation Plan · to eMind</div>
          <div className="text-[11px] text-muted-foreground mb-3">Consolidation of outsourced resources under eMind</div>
          <div className="space-y-2">
            {transformR.map((r, i) => (
              <div key={i} className="flex items-center justify-between border border-border rounded-md px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-[#111]">{r.project}</div>
                  <div className="text-[10px] text-muted-foreground">{r.vendor} · {r.bcNo}</div>
                </div>
                <div className="text-lg font-semibold text-[#dc2626]">{r.count}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-white p-4">
          <div className="text-xs font-semibold text-[#111]">Transformation Plan · Fleet Shared Services</div>
          <div className="text-[11px] text-muted-foreground mb-3">Target consolidation of fleet under shared service RFQ</div>
          <div className="space-y-2">
            {transformF.map((r, i) => (
              <div key={i} className="flex items-center justify-between border border-border rounded-md px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-[#111]">{r.project || r.vendor}</div>
                </div>
                <div className="text-lg font-semibold text-[#dc2626]">{r.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/15">
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="text-xs font-semibold text-[#111] mb-2">{title}</div>
      {children}
    </div>
  );
}
