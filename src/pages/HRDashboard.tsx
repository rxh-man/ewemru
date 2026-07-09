import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

type Row = Record<string, string>;
interface SheetData {
  poPr: Row[];
  paymentRelease: Row[];
  vendors: Row[];
  fetchedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  Red: "#dc2626",
  Yellow: "#eab308",
  Amber: "#f59e0b",
  Green: "#16a34a",
  Blue: "#2563eb",
};

const CHART_PALETTE = ["#dc2626", "#111827", "#eab308", "#2563eb", "#16a34a", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#0d9488"];

function splitOwners(raw: string): string[] {
  return raw.split(/[\n,;/]+/).map((s) => s.trim()).filter(Boolean);
}
function groupCount<T>(items: T[], keyFn: (t: T) => string | string[]): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = keyFn(it);
    const keys = Array.isArray(k) ? k : [k];
    for (const key of keys) {
      const clean = (key || "—").trim() || "—";
      m.set(clean, (m.get(clean) ?? 0) + 1);
    }
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
function isPending(r: Row): boolean {
  const status = (r.Status || "").toLowerCase();
  const blocker = (r.Blockers || "").toLowerCase();
  if (blocker.includes("block")) return true;
  return ["red", "amber", "yellow", "pending", "open", "in progress"].some((k) => status.includes(k));
}

export default function HRDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "po_pr" | "payment" | "vendors">("overview");

  // Filters
  const [fProject, setFProject] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "hr") { navigate("/hr-login"); return; }
    setSession(s);
  }, [navigate]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const { data: d, error } = await supabase.functions.invoke("sheet-data");
      if (error) throw error;
      setData(d as SheetData);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load sheet";
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (session) load(); /* eslint-disable-next-line */ }, [session]);

  const filtered = useMemo(() => {
    if (!data) return { poPr: [] as Row[], payment: [] as Row[], vendors: [] as Row[] };
    const q = search.trim().toLowerCase();
    const match = (r: Row) => {
      if (fProject && !(r["Project Name"] || "").toLowerCase().includes(fProject.toLowerCase())) return false;
      if (fVendor && !(r["Vendor Name"] || "").toLowerCase().includes(fVendor.toLowerCase())) return false;
      if (fOwner && !(r.Owner || "").toLowerCase().includes(fOwner.toLowerCase())) return false;
      if (fStatus && !(r.Status || "").toLowerCase().includes(fStatus.toLowerCase())) return false;
      if (q && !Object.values(r).some((v) => (v || "").toLowerCase().includes(q))) return false;
      return true;
    };
    return {
      poPr: data.poPr.filter(match),
      payment: data.paymentRelease.filter(match),
      vendors: data.vendors.filter((r) => {
        if (fProject && !(r["Project Name"] || "").toLowerCase().includes(fProject.toLowerCase())) return false;
        if (fVendor && !(r["Vendor Name"] || "").toLowerCase().includes(fVendor.toLowerCase())) return false;
        if (q && !Object.values(r).some((v) => (v || "").toLowerCase().includes(q))) return false;
        return true;
      }),
    };
  }, [data, fProject, fVendor, fOwner, fStatus, search]);

  const allActionable = useMemo(() => [...filtered.poPr, ...filtered.payment], [filtered]);
  const pending = useMemo(() => allActionable.filter(isPending), [allActionable]);

  const byProject = useMemo(() => groupCount(pending, (r) => r["Project Name"] || "—"), [pending]);
  const byOwner = useMemo(() => groupCount(pending, (r) => splitOwners(r.Owner || "—")), [pending]);
  const byVendor = useMemo(() => groupCount(pending, (r) => r["Vendor Name"] || "—"), [pending]);
  const byStatus = useMemo(() => groupCount(allActionable, (r) => r.Status || "—"), [allActionable]);
  const byCategory = useMemo(() => groupCount(pending, (r) => r["Action Category"] || "—"), [pending]);

  const uniqueProjects = useMemo(() => [...new Set([...(data?.poPr || []), ...(data?.paymentRelease || [])].map((r) => r["Project Name"]).filter(Boolean))], [data]);
  const uniqueOwners = useMemo(() => {
    const s = new Set<string>();
    [...(data?.poPr || []), ...(data?.paymentRelease || [])].forEach((r) => splitOwners(r.Owner || "").forEach((o) => s.add(o)));
    return [...s].sort();
  }, [data]);

  if (!session) return null;

  return (
    <AppShell session={session}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-[#111]">MR Tracker</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data?.fetchedAt ? `Synced ${new Date(data.fetchedAt).toLocaleTimeString()} — live from Google Sheet` : "Loading live data…"}
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-60">
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>

        {error && <div className="border border-destructive/40 bg-destructive/5 text-destructive text-xs rounded-md p-3">{error}</div>}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total Items" value={allActionable.length} tone="dark" />
          <KPI label="Pending / Blockers" value={pending.length} tone="red" />
          <KPI label="Projects Affected" value={new Set(pending.map((r) => r["Project Name"])).size} tone="amber" />
          <KPI label="Action Owners" value={new Set(pending.flatMap((r) => splitOwners(r.Owner || ""))).size} tone="dark" />
        </div>

        {/* Filters */}
        <div className="border border-border rounded-lg p-3 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-9 px-3 text-sm border border-input rounded-md bg-white col-span-2 md:col-span-1" />
            <select value={fProject} onChange={(e) => setFProject(e.target.value)} className="h-9 px-2 text-sm border border-input rounded-md bg-white">
              <option value="">All Projects</option>
              {uniqueProjects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} className="h-9 px-2 text-sm border border-input rounded-md bg-white">
              <option value="">All Owners</option>
              {uniqueOwners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input placeholder="Vendor…" value={fVendor} onChange={(e) => setFVendor(e.target.value)}
              className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-9 px-2 text-sm border border-input rounded-md bg-white">
              <option value="">All Status</option>
              {["Red", "Amber", "Yellow", "Green", "Blue"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {(fProject || fOwner || fVendor || fStatus || search) && (
            <button onClick={() => { setFProject(""); setFOwner(""); setFVendor(""); setFStatus(""); setSearch(""); }}
              className="mt-2 text-xs text-primary hover:underline">Clear all filters</button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border">
          {[
            { k: "overview", l: "Overview" },
            { k: "po_pr", l: `PO & PR (${filtered.poPr.length})` },
            { k: "payment", l: `Payment Release (${filtered.payment.length})` },
            { k: "vendors", l: `Vendors (${filtered.vendors.length})` },
          ].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k as typeof tab)}
              className={`px-3 h-9 text-xs font-medium border-b-2 -mb-px ${tab === t.k ? "border-primary text-[#111]" : "border-transparent text-muted-foreground hover:text-[#111]"}`}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Pending by Project">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byProject} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={130} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {byProject.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Pending by Action Owner">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byOwner.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dc2626" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Pending by Vendor (top 10)">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={byVendor.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="name" width={140} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#111827" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Status Breakdown">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                      {byStatus.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.name] || CHART_PALETTE[i % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Legend fontSize={11} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Pending by Action Category">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byCategory}>
                  <XAxis dataKey="name" fontSize={10} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/40 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#111]">All Blockers & Pending Items</h3>
                <span className="text-xs text-muted-foreground">{pending.length} items</span>
              </div>
              <PendingTable rows={pending} />
            </div>
          </div>
        )}

        {tab === "po_pr" && <SheetTable rows={filtered.poPr} columns={["#", "Project Name", "Vendor Name", "PR Number", "PR Amount", "Owner", "Status", "Action Category", "Remarks"]} />}
        {tab === "payment" && <SheetTable rows={filtered.payment} columns={["#", "Project Name", "Vendor Name", "Issue", "Owner", "Next Step", "Next Step Owner", "Status", "Remarks"]} />}
        {tab === "vendors" && <SheetTable rows={filtered.vendors} columns={["#", "Vendor Name", "Project Name", "Field / Support Type", "Contract Type", "Start Date", "End Date", "Contract Owner", "RAG Status"]} />}
      </div>
    </AppShell>
  );
}

function KPI({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "dark" }) {
  const bg = tone === "red" ? "bg-primary text-primary-foreground" : tone === "amber" ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-[#111] text-white";
  return (
    <div className={`${bg} rounded-lg p-4`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-white">
      <h3 className="text-sm font-semibold text-[#111] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const v = (value || "").trim();
  const color = STATUS_COLORS[v] || "#6b7280";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {v || "—"}
    </span>
  );
}

function PendingTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <div className="p-6 text-center text-xs text-muted-foreground">No pending items with current filters.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-secondary/40 text-[#111]">
          <tr>
            {["Project", "Vendor", "Owner", "Category / Issue", "Status", "Remarks"].map((h) => (
              <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top hover:bg-secondary/30">
              <td className="px-3 py-2 whitespace-nowrap">{r["Project Name"] || "—"}</td>
              <td className="px-3 py-2">{r["Vendor Name"] || "—"}</td>
              <td className="px-3 py-2 whitespace-pre-line">{r.Owner || "—"}</td>
              <td className="px-3 py-2 max-w-[340px] whitespace-pre-line">{r["Action Category"] || r.Issue || "—"}</td>
              <td className="px-3 py-2"><StatusPill value={r.Status} /></td>
              <td className="px-3 py-2 text-muted-foreground">{r.Remarks || r.Blockers || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SheetTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  if (!rows.length) return <div className="border border-border rounded-lg p-6 text-center text-xs text-muted-foreground">No rows.</div>;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 sticky top-0 z-[1]">
            <tr>
              {columns.map((c) => <th key={c} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border align-top hover:bg-secondary/30">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 whitespace-pre-line max-w-[300px]">
                    {c === "Status" || c === "RAG Status" ? <StatusPill value={r[c]} /> : (r[c] || "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
