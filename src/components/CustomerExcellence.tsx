import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

type DocStatus = "complete" | "missing" | "pending";
type Doc = { name: string; status: DocStatus; raw: string; display: string; critical?: boolean };

type CsRow = Record<string, string>;

const DOC_COLS: { key: string; critical?: boolean }[] = [
  { key: "Business Case", critical: true },
  { key: "Proposal" },
  { key: "Commercials", critical: true },
  { key: "Vendor Evaluation" },
  { key: "SOW", critical: true },
  { key: "Compliance", critical: true },
];

// Per-project enhancement / opportunity notes (manually curated)
const PROJECT_NOTES: Record<string, string[]> = {
  "adcb::field": [
    "Introduce automation using AI agents in the ADCB call center",
    "Remote provisioning to reduce field deployment from 48 hours to 1 hour",
  ],
  "dubai frame::field": [
    "Introduce computer vision solutions for visitor flow analytics",
    "Explore AI-based crowd density and safety monitoring ideas",
  ],
};

function parseDoc(val: string | undefined): { status: DocStatus; display: string; raw: string } {
  const raw = (val ?? "").toString();
  const v = raw.trim();
  if (!v) return { status: "pending", display: "To be submitted", raw };
  const l = v.toLowerCase();
  if (l === "y" || l === "yes" || l === "complete" || l === "done") return { status: "complete", display: "Complete", raw };
  if (l === "n" || l === "no" || l === "missing") return { status: "pending", display: "To be submitted", raw };
  if (l === "expired") return { status: "missing", display: "Expired", raw };
  // Any other free-text value from the sheet is shown verbatim and treated as pending
  return { status: "pending", display: v, raw };
}


function parseDMY(s: string | undefined): Date | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const [, dd, mm, yy] = m;
  const year = yy.length === 2 ? 2000 + parseInt(yy) : parseInt(yy);
  return new Date(year, parseInt(mm) - 1, parseInt(dd));
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}

type VendorEntry = {
  vendor: string;
  docs: Doc[];
  contractDate: string;
  contractExpiry: string;
  contractDaysLeft: number | null;
  poNumber: string;
  poDate: string;
  poExpiry: string;
  poDaysLeft: number | null;
  missingCritical: number;
  missingAny: number;
};

type CustomerProject = {
  id: string;
  customer: string;
  scope: string;
  vendors: VendorEntry[];
  earliestContractDaysLeft: number | null;
  earliestPoDaysLeft: number | null;
  totalMissing: number;
  totalCriticalMissing: number;
  hasData: boolean;
};

function buildVendorEntry(r: CsRow): VendorEntry {
  const docs: Doc[] = DOC_COLS.map((c) => {
    const p = parseDoc(r[c.key]);
    return { name: c.key, status: p.status, display: p.display, raw: p.raw, critical: c.critical };
  });
  const now = new Date();
  const cExp = parseDMY(r["Customer Contract Expiry"] ?? r["Contract Expiry"]);
  const pExp = parseDMY(r["Vendor PO Expiry"] ?? r["PO Expiry"]);
  const cDaysSheet = parseInt((r["Days to Contract Expiry"] ?? "").trim());
  const pDaysSheet = parseInt((r["Days to Vendor PO Expiry"] ?? "").trim());
  return {
    vendor: (r["Vendor"] ?? "").trim(),
    docs,
    contractDate: (r["Customer Contract Date"] ?? r["Contract Date"] ?? "").trim(),
    contractExpiry: (r["Customer Contract Expiry"] ?? r["Contract Expiry"] ?? "").trim(),
    contractDaysLeft: cExp ? daysBetween(cExp, now) : (Number.isFinite(cDaysSheet) ? cDaysSheet : null),
    poNumber: (r["Vender PO Number"] ?? r["Vendor PO Number"] ?? r["PO Number"] ?? "").trim(),
    poDate: (r["Vendor PO Date"] ?? r["PO Date"] ?? "").trim(),
    poExpiry: (r["Vendor PO Expiry"] ?? r["PO Expiry"] ?? "").trim(),
    poDaysLeft: pExp ? daysBetween(pExp, now) : (Number.isFinite(pDaysSheet) ? pDaysSheet : null),
    missingCritical: docs.filter((d) => d.critical && d.status !== "complete").length,
    missingAny: docs.filter((d) => d.status !== "complete").length,
  };
}

