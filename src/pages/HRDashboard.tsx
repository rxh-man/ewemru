import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";



type Row = Record<string, string>;
interface SheetData {
  poPr: Row[];
  paymentRelease: Row[];
  vendors: Row[];
  urgent: Row[];
  fetchedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  Red: "#dc2626", Yellow: "#eab308", Amber: "#f59e0b", Green: "#16a34a", Blue: "#2563eb",
};
const CHART_PALETTE = ["#dc2626", "#111827", "#eab308", "#2563eb", "#16a34a", "#7c3aed", "#0891b2", "#db2777", "#ea580c", "#0d9488"];

function splitOwners(raw: string): string[] {
  return (raw || "").split(/[\n,;/]+/).map((s) => s.trim()).filter(Boolean);
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
function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  // Try common formats: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, Month yyyy
  const iso = new Date(t);
  if (!isNaN(iso.getTime())) return iso;
  const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yr = y.length === 2 ? 2000 + Number(y) : Number(y);
    return new Date(yr, Number(mo) - 1, Number(d));
  }
  return null;
}
function isExpired(r: Row): boolean {
  const rem = `${r.Remarks || ""} ${r.Blockers || ""} ${r.Issue || ""} ${r["Action Category"] || ""}`.toLowerCase();
  if (/\bexpired?\b/.test(rem)) return true;
  const end = parseDate(r["End Date"] || "");
  if (end && end.getTime() < Date.now()) return true;
  return false;
}


type DrillFilter = { kind: "owner" | "project" | "vendor" | "status" | "category"; value: string; source?: "po_pr" | "payment" | "all" };

