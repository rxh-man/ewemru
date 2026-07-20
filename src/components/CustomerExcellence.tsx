import { useMemo, useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type DocStatus = "complete" | "missing" | "pending";
type Doc = { name: string; status: DocStatus; critical?: boolean };
type RiskFlag = { level: "red" | "yellow"; text: string };
type AiRec = { kind: "scope" | "vendor" | "renewal"; text: string };
type RaciRole = "R" | "A" | "C" | "I";
type RaciRow = { area: string; owner: string; contact: string; role: RaciRole };

export type CustomerProject = {
  id: string;
  customer: string;
  scope: "Field" | "NOC" | "GNOC" | "MSP";
  vendor: string;
  vendorRating: number;
  onTimePct: number;
  qualityScore: number;
  contractStart: string;
  contractExpiry: string;
  poStart?: string;
  poEnd?: string;
  services: string[];
  expansions: string[];
  timeline: { label: string; date: string }[];
  documents: Doc[];
  risks: RiskFlag[];
  aiRecommendations: AiRec[];
  actions: string[];
  healthScore: number;
  vendorHistory?: string;
  raci: RaciRow[];
};

const COMMON_RACI = (delivery: string, vendor: string, vendorContact: string): RaciRow[] => [
  { area: "Business Case", owner: "Strategy Office", contact: "Fatima Al Marri · fatima.almarri@eand.com", role: "A" },
  { area: "Commercials & Pricing", owner: "Commercial", contact: "Omar Haddad · omar.haddad@eand.com", role: "R" },
  { area: "PR / PO Issuance", owner: "Procurement", contact: "Marina Emad · marina.emad@eand.com", role: "R" },
  { area: "Signed Contract & SOW", owner: "Legal & Contracts", contact: "Layla Nassar · layla.nassar@eand.com", role: "A" },
  { area: "Compliance & Insurance", owner: "Governance", contact: "Yousef Rahman · yousef.rahman@eand.com", role: "C" },
  { area: "Service Delivery", owner: delivery, contact: "Asaad Tawfik · asaad.tawfik@eand.com", role: "A" },
  { area: "Vendor Operations", owner: vendor, contact: vendorContact, role: "R" },
  { area: "Executive Reporting", owner: "Customer Excellence", contact: "Asaad Tawfik · asaad.tawfik@eand.com", role: "I" },
];

const PROJECTS: CustomerProject[] = [
  {
    id: "adcb",
    customer: "ADCB",
    scope: "Field",
    vendor: "TASC",
    vendorRating: 9.4,
    onTimePct: 99,
    qualityScore: 9.5,
    contractStart: "2023-03-15",
    contractExpiry: "2025-09-30",
    services: ["Field engineering", "Site survey", "Cabling & install", "AMC — L1 support"],
    expansions: [
      "Remote Provisioning — reduce deployment SLA from 48h to 1h",
      "Managed Wi-Fi analytics dashboard",
      "Quarterly executive service review",
    ],
    timeline: [
      { label: "Next AMC visit", date: "2025-02-04" },
      { label: "Quarterly service review", date: "2025-01-20" },
      { label: "Contract renewal window opens", date: "2025-07-30" },
    ],
    documents: [
      { name: "Business Case", status: "complete", critical: true },
      { name: "Commercials", status: "complete", critical: true },
      { name: "PR (Purchase Requisition)", status: "complete", critical: true },
      { name: "Signed Contract", status: "complete", critical: true },
      { name: "SOW", status: "complete", critical: true },
      { name: "PO Copy", status: "complete", critical: true },
      { name: "Compliance Certificate", status: "complete" },
      { name: "Insurance", status: "complete" },
      { name: "Renewal File", status: "complete" },
      { name: "Invoice (latest)", status: "complete" },
      { name: "Service Report Q3", status: "complete" },
      { name: "Escalation Matrix", status: "complete" },
    ],
    risks: [],
    aiRecommendations: [
      { kind: "scope", text: "ADCB branch footprint qualifies for Remote Provisioning — projected 96% reduction in deployment time (48h → 1h)." },
      { kind: "renewal", text: "Renewal window opens Jul 2025 — begin value story deck by Q2 to lock in early." },
      { kind: "vendor", text: "TASC on-time delivery for ADCB is 99% (last 12 months). Recommend extending SLA with performance-linked incentives." },
    ],
    actions: [
      "Prepare Remote Provisioning proposal for exec review",
      "Draft 12-month renewal value story",
      "Schedule Q1 executive service review with ADCB",
    ],
    healthScore: 9.4,
    raci: COMMON_RACI("Field Delivery", "TASC", "Ravi Menon · ravi.menon@tasc.ae"),
  },
  {
    id: "taqa",
    customer: "TAQA",
    scope: "NOC",
    vendor: "Network Solutions Inc.",
    vendorRating: 5.4,
    onTimePct: 71,
    qualityScore: 6.1,
    contractStart: "2022-12-01",
    contractExpiry: "2024-12-01",
    services: ["24/7 NOC monitoring", "L2 fault management", "Incident reporting"],
    expansions: [
      "AIOps overlay — predictive incident reduction",
      "Dedicated TAQA-branded NOC pod",
    ],
    timeline: [
      { label: "Contract expiry (URGENT)", date: "2024-12-01" },
      { label: "Quarterly review overdue", date: "2024-10-15" },
      { label: "Next AMC visit", date: "2024-11-25" },
    ],
    documents: [
      { name: "Business Case", status: "complete", critical: true },
      { name: "Commercials", status: "missing", critical: true },
      { name: "PR (Purchase Requisition)", status: "complete", critical: true },
      { name: "Signed Contract", status: "complete", critical: true },
      { name: "SOW", status: "missing", critical: true },
      { name: "PO Copy", status: "complete", critical: true },
      { name: "Compliance Certificate", status: "missing", critical: true },
      { name: "Insurance", status: "complete" },
      { name: "Renewal File", status: "missing" },
      { name: "Invoice (latest)", status: "pending" },
      { name: "Service Report Q3", status: "missing" },
      { name: "Escalation Matrix", status: "complete" },
    ],
    risks: [
      { level: "red", text: "Two critical documents missing (SOW, Compliance) — audit risk" },
      { level: "red", text: "Contract expires in 134 days — no renewal engagement started" },
      { level: "yellow", text: "Payment delays observed in Q2 2024 (avg 22 days over terms)" },
    ],
    aiRecommendations: [
      { kind: "renewal", text: "Escalate renewal — vendor turnaround for TAQA legal historically exceeds 90 days." },
      { kind: "vendor", text: "Network Solutions Inc. quality trending down (Q1 6.8 → Q3 6.1). Recommend performance review before renewal commit." },
      { kind: "scope", text: "AIOps overlay could reduce NOC ticket volume by ~30% based on TAQA's incident profile." },
    ],
    actions: [
      "Trigger renewal proposal within 5 business days",
      "Request SOW and Compliance Certificate refresh from vendor",
      "Schedule vendor performance review with delivery head",
      "Enforce payment terms clause on next PO",
    ],
    healthScore: 5.2,
    raci: COMMON_RACI("NOC Delivery", "Network Solutions Inc.", "Priya Sharma · priya@netsolinc.com"),
  },
  {
    id: "etihadwe",
    customer: "Etihad WE",
    scope: "Field",
    vendor: "Shams Itkan",
    vendorRating: 5.1,
    onTimePct: 68,
    qualityScore: 6.4,
    contractStart: "2022-09-15",
    contractExpiry: "2024-09-15",
    vendorHistory: "Vendor payment strike on 2024-07-20 (this project, this scope) — 1 day field delay.",
    services: ["MRU automation field ops", "Meter installation & verification", "Site survey"],
    expansions: [
      "MRU automation extension — Al Ain zone",
      "Dedicated field supervisor onsite",
    ],
    timeline: [
      { label: "Contract expiry (CRITICAL)", date: "2024-09-15" },
      { label: "Renewal proposal draft", date: "2024-08-10" },
      { label: "Vendor performance review", date: "2024-08-01" },
    ],
    documents: [
      { name: "Business Case", status: "complete", critical: true },
      { name: "Commercials", status: "complete", critical: true },
      { name: "PR (Purchase Requisition)", status: "complete", critical: true },
      { name: "Signed Contract", status: "complete", critical: true },
      { name: "SOW", status: "complete", critical: true },
      { name: "PO Copy", status: "complete", critical: true },
      { name: "Compliance Certificate", status: "complete" },
      { name: "Insurance", status: "complete" },
      { name: "Renewal File", status: "missing" },
      { name: "Invoice (latest)", status: "pending" },
      { name: "Service Report Q3", status: "missing" },
      { name: "Escalation Matrix", status: "complete" },
    ],
    risks: [
      { level: "red", text: "Vendor payment reliability flagged — see Vendor Health for incident detail" },
      { level: "red", text: "Contract expires in 57 days — renewal not in flight" },
      { level: "yellow", text: "Q3 service report not received from vendor" },
    ],
    aiRecommendations: [
      { kind: "vendor", text: "Recommend strict milestone-based payment terms in next PO and dual-vendor fallback for Shams Itkan." },
      { kind: "renewal", text: "Renewal at high risk — engage Etihad WE procurement head this week to prevent lapse." },
      { kind: "scope", text: "Al Ain expansion aligned with Etihad WE's 2025 investment plan — bundle with renewal to lift value." },
    ],
    actions: [
      "Send renewal proposal within 3 days",
      "Add milestone-based payment clause to next PO",
      "Identify secondary field vendor as fallback",
      "Recover Q3 service report and latest invoice",
    ],
    healthScore: 4.8,
    raci: COMMON_RACI("Field Delivery", "Shams Itkan", "Karim Hafez · karim@shamsitkan.ae"),
  },
  {
    id: "adnoc",
    customer: "ADNOC",
    scope: "GNOC",
    vendor: "Global Tech Services",
    vendorRating: 9.2,
    onTimePct: 98,
    qualityScore: 9.4,
    contractStart: "2024-06-30",
    contractExpiry: "2025-06-30",
    services: ["End-to-end GNOC", "Multi-vendor orchestration", "Executive reporting"],
    expansions: [
      "AI incident summarisation for CXO reporting",
      "Cross-site capacity planning module",
    ],
    timeline: [
      { label: "Next executive review", date: "2025-02-15" },
      { label: "Contract renewal window", date: "2025-04-30" },
      { label: "Quarterly service review", date: "2025-01-30" },
    ],
    documents: [
      { name: "Business Case", status: "complete", critical: true },
      { name: "Commercials", status: "complete", critical: true },
      { name: "PR (Purchase Requisition)", status: "complete", critical: true },
      { name: "Signed Contract", status: "complete", critical: true },
      { name: "SOW", status: "complete", critical: true },
      { name: "PO Copy", status: "complete", critical: true },
      { name: "Compliance Certificate", status: "complete" },
      { name: "Insurance", status: "complete" },
      { name: "Renewal File", status: "complete" },
      { name: "Invoice (latest)", status: "complete" },
      { name: "Service Report Q3", status: "complete" },
      { name: "Escalation Matrix", status: "complete" },
    ],
    risks: [],
    aiRecommendations: [
      { kind: "scope", text: "ADNOC's incident volume qualifies for AI Summarisation — projected 40% analyst time saved." },
      { kind: "renewal", text: "Renewal in 345 days — begin value-story deck by Q1 2025 to lock in early." },
    ],
    actions: [
      "Present AI summarisation POC in next exec review",
      "Prepare 12-month value story for renewal",
    ],
    healthScore: 9.1,
    raci: COMMON_RACI("GNOC Delivery", "Global Tech Services", "Anand Kapoor · anand@globaltechsvc.com"),
  },
];


function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.floor((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function status(p: CustomerProject): "green" | "yellow" | "red" {
  const days = daysUntil(p.contractExpiry);
  const criticalMissing = p.documents.some((d) => d.critical && d.status !== "complete");
  const anyMissing = p.documents.some((d) => d.status !== "complete");
  if (criticalMissing || days < 30) return "red";
  if (anyMissing || days < 60) return "yellow";
  return "green";
}

const STATUS_META = {
  green: { dot: "bg-emerald-500", label: "Healthy", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  yellow: { dot: "bg-amber-500", label: "Watch", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  red: { dot: "bg-red-600", label: "Critical", text: "text-red-700", bg: "bg-red-50 border-red-200" },
} as const;

const RACI_META: Record<RaciRole, { label: string; cls: string }> = {
  R: { label: "Responsible", cls: "bg-red-50 text-red-700 border-red-200" },
  A: { label: "Accountable", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  C: { label: "Consulted", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  I: { label: "Informed", cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

export function CustomerExcellence() {
  const [selected, setSelected] = useState<CustomerProject | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "green" | "yellow" | "red">("all");
  const [scopeFilter, setScopeFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"days" | "status" | "name">("days");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const scopes = useMemo(() => [...new Set(PROJECTS.map((p) => p.scope))], []);
  const vendors = useMemo(() => [...new Set(PROJECTS.map((p) => p.vendor))], []);

  const rows = useMemo(() => {
    let list = PROJECTS.slice();
    if (statusFilter !== "all") list = list.filter((p) => status(p) === statusFilter);
    if (scopeFilter) list = list.filter((p) => p.scope === scopeFilter);
    if (vendorFilter) list = list.filter((p) => p.vendor === vendorFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.customer.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q));
    }
    if (sort === "days") list.sort((a, b) => daysUntil(a.contractExpiry) - daysUntil(b.contractExpiry));
    if (sort === "status") {
      const order = { red: 0, yellow: 1, green: 2 };
      list.sort((a, b) => order[status(a)] - order[status(b)]);
    }
    if (sort === "name") list.sort((a, b) => a.customer.localeCompare(b.customer));
    return list;
  }, [statusFilter, scopeFilter, vendorFilter, search, sort]);

  const kpis = useMemo(() => {
    const total = PROJECTS.length;
    const red = PROJECTS.filter((p) => status(p) === "red").length;
    const yellow = PROJECTS.filter((p) => status(p) === "yellow").length;
    const green = PROJECTS.filter((p) => status(p) === "green").length;
    const missing = PROJECTS.reduce((s, p) => s + p.documents.filter((d) => d.status !== "complete").length, 0);
    const avgHealth = PROJECTS.reduce((s, p) => s + p.healthScore, 0) / PROJECTS.length;
    return { total, red, yellow, green, missing, avgHealth };
  }, []);

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
              Live view across all customer engagements — contracts, documents, vendor health, and expansion opportunities.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3 min-w-[420px]">
            <HeroStat label="Projects" value={kpis.total} />
            <HeroStat label="Healthy" value={kpis.green} accent="emerald" />
            <HeroStat label="Watch" value={kpis.yellow} accent="amber" />
            <HeroStat label="Critical" value={kpis.red} accent="red" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-6 text-xs">
          <div>
            <span className="text-white/60">Avg. health</span>{" "}
            <span className="font-semibold">{kpis.avgHealth.toFixed(1)} / 10</span>
          </div>
          <div>
            <span className="text-white/60">Documents missing</span>{" "}
            <span className="font-semibold">{kpis.missing}</span>
          </div>
        </div>
      </div>

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

      {/* Table view FIRST */}
      <div className="border border-border rounded-lg bg-white overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#111] uppercase tracking-wide">Customer Projects — Table View</h3>
          <span className="text-[10px] text-muted-foreground">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-[#f8f8f8]">
              <tr className="text-left text-[#111]">
                {["Customer", "Scope", "Vendor", "Contract Expiry", "Days Left", "Vendor Rating", "On-Time %", "Docs Missing", "Health", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 border-b border-border font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No projects match the filters.</td></tr>
              )}
              {rows.map((p) => {
                const s = status(p);
                const meta = STATUS_META[s];
                const days = daysUntil(p.contractExpiry);
                const missing = p.documents.filter((d) => d.status !== "complete").length;
                return (
                  <tr key={p.id} onClick={() => setSelected(p)}
                    className="cursor-pointer hover:bg-secondary/50 border-b border-border/60">
                    <td className="px-3 py-2 font-semibold text-[#111] whitespace-nowrap">{p.customer}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.scope}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.vendor}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.contractExpiry}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${days < 60 ? "text-red-700 font-semibold" : ""}`}>{days < 0 ? "Expired" : `${days}d`}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.vendorRating.toFixed(1)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{p.onTimePct}%</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${missing > 0 ? "text-red-700 font-semibold" : ""}`}>{missing}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${p.healthScore < 6 ? "text-red-700 font-semibold" : ""}`}>{p.healthScore.toFixed(1)}</td>
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

      {/* Cards below */}
      <div>
        <h3 className="text-xs font-semibold text-[#111] uppercase tracking-wide mb-2">Project Cards</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {rows.map((p) => {
            const s = status(p);
            const meta = STATUS_META[s];
            const days = daysUntil(p.contractExpiry);
            const missing = p.documents.filter((d) => d.status !== "complete").length;
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className={`text-left border rounded-lg p-4 bg-white hover:shadow-md transition-shadow ${meta.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-[#111]">{p.customer}</div>
                    <div className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/70 border border-border text-[#111]">
                      {p.scope}
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${meta.text}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  <Row label="Contract expiry" value={`${days < 0 ? "Expired" : `${days} days`}`} strong={days < 60} />
                  <Row label="Docs missing" value={`${missing}`} strong={missing > 0} />
                  <Row label="Vendor" value={p.vendor} />
                  <Row label="Health" value={`${p.healthScore.toFixed(1)} / 10`} strong={p.healthScore < 6} />
                </div>
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
  const days = daysUntil(p.contractExpiry);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {p.customer}
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary text-[#111]">{p.scope}</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.text}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} /> {meta.label}
          </span>
        </DialogTitle>
        <DialogDescription>
          Vendor: {p.vendor} · Contract expiry {p.contractExpiry} ({days < 0 ? "expired" : `${days} days`})
        </DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto flex-1 space-y-4 pr-1 text-sm">
        <Section title="Overview">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Info label="Contract start" value={p.contractStart} />
            <Info label="Contract expiry" value={p.contractExpiry} />
            <Info label="PO period" value={p.poStart && p.poEnd ? `${p.poStart} → ${p.poEnd}` : "—"} />
            <Info label="Health score" value={`${p.healthScore.toFixed(1)} / 10`} />
          </div>
        </Section>

        <Section title="Current Scope">
          <ul className="list-disc pl-5 space-y-1 text-xs">
            {p.services.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </Section>

        <Section title="Expansion Opportunities">
          <ul className="space-y-1 text-xs">
            {p.expansions.map((x, i) => (
              <li key={i} className="flex gap-2"><span className="text-red-600">+</span>{x}</li>
            ))}
          </ul>
        </Section>

        <Section title="Timeline">
          <div className="space-y-1.5 text-xs">
            {p.timeline.map((t, i) => (
              <div key={i} className="flex justify-between border-b border-border/60 pb-1">
                <span className="text-[#111]">{t.label}</span>
                <span className="text-muted-foreground">{t.date}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Documents">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
            {p.documents.map((d, i) => (
              <div key={i} className="flex items-center justify-between border border-border rounded px-2 py-1.5">
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
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Responsibility Matrix (RACI)">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-[#f8f8f8]">
                <tr className="text-left text-[#111]">
                  <th className="px-2 py-1.5 border-b border-border font-semibold">Area</th>
                  <th className="px-2 py-1.5 border-b border-border font-semibold">Owner Team / Vendor</th>
                  <th className="px-2 py-1.5 border-b border-border font-semibold">Who to Contact</th>
                  <th className="px-2 py-1.5 border-b border-border font-semibold">Role</th>
                </tr>
              </thead>
              <tbody>
                {p.raci.map((r, i) => {
                  const rm = RACI_META[r.role];
                  return (
                    <tr key={i} className="border-b border-border/60">
                      <td className="px-2 py-1.5 font-medium text-[#111]">{r.area}</td>
                      <td className="px-2 py-1.5">{r.owner}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{r.contact}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${rm.cls}`}>
                          {r.role} · {rm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-muted-foreground">
            R = Responsible · A = Accountable · C = Consulted · I = Informed
          </div>
        </Section>

        <Section title="Vendor Health">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <Info label="Rating" value={`${p.vendorRating.toFixed(1)} / 10`} />
            <Info label="On-time delivery" value={`${p.onTimePct}%`} />
            <Info label="Quality score" value={`${p.qualityScore.toFixed(1)} / 10`} />
            <Info label="History" value={p.vendorHistory ?? "No incidents recorded"} />
          </div>
        </Section>

        <Section title="Risk Alerts">
          {p.risks.length === 0 ? (
            <div className="text-xs text-muted-foreground">No active risks.</div>
          ) : (
            <div className="space-y-1.5">
              {p.risks.map((r, i) => (
                <div key={i} className={`text-xs px-2.5 py-1.5 rounded border ${
                  r.level === "red" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>
                  {r.text}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recommendations">
          <div className="space-y-1.5">
            {p.aiRecommendations.map((r, i) => (
              <div key={i} className="text-xs px-2.5 py-1.5 rounded border border-border bg-secondary/30">
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-700 mr-2">{r.kind}</span>
                {r.text}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Action Items">
          <ul className="space-y-1 text-xs">
            {p.actions.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </Section>
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
