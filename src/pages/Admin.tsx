import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ENERGY_FIELDS, WATER_FIELDS, mapRow } from "@/lib/fields";

export default function Admin() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<"upload" | "verifications">("upload");

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "admin") { navigate("/"); return; }
    setSession(s);
  }, [navigate]);

  if (!session) return null;
  return (
    <AppShell session={session}>
      <div className="flex gap-1 border-b border-border mb-5">
        {(["upload", "verifications"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-[#111]"}`}>
            {t === "upload" ? "Upload Master Tracker" : "Verifications"}
          </button>
        ))}
      </div>
      {tab === "upload" ? <UploadTab /> : <VerificationsTab />}
    </AppShell>
  );
}

type ParsedSheet = { table: "energy_sites" | "water_sites"; rows: Record<string, string | null>[] };

function UploadTab() {
  const [parsed, setParsed] = useState<ParsedSheet[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setProgress("Reading file…");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheets: ParsedSheet[] = [];
      for (const name of wb.SheetNames) {
        const norm = name.trim().toLowerCase();
        const sheet = wb.Sheets[name];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        if (norm === "energy") {
          const rows = raw.map((r) => mapRow(r, ENERGY_FIELDS)).filter((r) => r.usn);
          sheets.push({ table: "energy_sites", rows });
        } else if (norm === "water") {
          const rows = raw.map((r) => mapRow(r, WATER_FIELDS)).filter((r) => r.serial_number);
          sheets.push({ table: "water_sites", rows });
        }
      }
      if (!sheets.length) throw new Error("No 'Energy' or 'Water' sheet found.");
      setParsed(sheets);
      setProgress("");
    } catch (err) {
      toast.error((err as Error).message);
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmUpload() {
    if (!parsed) return;
    setBusy(true);
    const counts: Record<string, number> = {};
    try {
      for (const s of parsed) {
        const conflictCol = s.table === "energy_sites" ? "usn" : "serial_number";
        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < s.rows.length; i += CHUNK) {
          const slice = s.rows.slice(i, i + CHUNK);
          setProgress(`Uploading ${s.table === "energy_sites" ? "Energy" : "Water"} ${i + slice.length}/${s.rows.length}…`);
          const { error } = await supabase.from(s.table as never).upsert(slice as never, { onConflict: conflictCol });
          if (error) throw error;
          inserted += slice.length;
        }
        counts[s.table] = inserted;
      }
      toast.success(`Uploaded ${counts.energy_sites ?? 0} Energy sites, ${counts.water_sites ?? 0} Water sites`);
      setParsed(null);
      setProgress("");
    } catch (err) {
      toast.error("Upload failed: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-[#111]">Master Tracker Upload</h2>
        <p className="text-xs text-muted-foreground mt-1">Upload the .xlsb file. The Energy and Water sheets will be detected automatically. Re-uploading refreshes existing rows (matched by USN / Serial Number).</p>
        <input type="file" accept=".xlsb,.xlsx,.xls" onChange={onFile} disabled={busy}
          className="mt-3 block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-xs file:font-medium hover:file:opacity-90" />
        {progress && <p className="text-xs text-muted-foreground mt-2">{progress}</p>}
      </div>

      {parsed && parsed.map((s) => (
        <div key={s.table} className="border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#111]">
              {s.table === "energy_sites" ? "Energy" : "Water"} — {s.rows.length} rows
            </h3>
          </div>
          <PreviewTable rows={s.rows.slice(0, 5)} fields={s.table === "energy_sites" ? ENERGY_FIELDS : WATER_FIELDS} />
        </div>
      ))}

      {parsed && (
        <button onClick={confirmUpload} disabled={busy}
          className="w-full sm:w-auto px-5 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60">
          {busy ? "Uploading…" : "Confirm upload"}
        </button>
      )}
    </div>
  );
}

function PreviewTable({ rows, fields }: { rows: Record<string, string | null>[]; fields: { key: string; label: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs min-w-full">
        <thead>
          <tr className="text-left text-muted-foreground">
            {fields.slice(0, 8).map((f) => <th key={f.key} className="py-2 pr-4 font-medium whitespace-nowrap">{f.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              {fields.slice(0, 8).map((f) => <td key={f.key} className="py-2 pr-4 whitespace-nowrap">{r[f.key] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Verification {
  id: string; usn: string; site_type: string; surveyor_name: string | null;
  visited_at: string; status: string; wrong_fields: string | null; notes: string | null;
}

function VerificationsTab() {
  const [rows, setRows] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"all" | "correct" | "wrong">("all");
  const [siteType, setSiteType] = useState<"all" | "energy" | "water">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("verifications" as never).select("*").order("visited_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Verification[]) ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (siteType !== "all" && r.site_type !== siteType) return false;
    if (from && new Date(r.visited_at) < new Date(from)) return false;
    if (to && new Date(r.visited_at) > new Date(to + "T23:59:59")) return false;
    return true;
  }), [rows, status, siteType, from, to]);

  function exportWrong() {
    const wrong = filtered.filter((r) => r.status === "wrong");
    const headers = ["USN", "Site Type", "Surveyor", "Visited At", "Wrong Fields", "Notes"];
    const csv = [headers.join(",")].concat(
      wrong.map((r) => [r.usn, r.site_type, r.surveyor_name ?? "", r.visited_at, r.wrong_fields ?? "", r.notes ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wrong_info_report_${date}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <select value={siteType} onChange={(e) => setSiteType(e.target.value as never)} className="h-9 px-2 text-sm border border-input rounded-md bg-white">
          <option value="all">All types</option><option value="energy">Energy</option><option value="water">Water</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as never)} className="h-9 px-2 text-sm border border-input rounded-md bg-white">
          <option value="all">All status</option><option value="correct">Correct</option><option value="wrong">Wrong</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 text-sm border border-input rounded-md bg-white" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 text-sm border border-input rounded-md bg-white" />
        <button onClick={exportWrong} className="h-9 px-3 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90">
          Export Wrong CSV
        </button>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              {["USN", "Type", "Surveyor", "Visited", "Status", "Wrong Fields", "Notes"].map((h) => (
                <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No verifications yet.</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{r.usn}</td>
                <td className="px-3 py-2 capitalize">{r.site_type}</td>
                <td className="px-3 py-2">{r.surveyor_name ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.visited_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {r.status === "correct"
                    ? <span className="px-2 py-0.5 rounded-full bg-[color:var(--success)]/10 text-[color:var(--success)] text-[11px] font-medium">Correct</span>
                    : <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[11px] font-medium">Wrong</span>}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={r.wrong_fields ?? ""}>{r.wrong_fields ?? "—"}</td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={r.notes ?? ""}>{r.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