export default function HRDashboard() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "po_pr" | "payment" | "vendors">("overview");

  const [fProject, setFProject] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fExpiry, setFExpiry] = useState<"" | "expired" | "active">("");
  const [search, setSearch] = useState("");


  const [drill, setDrill] = useState<DrillFilter | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBody, setEmailBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [urgentOpen, setUrgentOpen] = useState(false);

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
      if (fExpiry === "expired" && !isExpired(r)) return false;
      if (fExpiry === "active" && isExpired(r)) return false;
      if (q && !Object.values(r).some((v) => (v || "").toLowerCase().includes(q))) return false;
      return true;
    };
    return {
      poPr: data.poPr.filter(match),
      payment: data.paymentRelease.filter(match),
      vendors: data.vendors.filter((r) => {
        if (fProject && !(r["Project Name"] || "").toLowerCase().includes(fProject.toLowerCase())) return false;
        if (fVendor && !(r["Vendor Name"] || "").toLowerCase().includes(fVendor.toLowerCase())) return false;
        if (fExpiry === "expired" && !isExpired(r)) return false;
        if (fExpiry === "active" && isExpired(r)) return false;
        if (q && !Object.values(r).some((v) => (v || "").toLowerCase().includes(q))) return false;
        return true;
      }),
    };
  }, [data, fProject, fVendor, fOwner, fStatus, fExpiry, search]);


  const pendingPoPr = useMemo(() => filtered.poPr.filter(isPending), [filtered.poPr]);
  const pendingPay = useMemo(() => filtered.payment.filter(isPending), [filtered.payment]);
  const allActionable = useMemo(() => [...filtered.poPr, ...filtered.payment], [filtered]);
  const pending = useMemo(() => [...pendingPoPr, ...pendingPay], [pendingPoPr, pendingPay]);

  const byProject = useMemo(() => groupCount(pending, (r) => r["Project Name"] || "—"), [pending]);
  const byOwnerPoPr = useMemo(() => groupCount(pendingPoPr, (r) => splitOwners(r.Owner || "—")), [pendingPoPr]);
  const byOwnerPay = useMemo(() => groupCount(pendingPay, (r) => splitOwners(r.Owner || "—")), [pendingPay]);
  const byVendor = useMemo(() => groupCount(pending, (r) => r["Vendor Name"] || "—"), [pending]);
  const byStatus = useMemo(() => groupCount(allActionable, (r) => r.Status || "—"), [allActionable]);
  const byCategory = useMemo(() => groupCount(pending, (r) => r["Action Category"] || "—"), [pending]);

  const uniqueProjects = useMemo(() => [...new Set([...(data?.poPr || []), ...(data?.paymentRelease || [])].map((r) => r["Project Name"]).filter(Boolean))], [data]);
  const uniqueOwners = useMemo(() => {
    const s = new Set<string>();
    [...(data?.poPr || []), ...(data?.paymentRelease || [])].forEach((r) => splitOwners(r.Owner || "").forEach((o) => s.add(o)));
    return [...s].sort();
  }, [data]);

  // Drill down rows
  const drillRows = useMemo(() => {
    if (!drill) return { poPr: [] as Row[], payment: [] as Row[] };
    const sources = {
      po_pr: [pendingPoPr, [] as Row[]],
      payment: [[] as Row[], pendingPay],
      all: [pendingPoPr, pendingPay],
    } as const;
    const [poSrc, paySrc] = sources[drill.source || "all"];
    const test = (r: Row) => {
      const v = drill.value.toLowerCase();
      switch (drill.kind) {
        case "owner": return splitOwners(r.Owner || "").some((o) => o.toLowerCase() === v);
        case "project": return (r["Project Name"] || "").toLowerCase() === v;
        case "vendor": return (r["Vendor Name"] || "").toLowerCase() === v;
        case "status": return (r.Status || "").toLowerCase() === v;
        case "category": return (r["Action Category"] || "").toLowerCase() === v;
      }
    };
    return { poPr: poSrc.filter(test), payment: paySrc.filter(test) };
  }, [drill, pendingPoPr, pendingPay]);

  function openDrill(f: DrillFilter) { setDrill(f); }

  function draftEmailFor(target: DrillFilter) {
    const poSrc = pendingPoPr.filter((r) => matchDrill(r, target));
    const paySrc = pendingPay.filter((r) => matchDrill(r, target));
    const lines: string[] = [];
    const label = target.value;
    const greeting = target.kind === "owner" ? label.split(/\s+/)[0] : "Team";
    lines.push(`Dear ${greeting},`, "");
    lines.push(
      target.kind === "owner"
        ? `I hope you are doing well. Kindly find below the pending items currently awaiting your action. Your support in closing these at the earliest is appreciated.`
        : `I hope you are doing well. Kindly find below the pending items related to ${label} awaiting action.`
    );
    lines.push("");
    if (poSrc.length) {
      lines.push(`PO & PR — ${poSrc.length} item(s)`);
      lines.push("");
      poSrc.forEach((r, i) => {
        lines.push(`${i + 1}. ${r["Project Name"] || "—"} — ${r["Vendor Name"] || "—"}`);
        if (r.Description) lines.push(`   • Description: ${r.Description.replace(/\s+/g, " ").trim()}`);
        if (r["PR Number"]) lines.push(`   • PR Number: ${r["PR Number"]}`);
        if (r["Action Category"]) lines.push(`   • Action Required: ${r["Action Category"].replace(/\s+/g, " ").trim()}`);
        if (r.Status) lines.push(`   • Status: ${r.Status}`);
        if (r.Remarks) lines.push(`   • Remarks: ${r.Remarks}`);
        lines.push("");
      });
    }
    if (paySrc.length) {
      lines.push(`Payment Release — ${paySrc.length} item(s)`);
      lines.push("");
      paySrc.forEach((r, i) => {
        lines.push(`${i + 1}. ${r["Project Name"] || "—"} — ${r["Vendor Name"] || "—"}`);
        if (r.Issue) lines.push(`   • Issue: ${r.Issue.replace(/\s+/g, " ").trim()}`);
        if (r.Comment) lines.push(`   • Comment: ${r.Comment.replace(/\s+/g, " ").trim()}`);
        if (r["Next Step"]) lines.push(`   • Next Step: ${r["Next Step"]}${r["Next Step Owner"] ? ` (Owner: ${r["Next Step Owner"].replace(/\s+/g, " ").trim()})` : ""}`);
        if (r.Status) lines.push(`   • Status: ${r.Status}`);
        if (r.Remarks) lines.push(`   • Remarks: ${r.Remarks}`);
        lines.push("");
      });
    }
    if (!poSrc.length && !paySrc.length) lines.push("No pending items found.", "");
    lines.push("Kindly confirm the current status or the expected closure date at your earliest convenience.");
    lines.push("");
    lines.push("Regards,", "Marina Emad");
    setEmailSubject(`Pending Items – ${label} (${poSrc.length + paySrc.length} open)`);
    setEmailBody(lines.join("\n"));
    setEmailOpen(true);
  }


  function matchDrill(r: Row, target: DrillFilter): boolean {
    const v = target.value.toLowerCase();
    switch (target.kind) {
      case "owner": return splitOwners(r.Owner || "").some((o) => o.toLowerCase() === v);
      case "project": return (r["Project Name"] || "").toLowerCase() === v;
      case "vendor": return (r["Vendor Name"] || "").toLowerCase() === v;
      case "status": return (r.Status || "").toLowerCase() === v;
      case "category": return (r["Action Category"] || "").toLowerCase() === v;
    }
  }

  if (!session) return null;

  return (
    <AppShell session={session}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-[#111]">Contract & Procurement</h1>
          </div>


          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setUrgentOpen(true)}
              className="h-9 px-4 rounded-md bg-[#dc2626] text-white text-xs font-semibold hover:opacity-90">
              Top Urgent PO / PRs
            </button>
            <button onClick={() => setSummaryOpen(true)}
              className="h-9 px-4 rounded-md bg-[#111] text-white text-xs font-semibold hover:opacity-90">
              Blocker Summary
            </button>
            <button onClick={load} disabled={loading}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-60">
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="border border-destructive/40 bg-destructive/5 text-destructive text-xs rounded-md p-3">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total Items" value={allActionable.length} tone="dark" />
          <KPI label="Pending / Blockers" value={pending.length} tone="red" />
          <KPI label="Projects Affected" value={new Set(pending.map((r) => r["Project Name"])).size} tone="amber" />
          <KPI label="Action Owners" value={new Set(pending.flatMap((r) => splitOwners(r.Owner || ""))).size} tone="dark" />
        </div>

        <div className="border border-border rounded-lg p-3 bg-white">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
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
            <select value={fExpiry} onChange={(e) => setFExpiry(e.target.value as "" | "expired" | "active")} className="h-9 px-2 text-sm border border-input rounded-md bg-white">
              <option value="">All (Expiry)</option>
              <option value="expired">Expired only</option>
              <option value="active">Not expired</option>
            </select>
          </div>
          {(fProject || fOwner || fVendor || fStatus || fExpiry || search) && (
            <button onClick={() => { setFProject(""); setFOwner(""); setFVendor(""); setFStatus(""); setFExpiry(""); setSearch(""); }}
              className="mt-2 text-xs text-primary hover:underline">Clear all filters</button>
          )}
        </div>


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
              <ChartCard title={`Pending by Project (${pending.length})`} hint="Click a bar to drill down">
                <ClickableBar data={byProject} onClick={(name) => openDrill({ kind: "project", value: name })} color="#2563eb" />
              </ChartCard>

              <ChartCard title="Status Breakdown">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${e.value}`}>
                      {byStatus.map((s, i) => (
                        <Cell key={i} fill={STATUS_COLORS[s.name] || CHART_PALETTE[i % CHART_PALETTE.length]}
                          className="cursor-pointer"
                          onClick={() => openDrill({ kind: "status", value: s.name })} />
                      ))}
                    </Pie>
                    <Legend fontSize={11} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title={`Pending PO & PR by Owner (${pendingPoPr.length})`} hint="Click bar to see items">
                <ClickableBar data={byOwnerPoPr} onClick={(name) => openDrill({ kind: "owner", value: name, source: "po_pr" })} color="#dc2626" />
              </ChartCard>

              <ChartCard title={`Pending Payment Release by Owner (${pendingPay.length})`} hint="Click bar to see items">
                <ClickableBar data={byOwnerPay} onClick={(name) => openDrill({ kind: "owner", value: name, source: "payment" })} color="#111827" />
              </ChartCard>

              <ChartCard title="Pending by Vendor (top 10)">
                <ClickableBar data={byVendor.slice(0, 10)} onClick={(name) => openDrill({ kind: "vendor", value: name })} color="#7c3aed" />
              </ChartCard>

              <ChartCard title="Pending by Action Category">
                <ClickableBar data={byCategory} onClick={(name) => openDrill({ kind: "category", value: name })} color="#eab308" />
              </ChartCard>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-border bg-secondary/40 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#111]">All Blockers & Pending Items</h3>
                <span className="text-xs text-muted-foreground">{pending.length} items</span>
              </div>
              <PendingTable rows={pending} onOwner={(v) => openDrill({ kind: "owner", value: v })} onProject={(v) => openDrill({ kind: "project", value: v })} />
            </div>
          </div>
        )}

        {tab === "po_pr" && <SheetTable rows={filtered.poPr} columns={["#", "Initiator (HR)", "Project Name", "Vendor Name", "Description", "Old System", "New System", "PR In System", "PR Number", "Action Category", "Owner", "Status", "Remarks", "Blockers"]} onOwner={(v) => openDrill({ kind: "owner", value: v, source: "po_pr" })} onProject={(v) => openDrill({ kind: "project", value: v, source: "po_pr" })} />}
        {tab === "payment" && <SheetTable rows={filtered.payment} columns={["#", "System", "Project Name", "Vendor Name", "Issue", "Comment", "Action Category", "Owner", "Next Step", "Next Step Owner", "Status", "Remarks", "Blockers"]} onOwner={(v) => openDrill({ kind: "owner", value: v, source: "payment" })} onProject={(v) => openDrill({ kind: "project", value: v, source: "payment" })} />}

        {tab === "vendors" && <SheetTable rows={filtered.vendors} columns={["#", "Vendor Name", "Project Name", "Field / Support Type", "Contract Type", "Start Date", "End Date", "Contract Owner", "RAG Status"]} onProject={(v) => openDrill({ kind: "project", value: v })} />}
      </div>

      {/* Drill-down dialog */}
      <Dialog open={!!drill} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="capitalize">{drill?.kind}: {drill?.value}</DialogTitle>
            <DialogDescription>
              {drillRows.poPr.length + drillRows.payment.length} pending item(s)
              {drill?.source && drill.source !== "all" && ` — ${drill.source === "po_pr" ? "PO & PR" : "Payment Release"} only`}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {drillRows.poPr.length > 0 && (
              <DrillSection title={`PO & PR (${drillRows.poPr.length})`} rows={drillRows.poPr}
                cols={["Project Name", "Vendor Name", "PR Number", "Owner", "Status", "Action Category", "Remarks"]} />
            )}
            {drillRows.payment.length > 0 && (
              <DrillSection title={`Payment Release (${drillRows.payment.length})`} rows={drillRows.payment}
                cols={["Project Name", "Vendor Name", "Issue", "Owner", "Next Step", "Status", "Remarks"]} />
            )}
            {!drillRows.poPr.length && !drillRows.payment.length && (
              <div className="text-center py-8 text-xs text-muted-foreground">No pending items.</div>
            )}
          </div>
          <DialogFooter className="border-t border-border pt-3">
            <button onClick={() => setDrill(null)} className="h-9 px-3 text-xs border border-input rounded-md bg-white hover:bg-secondary">Close</button>
            {drill && (drillRows.poPr.length + drillRows.payment.length > 0) && (
              <button onClick={() => draftEmailFor(drill)}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
                Draft Email
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email drafter */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Draft Email</DialogTitle>
            <DialogDescription>Copy and paste into your mail client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">Subject</label>
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                className="mt-1 w-full h-9 px-3 text-sm border border-input rounded-md bg-white" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase text-muted-foreground">Body</label>
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)}
                className="mt-1 w-full h-[380px] p-3 text-xs font-mono border border-input rounded-md bg-white resize-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setEmailOpen(false)} className="h-9 px-3 text-xs border border-input rounded-md bg-white hover:bg-secondary">Close</button>
            <button
              onClick={async () => { await navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`); toast.success("Copied to clipboard"); }}
              className="h-9 px-3 text-xs border border-input rounded-md bg-white hover:bg-secondary">
              Copy subject + body
            </button>
            <button
              onClick={async () => { await navigator.clipboard.writeText(emailBody); toast.success("Body copied"); }}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
              Copy body
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocker Summary — one-page risk register */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-[1200px] max-h-[92vh] overflow-hidden flex flex-col p-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border print:hidden">
            <div>
              <DialogTitle className="text-base">Blocker Summary — One-Page Risk Register</DialogTitle>
              <DialogDescription className="text-xs">
                Report Date: {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="h-8 px-3 text-xs border border-input rounded-md bg-white hover:bg-secondary">Print / PDF</button>
              <button onClick={() => setSummaryOpen(false)} className="h-8 px-3 text-xs border border-input rounded-md bg-white hover:bg-secondary">Close</button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-5 bg-white" id="blocker-summary-print">
            <BlockerSummary pending={pending} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Top Urgent PO / PRs — minimal view of the "Urgent PO/PR" sheet */}
      <Dialog open={urgentOpen} onOpenChange={setUrgentOpen}>
        <DialogContent className="max-w-[1100px] max-h-[92vh] overflow-hidden flex flex-col p-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div>
              <DialogTitle className="text-base">Top Urgent PO / PRs</DialogTitle>
              <DialogDescription className="text-xs">
                Live from sheet <span className="font-medium text-[#111]">Urgent PO/PR</span>
                {data?.urgent ? ` · ${data.urgent.length} item${data.urgent.length === 1 ? "" : "s"}` : ""}
              </DialogDescription>
            </div>
            <button onClick={() => setUrgentOpen(false)} className="h-8 px-3 text-xs border border-input rounded-md bg-white hover:bg-secondary">Close</button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 bg-white">
            <UrgentList rows={data?.urgent ?? []} />
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function UrgentList({ rows }: { rows: Row[] }) {
  const [openProject, setOpenProject] = useState<string | null>(null);

  if (!rows.length) {
    return <div className="text-center py-12 text-xs text-muted-foreground">No urgent items in the sheet.</div>;
  }

  // Group by Project Name
  const byProject = new Map<string, Row[]>();
  for (const r of rows) {
    const p = (r["Project Name"] || "Unassigned").trim() || "Unassigned";
    if (!byProject.has(p)) byProject.set(p, []);
    byProject.get(p)!.push(r);
  }
  const projects = [...byProject.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => b.items.length - a.items.length);

  if (openProject) {
    const items = byProject.get(openProject) || [];
    const cols = Object.keys(items[0] || {}).filter((k) => k && !k.startsWith("col_"));
    return (
      <div className="space-y-3">
        <button onClick={() => setOpenProject(null)}
          className="text-xs text-[#dc2626] hover:underline font-medium">← Back to summary</button>
        <div>
          <h3 className="text-sm font-semibold text-[#111]">{openProject}</h3>
          <p className="text-xs text-muted-foreground">{items.length} urgent item{items.length === 1 ? "" : "s"}</p>
        </div>
        <div className="space-y-2">
          {items.map((r, i) => {
            const title = r["PR Number"] || r["PO Number"] || r["Vendor Name"] || r["Description"] || `Item ${i + 1}`;
            const vendor = r["Vendor Name"] || r["Vendor"] || "";
            const status = r["Status"] || "";
            const statusColor = STATUS_COLORS[status] || "#6b7280";
            return (
              <div key={i} className="border border-border rounded-lg bg-white">
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                      <h4 className="text-sm font-semibold text-[#111] truncate">{title}</h4>
                    </div>
                    {vendor && <p className="text-xs text-muted-foreground mt-0.5 truncate">{vendor}</p>}
                  </div>
                  {status && (
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: statusColor }}>{status}</span>
                  )}
                </div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3">
                  {cols
                    .filter((k) => k !== "Project Name" && k !== "Vendor Name" && k !== "Vendor" && k !== "Status")
                    .filter((k) => (r[k] || "").trim() !== "")
                    .map((k) => (
                      <div key={k} className="text-xs flex gap-2 min-w-0">
                        <dt className="text-muted-foreground shrink-0">{k}:</dt>
                        <dd className="text-[#111] break-words">{r[k]}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[#111]">Summary by Project</h3>
        <p className="text-xs text-muted-foreground">{projects.length} project{projects.length === 1 ? "" : "s"} · {rows.length} urgent item{rows.length === 1 ? "" : "s"} · Click a project for details</p>
      </div>
      <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
        {projects.map((p) => {
          const statuses = groupCount(p.items, (r) => r.Status || "—");
          return (
            <button key={p.name} onClick={() => setOpenProject(p.name)}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[#fef2f2] transition">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#111] truncate">{p.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {statuses.map((s) => (
                    <span key={s.name} className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: STATUS_COLORS[s.name] || "#6b7280" }}>
                      {s.name} · {s.value}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold text-[#dc2626] tabular-nums leading-none">{p.items.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">items</div>
              </div>
              <span className="shrink-0 text-muted-foreground text-lg leading-none">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function riskFromStatus(status: string): "Critical" | "High" | "Medium" | "Low" {
  const s = (status || "").toLowerCase();
  if (s.includes("red")) return "Critical";
  if (s.includes("amber") || s.includes("orange")) return "High";
  if (s.includes("yellow")) return "Medium";
  return "Low";
}
function daysExposed(r: Row): string {
  const end = parseDate(r["End Date"] || "");
  if (!end) return "—";
  const diff = Math.floor((Date.now() - end.getTime()) / 86400000);
  if (diff > 0) return `${diff} days expired`;
  if (diff === 0) return "Expires today";
  return `${Math.abs(diff)} days left`;
}

function BlockerSummary({ pending }: { pending: Row[] }) {
  const byOwner = groupCount(pending, (r) => splitOwners(r.Owner || "—"));
  const byCategory = groupCount(pending, (r) => r["Action Category"] || r.Issue || "—");
  const byRisk = groupCount(pending, (r) => riskFromStatus(r.Status || ""));
  const riskOrder = ["Critical", "High", "Medium", "Low"];
  const byRiskSorted = riskOrder
    .map((k) => byRisk.find((x) => x.name === k))
    .filter(Boolean) as { name: string; value: number }[];
  const riskBg: Record<string, string> = {
    Critical: "#ef4444", High: "#f97316", Medium: "#facc15", Low: "#a3e635",
  };
  return (
    <div className="space-y-6 text-[#111]">
      <div>
        <h2 className="text-lg font-bold">IoT Field_PR/PO Governance Exposure — Detailed Risk Register</h2>
      </div>
      <div className="overflow-x-auto border border-[#111]">
        <table className="w-full text-[11px] border-collapse">
          <thead className="bg-[#111] text-white">
            <tr>
              {["#", "Program", "Vendor", "Category", "Case Description", "PO / End Date", "Days Exposed", "Stakeholder", "Current Blocker", "Stuck With", "Risk Level"].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-semibold border-r border-[#333] last:border-r-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 && (
              <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">No open blockers.</td></tr>
            )}
            {pending.map((r, i) => {
              const risk = riskFromStatus(r.Status || "");
              return (
                <tr key={i} className="border-t border-[#ccc] align-top">
                  <td className="px-2 py-1.5 border-r border-[#eee]">{i + 1}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee] font-medium">{r["Project Name"] || "—"}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee]">{r["Vendor Name"] || "—"}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee]">{r["Action Category"] || "—"}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee] max-w-[220px]">{r.Description || r.Issue || "—"}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee] whitespace-nowrap">{r["End Date"] || "N/A"}</td>
                  <td className={`px-2 py-1.5 border-r border-[#eee] whitespace-nowrap font-semibold ${daysExposed(r).includes("expired") ? "text-red-600" : ""}`}>{daysExposed(r)}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee]">{r["Next Step Owner"] || r["Initiator (HR)"] || "—"}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee] max-w-[240px]">{r.Blockers || r.Remarks || r.Comment || "—"}</td>
                  <td className="px-2 py-1.5 border-r border-[#eee]">{r.Owner || "—"}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-block px-2 py-0.5 rounded text-white font-semibold text-[10px]" style={{ background: riskBg[risk] }}>{risk}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3">Case Distribution: By Blocking Owner and Risk Level</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DistroBox title="By Blocking Owner" rows={byOwner} />
          <DistroBox title="By Risk Level" rows={byRiskSorted} rowBg={riskBg} />
          <DistroBox title="By Category" rows={byCategory} />
          <DistroBox title="Total Cases" rows={[{ name: "All logged cases", value: pending.length }]} accent />
        </div>
      </div>
    </div>
  );
}

function DistroBox({ title, rows, rowBg, accent }: { title: string; rows: { name: string; value: number }[]; rowBg?: Record<string, string>; accent?: boolean }) {
  return (
    <div className="border border-[#111]">
      <div className={`px-3 py-2 text-center font-semibold text-white ${accent ? "bg-[#7a0e1a]" : "bg-[#1a2340]"}`}>{title}</div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-[#eee]">
              <td className="px-3 py-1.5" style={rowBg?.[r.name] ? { background: rowBg[r.name], color: "#111", fontWeight: 600 } : undefined}>{r.name}</td>
              <td className="px-3 py-1.5 text-right font-bold text-[#7a0e1a] tabular-nums w-16">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClickableBar({ data, onClick }: { data: { name: string; value: number }[]; color?: string; onClick: (name: string) => void }) {
  const height = Math.max(280, data.length * 28 + 40);
  // Red-blend palette: darkest for highest value, fading to lighter red
  const redShade = (i: number, total: number) => {
    if (total <= 1) return "#dc2626";
    const t = i / (total - 1); // 0 → darkest, 1 → lightest
    const start = { r: 127, g: 29, b: 29 };   // #7f1d1d deep red
    const end = { r: 254, g: 178, b: 178 };   // soft red
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    return `rgb(${r},${g},${b})`;
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 40 }}>
        <XAxis type="number" fontSize={11} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={140} fontSize={11} />
        <Tooltip cursor={{ fill: "rgba(220,38,38,0.06)" }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} className="cursor-pointer"
          onClick={(d: { name: string }) => onClick(d.name)}>
          {data.map((_, i) => <Cell key={i} fill={redShade(i, data.length)} />)}
          <LabelList dataKey="value" position="right" fontSize={11} fill="#111" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DrillSection({ title, rows, cols }: { title: string; rows: Row[]; cols: string[] }) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-2 bg-secondary/40 text-xs font-semibold text-[#111]">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary/20">
            <tr>{cols.map((c) => <th key={c} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border align-top">
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2 whitespace-pre-line max-w-[260px]">
                    {c === "Status" ? <StatusPill value={r[c]} /> : (r[c] || "—")}
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

function KPI({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "dark" }) {
  const bg = tone === "red" ? "bg-primary text-primary-foreground" : tone === "amber" ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-[#111] text-white";
  return (
    <div className={`${bg} rounded-lg p-4`}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-3xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-white">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#111]">{title}</h3>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
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

function PendingTable({ rows, onOwner, onProject }: { rows: Row[]; onOwner: (v: string) => void; onProject: (v: string) => void }) {
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
              <td className="px-3 py-2 whitespace-nowrap">
                {r["Project Name"] ? (
                  <button onClick={() => onProject(r["Project Name"])} className="text-primary hover:underline text-left">{r["Project Name"]}</button>
                ) : "—"}
              </td>
              <td className="px-3 py-2">{r["Vendor Name"] || "—"}</td>
              <td className="px-3 py-2 whitespace-pre-line">
                {splitOwners(r.Owner || "").length ? splitOwners(r.Owner).map((o, k) => (
                  <button key={k} onClick={() => onOwner(o)} className="text-primary hover:underline block text-left">{o}</button>
                )) : "—"}
              </td>
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

function SheetTable({ rows, columns, onOwner, onProject }: { rows: Row[]; columns: string[]; onOwner?: (v: string) => void; onProject?: (v: string) => void }) {
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
                {columns.map((c) => {
                  const val = r[c] || "";
                  if (c === "Status" || c === "RAG Status") return <td key={c} className="px-3 py-2"><StatusPill value={val} /></td>;
                  if (c === "Project Name" && onProject && val) return <td key={c} className="px-3 py-2 whitespace-nowrap"><button onClick={() => onProject(val)} className="text-primary hover:underline text-left">{val}</button></td>;
                  if ((c === "Owner" || c === "Next Step Owner" || c === "Contract Owner") && onOwner && val) {
                    return <td key={c} className="px-3 py-2 whitespace-pre-line">{splitOwners(val).map((o, k) => (
                      <button key={k} onClick={() => onOwner(o)} className="text-primary hover:underline block text-left">{o}</button>
                    ))}</td>;
                  }
                  return <td key={c} className="px-3 py-2 whitespace-pre-line max-w-[300px]">{val || "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