function buildProjects(rows: CsRow[]): CustomerProject[] {
  const map = new Map<string, CustomerProject>();
  for (const r of rows) {
    const customer = (r["Customer/Vendor"] ?? "").trim();
    const scope = (r["Scope"] ?? "").trim();
    if (!customer) continue;
    const key = `${customer}::${scope}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key.replace(/\s+/g, "-").toLowerCase(),
        customer, scope,
        vendors: [],
        earliestContractDaysLeft: null,
        earliestPoDaysLeft: null,
        totalMissing: 0,
        totalCriticalMissing: 0,
        hasData: false,
      });
    }
    const p = map.get(key)!;
    if ((r["Vendor"] ?? "").trim()) {
      const v = buildVendorEntry(r);
      p.vendors.push(v);
      p.hasData = true;
      p.totalMissing += v.missingAny;
      p.totalCriticalMissing += v.missingCritical;
      if (v.contractDaysLeft !== null) {
        p.earliestContractDaysLeft = p.earliestContractDaysLeft === null
          ? v.contractDaysLeft : Math.min(p.earliestContractDaysLeft, v.contractDaysLeft);
      }
      if (v.poDaysLeft !== null) {
        p.earliestPoDaysLeft = p.earliestPoDaysLeft === null
          ? v.poDaysLeft : Math.min(p.earliestPoDaysLeft, v.poDaysLeft);
      }
    }
  }
  return [...map.values()];
}

function status(p: CustomerProject): "green" | "yellow" | "red" | "gray" {
  if (!p.hasData) return "gray";
  if (p.totalCriticalMissing > 0) return "red";
  const cd = p.earliestContractDaysLeft;
  const pd = p.earliestPoDaysLeft;
  if ((cd !== null && cd < 0) || (pd !== null && pd < 0)) return "red";
  if ((cd !== null && cd < 60) || (pd !== null && pd < 60) || p.totalMissing > 0) return "yellow";
  return "green";
}

const STATUS_META = {
  green: { dot: "bg-emerald-500", label: "Healthy", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  yellow: { dot: "bg-amber-500", label: "Watch", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  red: { dot: "bg-red-600", label: "Critical", text: "text-red-700", bg: "bg-red-50 border-red-200" },
  gray: { dot: "bg-slate-400", label: "Awaiting data", text: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
} as const;

export function CustomerExcellence() {
  const [rows, setRows] = useState<CsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CustomerProject | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "green" | "yellow" | "red" | "gray">("all");
  const [scopeFilter, setScopeFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"days" | "status" | "name">("days");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("sheet-data");
      if (error) { setError(error.message); setLoading(false); return; }
      setRows(((data as { cs?: CsRow[] })?.cs) ?? []);
      setLoading(false);
    })();
  }, []);

  const projects = useMemo(() => buildProjects(rows), [rows]);
  const scopes = useMemo(() => [...new Set(projects.map((p) => p.scope).filter(Boolean))], [projects]);
  const vendors = useMemo(() => [...new Set(projects.flatMap((p) => p.vendors.map((v) => v.vendor)))], [projects]);

  const filtered = useMemo(() => {
    let list = projects.slice();
    if (statusFilter !== "all") list = list.filter((p) => status(p) === statusFilter);
    if (scopeFilter) list = list.filter((p) => p.scope === scopeFilter);
    if (vendorFilter) list = list.filter((p) => p.vendors.some((v) => v.vendor === vendorFilter));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.customer.toLowerCase().includes(q) ||
        p.vendors.some((v) => v.vendor.toLowerCase().includes(q))
      );
    }
    if (sort === "days") {
      list.sort((a, b) => {
        const av = a.earliestContractDaysLeft ?? Number.POSITIVE_INFINITY;
        const bv = b.earliestContractDaysLeft ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
    }
    if (sort === "status") {
      const order = { red: 0, yellow: 1, gray: 2, green: 3 };
      list.sort((a, b) => order[status(a)] - order[status(b)]);
    }
    if (sort === "name") list.sort((a, b) => a.customer.localeCompare(b.customer));
    return list;
  }, [projects, statusFilter, scopeFilter, vendorFilter, search, sort]);

  const kpis = useMemo(() => {
    const total = projects.length;
    const red = projects.filter((p) => status(p) === "red").length;
    const yellow = projects.filter((p) => status(p) === "yellow").length;
    const green = projects.filter((p) => status(p) === "green").length;
    const gray = projects.filter((p) => status(p) === "gray").length;
    const missing = projects.reduce((s, p) => s + p.totalMissing, 0);
    return { total, red, yellow, green, gray, missing };
  }, [projects]);

  return (
    <div
      className={`space-y-5 transition-all ease-out duration-[1200ms] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {/* Hero band */}
      <div className="rounded-xl overflow-hidden border border-border bg-gradient-to-br from-[#1a0508] via-[#3a0a10] to-[#7a1520] text-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Customer Excellence Program</div>
            <h2 className="text-xl font-semibold mt-1">Portfolio Health · Delivery & Operations</h2>
            <p className="text-xs text-white/80 mt-1 max-w-2xl">
              Live view across all customer engagements — sourced from the CS master sheet.
            </p>
          </div>
          <div className="grid grid-cols-5 gap-3 min-w-[520px]">
            <HeroStat label="Projects" value={kpis.total} />
            <HeroStat label="Healthy" value={kpis.green} accent="emerald" />
            <HeroStat label="Watch" value={kpis.yellow} accent="amber" />
            <HeroStat label="Critical" value={kpis.red} accent="red" />
            <HeroStat label="Awaiting" value={kpis.gray} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-6 text-xs">
          <div><span className="text-white/60">Documents missing</span> <span className="font-semibold">{kpis.missing}</span></div>
        </div>
      </div>

      {loading && <div className="text-xs text-muted-foreground">Loading CS sheet…</div>}
      {error && <div className="text-xs text-red-700">Failed to load: {error}</div>}

      {/* Priority Actions */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PriorityPanel
            title="Expired Contracts"
            tone="red"
            items={projects
              .filter((p) => p.earliestContractDaysLeft !== null && p.earliestContractDaysLeft < 0)
              .sort((a, b) => (a.earliestContractDaysLeft ?? 0) - (b.earliestContractDaysLeft ?? 0))
              .slice(0, 5)
              .map((p) => ({
                project: p, label: `${p.customer} · ${p.scope}`,
                meta: `Expired ${Math.abs(p.earliestContractDaysLeft!)}d ago`,
              }))}
            onOpen={setSelected}
            emptyText="No contracts expired."
          />
          <PriorityPanel
            title="Expiring Soon (< 60 days)"
            tone="amber"
            items={projects
              .filter((p) => p.earliestContractDaysLeft !== null && p.earliestContractDaysLeft >= 0 && p.earliestContractDaysLeft < 60)
              .sort((a, b) => (a.earliestContractDaysLeft ?? 0) - (b.earliestContractDaysLeft ?? 0))
              .slice(0, 5)
              .map((p) => ({
                project: p, label: `${p.customer} · ${p.scope}`,
                meta: `${p.earliestContractDaysLeft}d left`,
              }))}
            onOpen={setSelected}
            emptyText="Nothing expiring in the next 60 days."
          />
          <PriorityPanel
            title="Critical Docs Missing"
            tone="red"
            items={projects
              .filter((p) => p.totalCriticalMissing > 0)
              .sort((a, b) => b.totalCriticalMissing - a.totalCriticalMissing)
              .slice(0, 5)
              .map((p) => ({
                project: p, label: `${p.customer} · ${p.scope}`,
                meta: `${p.totalCriticalMissing} critical`,
              }))}
            onOpen={setSelected}
            emptyText="All critical documents in place."
          />
        </div>
      )}



      {/* Filters */}
      <div className="border border-border rounded-lg p-3 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <input
            placeholder="Search customer or vendor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 px-3 text-sm border border-input rounded-md bg-white col-span-2"
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 px-2 text-sm border border-input rounded-md bg-white">
            <option value="all">All Status</option>
            <option value="green">Healthy</option>
            <option value="yellow">Watch</option>
            <option value="red">Critical</option>
            <option value="gray">Awaiting data</option>
          </select>
          <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}
            className="h-9 px-2 text-sm border border-input rounded-md bg-white">
            <option value="">All Scopes</option>
            {scopes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}
            className="h-9 px-2 text-sm border border-input rounded-md bg-white">
            <option value="">All Vendors</option>
            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 px-2 text-sm border border-input rounded-md bg-white">
            <option value="days">Sort: Days to Expiry</option>
            <option value="status">Sort: Status</option>
            <option value="name">Sort: Customer Name</option>
          </select>
        </div>
      </div>

      {/* Table view */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#111] uppercase tracking-wide">Customer Projects — Table View</h3>
          <span className="text-[10px] text-muted-foreground">{filtered.length} row{filtered.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-[#f8f8f8]">
              <tr className="text-left text-[#111]">
                {["Customer", "Scope", "Vendors", "Earliest Contract Expiry", "Contract Days Left", "Earliest PO Expiry", "PO Days Left", "Docs Missing", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 border-b border-border font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No projects match the filters.</td></tr>
              )}
              {filtered.map((p) => {
                const s = status(p);
                const meta = STATUS_META[s];
                const cd = p.earliestContractDaysLeft;
                const pd = p.earliestPoDaysLeft;
                const cVendor = p.vendors.find((v) => v.contractDaysLeft === cd);
                const pVendor = p.vendors.find((v) => v.poDaysLeft === pd);
                return (
                  <tr key={p.id} onClick={() => setSelected(p)}
                    className="cursor-pointer hover:bg-secondary/50 border-b border-border/60">
                    <td className="px-3 py-2 font-semibold text-[#111] whitespace-nowrap">{p.customer}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.scope || "—"}</td>
                    <td className="px-3 py-2">{p.vendors.length === 0 ? <span className="text-muted-foreground">—</span> : p.vendors.map((v) => v.vendor).join(", ")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{cVendor?.contractExpiry || "—"}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${cd !== null && cd < 60 ? "text-red-700 font-semibold" : ""}`}>{cd === null ? "—" : cd < 0 ? "Expired" : `${cd}d`}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{pVendor?.poExpiry || "—"}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${pd !== null && pd < 60 ? "text-red-700 font-semibold" : ""}`}>{pd === null ? "—" : pd < 0 ? "Expired" : `${pd}d`}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${p.totalMissing > 0 ? "text-red-700 font-semibold" : ""}`}>{p.hasData ? p.totalMissing : "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${meta.text}`}>
                        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards */}
      <div>
        <h3 className="text-xs font-semibold text-[#111] uppercase tracking-wide mb-2">Project Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {filtered.map((p) => {
            const s = status(p);
            const meta = STATUS_META[s];
            const cd = p.earliestContractDaysLeft;
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className={`text-left border rounded-lg p-4 bg-white hover:shadow-md transition-shadow ${meta.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[#111]">{p.customer}</div>
                    <div className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/70 border border-border text-[#111]">
                      {p.scope || "—"}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${meta.text}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <Row label="Vendors" value={p.vendors.length ? String(p.vendors.length) : "—"} />
                  <Row label="Earliest contract" value={cd === null ? "—" : cd < 0 ? `Expired ${Math.abs(cd)}d ago` : `${cd} days left`} strong={cd !== null && cd < 60} />
                  <Row label="Docs missing" value={p.hasData ? String(p.totalMissing) : "—"} strong={p.totalMissing > 0} />
                </div>
                {(PROJECT_NOTES[p.id]?.length ?? 0) > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-red-700 mb-1">Enhancements</div>
                    <ul className="space-y-1 text-[11px] text-[#111]">
                      {PROJECT_NOTES[p.id].map((n, i) => (
                        <li key={i} className="flex gap-1.5"><span className="text-red-600 font-bold">•</span><span>{n}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
          {selected && <ProjectDetail p={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDetail({ p }: { p: CustomerProject }) {
  const s = status(p);
  const meta = STATUS_META[s];
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {p.customer}
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-[#111]">{p.scope || "—"}</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.text}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        </DialogTitle>
        <DialogDescription>
          {p.vendors.length === 0 ? "No vendor data captured yet." : `${p.vendors.length} vendor${p.vendors.length === 1 ? "" : "s"} tracked`}
        </DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-sm">
        {p.vendors.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground bg-secondary/30">
            Awaiting data — vendor rows, documents, contract and PO details will appear here as they are added to the CS sheet.
          </div>
        ) : (
          <>
            <Section title="Vendors">
              <div className="space-y-3">
                {p.vendors.map((v, i) => (
                  <div key={i} className="border border-border rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="text-sm font-semibold text-[#111]">{v.vendor}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {v.missingCritical > 0
                          ? <span className="text-red-700 font-semibold">{v.missingCritical} critical doc(s) missing</span>
                          : v.missingAny > 0
                            ? <span className="text-amber-700 font-semibold">{v.missingAny} doc(s) pending</span>
                            : <span className="text-emerald-700 font-semibold">All documents complete</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mt-3">
                      <Info label="Contract date" value={v.contractDate || "—"} />
                      <Info label="Contract expiry" value={v.contractExpiry || "—"} />
                      <Info label="Contract days left" value={v.contractDaysLeft === null ? "—" : v.contractDaysLeft < 0 ? "Expired" : `${v.contractDaysLeft}d`} />
                      <Info label="PO number" value={v.poNumber || "—"} />
                      <Info label="PO date" value={v.poDate || "—"} />
                      <Info label="PO expiry" value={v.poExpiry || "—"} />
                      <Info label="PO days left" value={v.poDaysLeft === null ? "—" : v.poDaysLeft < 0 ? "Expired" : `${v.poDaysLeft}d`} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs mt-3">
                      {v.docs.map((d, j) => (
                        <div key={j} className="flex items-center justify-between border border-border rounded px-2 py-1.5">
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${
                              d.status === "complete" ? "bg-emerald-500" : d.status === "pending" ? "bg-amber-500" : "bg-red-600"
                            }`} />
                            {d.name}
                            {d.critical && <span className="text-[9px] font-bold text-red-700 uppercase">crit</span>}
                          </span>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                            d.status === "complete" ? "text-emerald-700" : d.status === "pending" ? "text-amber-700" : "text-red-700"
                          }`}>
                            {d.display}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Responsibility Matrix (RACI)">
              <div className="text-xs text-muted-foreground">Awaiting data — will populate once RACI is added to the CS sheet.</div>
            </Section>

            <Section title="Risk Alerts">
              <div className="text-xs text-muted-foreground">Awaiting data — will populate as risks are captured in the sheet.</div>
            </Section>

            <Section title="Expansion Opportunities">
              {(() => {
                const notes = PROJECT_NOTES[p.id] ?? [];
                if (notes.length === 0) return <div className="text-xs text-muted-foreground">Awaiting data.</div>;
                return (
                  <ul className="space-y-1.5 text-xs text-[#111]">
                    {notes.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-red-600 font-bold">•</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </Section>


            <Section title="Action Items">
              <div className="text-xs text-muted-foreground">Awaiting data.</div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-white">
      <h3 className="text-xs font-semibold text-[#111] uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xs font-medium text-[#111]">{value}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-[#111]" : "text-[#111]"}>{value}</span>
    </div>
  );
}

function HeroStat({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "amber" | "red" }) {
  const cls =
    accent === "emerald" ? "text-emerald-300" :
    accent === "amber" ? "text-amber-300" :
    accent === "red" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 backdrop-blur">
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}
