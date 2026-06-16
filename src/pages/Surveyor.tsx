import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ENERGY_FIELDS, WATER_FIELDS } from "@/lib/fields";

type SiteType = "energy" | "water";
type SiteRow = Record<string, string | null> & { id: string };

export default function Surveyor() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [siteType, setSiteType] = useState<SiteType>("energy");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [query, setQuery] = useState("");
  const [site, setSite] = useState<SiteRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [wrongOpen, setWrongOpen] = useState(false);

  // Editable fields
  const [edit, setEdit] = useState({
    date_survey_completed: "",
    assigned_surveyor: "",
    action_required: "",
    surveyor_remarks: "",
  });

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "surveyor") { navigate("/"); return; }
    setSession(s);
  }, [navigate]);

  if (!session) return null;
  const fields = siteType === "energy" ? ENERGY_FIELDS : WATER_FIELDS;
  const usnKey = siteType === "energy" ? "usn" : "serial_number";
  const table = siteType === "energy" ? "energy_sites" : "water_sites";

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setSite(null);
    let q = supabase.from(table as never).select("*").eq(usnKey, query.trim());
    if (assignedFilter.trim()) q = q.ilike("assigned_surveyor", `%${assignedFilter.trim()}%`);
    if (dateFilter) q = q.eq("date_survey_completed", dateFilter);
    const { data, error } = await q.maybeSingle();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("No site found"); return; }
    const row = data as SiteRow;
    setSite(row);
    setEdit({
      date_survey_completed: row.date_survey_completed ?? "",
      assigned_surveyor: row.assigned_surveyor ?? session!.username,
      action_required: row.action_required ?? "",
      surveyor_remarks: row.surveyor_remarks ?? "",
    });
  }

  async function saveUpdates() {
    if (!session || !site) return;
    const patch = {
      date_survey_completed: edit.date_survey_completed || null,
      assigned_surveyor: edit.assigned_surveyor || null,
      action_required: edit.action_required || null,
      surveyor_remarks: edit.surveyor_remarks || null,
    };
    const { error: upErr } = await supabase
      .from(table as never)
      .update(patch as never)
      .eq(usnKey, String(site[usnKey] ?? ""));
    if (upErr) { toast.error(upErr.message); return; }

    const { error: vErr } = await supabase.from("verifications" as never).insert({
      usn: String(site[usnKey] ?? ""), site_type: siteType,
      surveyor_name: session.username, status: "updated",
      completed_date: edit.date_survey_completed || null,
      remarks: edit.surveyor_remarks || null,
      notes: edit.action_required || null,
    } as never);
    if (vErr) toast.error(vErr.message);
    else {
      toast.success("Updates saved ✓");
      setSite({ ...site, ...patch });
    }
  }

  async function markCorrect() {
    if (!session || !site) return;
    const { error } = await supabase.from("verifications" as never).insert({
      usn: String(site[usnKey] ?? ""), site_type: siteType,
      surveyor_name: session.username, status: "correct",
      remarks: edit.surveyor_remarks || null,
      completed_date: edit.date_survey_completed || null,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success("Saved to cloud ✓"); setSite(null); setQuery(""); }
  }

  async function saveWrong(wrongFields: string[], notes: string) {
    if (!session || !site) return;
    const { error } = await supabase.from("verifications" as never).insert({
      usn: String(site[usnKey] ?? ""), site_type: siteType,
      surveyor_name: session.username, status: "wrong",
      wrong_fields: wrongFields.join(", "), notes: notes || null,
      remarks: edit.surveyor_remarks || null,
      completed_date: edit.date_survey_completed || null,
    } as never);
    if (error) toast.error(error.message);
    else { toast.success("Saved to cloud ✓"); setSite(null); setQuery(""); setWrongOpen(false); }
  }

  return (
    <AppShell session={session}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {(["energy", "water"] as const).map((t) => (
              <button key={t} onClick={() => { setSiteType(t); setSite(null); }}
                className={`flex-1 px-3 h-9 text-sm font-medium capitalize ${siteType === t ? "bg-primary text-primary-foreground" : "bg-white text-[#111]"}`}>
                {t}
              </button>
            ))}
          </div>
          <input placeholder="Filter assigned surveyor" value={assignedFilter} onChange={(e) => setAssignedFilter(e.target.value)}
            className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
        </div>

        <form onSubmit={search} className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={siteType === "energy" ? "Enter USN" : "Enter Serial Number"}
            className="flex-1 h-11 px-3 text-base border border-input rounded-md bg-white outline-none focus:ring-2 focus:ring-ring" />
          <button type="submit" disabled={loading} className="px-5 h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-60">
            {loading ? "…" : "Search"}
          </button>
        </form>

        {site && (
          <>
            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#111]">{site.building_name || "Site details"}</h3>
              <dl className="divide-y divide-border">
                {fields.map((f) => (
                  <div key={f.key} className="py-2 grid grid-cols-3 gap-2 text-xs">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="col-span-2 text-[#111] break-words">{site[f.key] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border border-border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#111]">Field updates</h3>
              <p className="text-xs text-muted-foreground">Edit and save — the admin will see your changes against this USN.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-[#111]">Date (Survey Completed)</label>
                  <input type="date" value={edit.date_survey_completed}
                    onChange={(e) => setEdit({ ...edit, date_survey_completed: e.target.value })}
                    className="mt-1 w-full h-10 px-3 text-sm border border-input rounded-md bg-white" />
                </div>
                <div>
                  <label className="text-xs font-medium text-[#111]">Assigned Surveyor</label>
                  <input value={edit.assigned_surveyor}
                    onChange={(e) => setEdit({ ...edit, assigned_surveyor: e.target.value })}
                    className="mt-1 w-full h-10 px-3 text-sm border border-input rounded-md bg-white" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#111]">Action Required</label>
                <input value={edit.action_required}
                  onChange={(e) => setEdit({ ...edit, action_required: e.target.value })}
                  className="mt-1 w-full h-10 px-3 text-sm border border-input rounded-md bg-white" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#111]">Surveyor Remarks</label>
                <textarea value={edit.surveyor_remarks} rows={3}
                  onChange={(e) => setEdit({ ...edit, surveyor_remarks: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-md bg-white" />
              </div>

              <button onClick={saveUpdates}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
                💾 Save Updates
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border">
                <button onClick={markCorrect} className="h-12 rounded-md bg-[color:var(--success)] text-white text-sm font-semibold hover:opacity-90">
                  ✅ Mark as Correct
                </button>
                <button onClick={() => setWrongOpen(true)} className="h-12 rounded-md bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90">
                  ❌ Wrong Info
                </button>
              </div>
            </div>
          </>
        )}

        {wrongOpen && site && (
          <WrongDialog fields={fields} onCancel={() => setWrongOpen(false)} onSave={saveWrong} />
        )}
      </div>
    </AppShell>
  );
}

function WrongDialog({ fields, onCancel, onSave }: { fields: { key: string; label: string }[]; onCancel: () => void; onSave: (w: string[], notes: string) => void }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  function toggle(k: string) {
    const n = new Set(checked);
    if (n.has(k)) n.delete(k); else n.add(k);
    setChecked(n);
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-20 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-border sticky top-0 bg-white">
          <h3 className="text-sm font-semibold text-[#111]">Flag wrong fields</h3>
        </div>
        <div className="p-4 space-y-2">
          {fields.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={checked.has(f.label)} onChange={() => toggle(f.label)} className="h-4 w-4 accent-[color:var(--primary)]" />
              <span>{f.label}</span>
            </label>
          ))}
          <div className="pt-2">
            <label className="text-xs font-medium text-[#111]">Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="mt-1 w-full px-3 py-2 text-sm border border-input rounded-md bg-white outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 sticky bottom-0 bg-white">
          <button onClick={onCancel} className="flex-1 h-10 rounded-md border border-input text-sm font-medium">Cancel</button>
          <button onClick={() => onSave([...checked], notes)} disabled={checked.size === 0}
            className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
