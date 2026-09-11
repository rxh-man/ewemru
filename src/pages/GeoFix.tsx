import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import * as XLSX from "xlsx";
import eandLogo from "@/assets/eand.png";
import { supabase } from "@/integrations/supabase/client";
import {
  type GeoSession, type Meter, type GeoRequest, type FieldUser,
  SCENARIOS, type ScenarioKey, addFieldUser, geoLogin, geoLogout, getGeoSession,
  listFieldUsers, listRequests, myRequests, removeFieldUser, reviewRequest,
  scenarioTitle, searchMeters, weekLabel,
} from "@/lib/geofix";

const panel = "rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm";
const field =
  "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#e30613] focus:ring-1 focus:ring-[#e30613]";
const btn =
  "rounded-lg bg-[#e30613] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#c00510] disabled:opacity-40";
const ghost =
  "rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/70 transition hover:border-white/40 hover:text-white";

function Shell({ session, onLogout, children }: { session: GeoSession | null; onLogout: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{ background: "radial-gradient(1000px 500px at 12% -10%, rgba(227,6,19,0.30), transparent 60%), radial-gradient(700px 420px at 100% 110%, rgba(227,6,19,0.16), transparent 65%)" }}
      />
      <header className="relative border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={eandLogo} alt="e&" className="h-6 w-auto" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">GeoFix</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">AMI Location Intelligence</div>
            </div>
          </div>
          {session && (
            <div className="flex items-center gap-3">
              <div className="text-right leading-tight">
                <div className="text-xs font-medium">{session.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-[#ff5a63]">{session.role === "manager" ? "Manager" : "Field engineer"}</div>
              </div>
              <button onClick={onLogout} className={ghost}>Sign out</button>
            </div>
          )}
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-4 py-6">{children}</main>
      <Toaster position="top-center" theme="dark" richColors />
    </div>
  );
}

function Login({ onDone }: { onDone: (s: GeoSession) => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const s = await geoLogin(u, p);
      if (!s) { toast.error("Invalid username or password"); return; }
      onDone(s);
    } catch { toast.error("Sign in failed, try again"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-md pt-6">
      <div className={`${panel} p-6`}>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-xs text-white/50">Meter location rectification for the AMI programme.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input className={field} placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none" />
          <input className={field} type="password" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />
          <button className={`${btn} w-full`} disabled={busy}>{busy ? "Checking..." : "Enter GeoFix"}</button>
        </form>
        <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-white/30">Restricted access · D&amp;O</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/35">{label}</div>
      <div className="text-xs text-white/90">{value === null || value === undefined || value === "" ? "-" : value}</div>
    </div>
  );
}

function FieldView({ session }: { session: GeoSession }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Meter[]>([]);
  const [busy, setBusy] = useState(false);
  const [meter, setMeter] = useState<Meter | null>(null);
  const [scenario, setScenario] = useState<ScenarioKey | null>(null);
  const [mine, setMine] = useState<GeoRequest[]>([]);

  // scenario inputs
  const [foundSerial, setFoundSerial] = useState("");
  const [foundPlacement, setFoundPlacement] = useState("nearby");
  const [foundMeter, setFoundMeter] = useState<Meter | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  async function refreshMine() {
    try { setMine(await myRequests(session.username)); } catch { /* ignore */ }
  }
  useEffect(() => { refreshMine(); }, [session.username]);

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (term.trim().length < 3) { toast.error("Enter at least 3 characters"); return; }
    setBusy(true);
    try {
      const r = await searchMeters(term);
      setResults(r);
      if (!r.length) toast.error("No meter found for that number");
    } catch { toast.error("Search failed"); }
    finally { setBusy(false); }
  }

  function pick(m: Meter) {
    setMeter(m); setResults([]); setScenario(null);
    setFoundSerial(""); setFoundMeter(null); setRemarks("");
    setLat(m.latitude != null ? String(m.latitude) : "");
    setLng(m.longitude != null ? String(m.longitude) : "");
  }

  async function lookupFound() {
    if (foundSerial.trim().length < 3) return;
    try {
      const r = await searchMeters(foundSerial);
      const exact = r.find((x) => x.serial.toUpperCase() === foundSerial.trim().toUpperCase()) || r[0] || null;
      setFoundMeter(exact);
      if (!exact) toast.error("That meter is not in the master sheet");
    } catch { toast.error("Lookup failed"); }
  }

  function useDeviceGps() {
    if (!navigator.geolocation) { toast.error("GPS not available on this device"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude.toFixed(7)); setLng(pos.coords.longitude.toFixed(7)); toast.success("Coordinates captured"); },
      () => toast.error("Could not read GPS, enter manually"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function submit() {
    if (!meter || !scenario) return;
    const nLat = lat.trim() ? Number(lat) : null;
    const nLng = lng.trim() ? Number(lng) : null;
    if (scenario === "coords_wrong" && (nLat === null || nLng === null || Number.isNaN(nLat) || Number.isNaN(nLng))) {
      toast.error("Enter the correct latitude and longitude"); return;
    }
    if (scenario === "wrong_meter" && foundSerial.trim().length < 3) {
      toast.error("Enter the meter serial found on site"); return;
    }
    if (!remarks.trim()) { toast.error("Add a short remark"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("geofix_requests").insert({
        meter_id: meter.id,
        utility: meter.utility,
        serial: meter.serial,
        scenario,
        old_latitude: meter.latitude,
        old_longitude: meter.longitude,
        new_latitude: scenario === "no_meter" ? null : nLat,
        new_longitude: scenario === "no_meter" ? null : nLng,
        found_serial: scenario === "wrong_meter" ? foundSerial.trim().toUpperCase() : null,
        found_placement: scenario === "wrong_meter" ? foundPlacement : null,
        found_meter_new_latitude: scenario === "wrong_meter" && foundPlacement === "nearby" ? meter.latitude : null,
        found_meter_new_longitude: scenario === "wrong_meter" && foundPlacement === "nearby" ? meter.longitude : null,
        building_name: meter.building_name,
        area: meter.area,
        remarks: remarks.trim(),
        submitted_by: session.username,
        submitted_by_name: session.name,
        week_label: weekLabel(),
      });
      if (error) throw error;
      toast.success("Rectification sent to your manager");
      setMeter(null); setScenario(null); setTerm(""); setRemarks("");
      refreshMine();
    } catch { toast.error("Could not submit, try again"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className={`${panel} p-5`}>
        <h2 className="text-base font-semibold">Search a meter</h2>
        <p className="mt-1 text-xs text-white/50">Meter serial number, MSN, account number or premise.</p>
        <form onSubmit={doSearch} className="mt-3 flex gap-2">
          <input className={field} placeholder="e.g. E1P150015045" value={term} onChange={(e) => setTerm(e.target.value)} autoCapitalize="characters" />
          <button className={btn} disabled={busy}>{busy ? "..." : "Search"}</button>
        </form>
        {results.length > 0 && (
          <div className="mt-3 space-y-2">
            {results.map((m) => (
              <button key={m.id} onClick={() => pick(m)} className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-left transition hover:border-[#e30613]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{m.serial}</span>
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">{m.utility}</span>
                </div>
                <div className="mt-1 text-[11px] text-white/50">{[m.building_name, m.area, m.premise_desc].filter(Boolean).join(" · ") || "No building info"}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {meter && (
        <div className={`${panel} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{meter.serial}</div>
              <div className="text-[11px] text-white/45">{meter.utility === "energy" ? "Energy meter" : "Water meter"}</div>
            </div>
            <button onClick={() => setMeter(null)} className={ghost}>Clear</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Row label="MSN" value={meter.msn} />
            <Row label="Account" value={meter.acc_no} />
            <Row label="Premise" value={meter.premise} />
            <Row label="Area" value={meter.area} />
            <Row label="MRU" value={meter.mru} />
            <Row label="Type" value={meter.meter_type} />
            <Row label="Premise desc" value={meter.premise_desc} />
            <Row label="Building" value={meter.building_name} />
            <Row label="Building ID" value={meter.building_id} />
            <Row label="Recorded coordinates" value={meter.raw_location} />
            <Row label="Install status" value={meter.install_status} />
            <Row label="Action required" value={meter.action_required} />
          </div>

          <div className="mt-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">What did you find on site?</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {SCENARIOS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key)}
                  className={`rounded-lg border p-3 text-left transition ${scenario === s.key ? "border-[#e30613] bg-[#e30613]/10" : "border-white/10 bg-black/30 hover:border-white/30"}`}
                >
                  <div className="text-xs font-semibold">{s.title}</div>
                  <div className="mt-1 text-[11px] text-white/45">{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {scenario && (
            <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
              {scenario === "wrong_meter" && (
                <>
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Meter serial actually installed here</div>
                    <div className="flex gap-2">
                      <input className={field} value={foundSerial} onChange={(e) => setFoundSerial(e.target.value)} placeholder="Serial found on site" autoCapitalize="characters" />
                      <button type="button" onClick={lookupFound} className={ghost}>Find</button>
                    </div>
                  </div>
                  {foundMeter && (
                    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                      <div className="text-xs font-semibold">{foundMeter.serial}</div>
                      <div className="mt-1 text-[11px] text-white/50">
                        Master record: {foundMeter.building_name || "no building"} · {foundMeter.raw_location || "no coordinates"}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Where does the found meter belong?</div>
                    <div className="flex gap-2">
                      {[["nearby", "Belongs nearby / same location"], ["misplaced", "Completely misplaced"]].map(([v, l]) => (
                        <button key={v} type="button" onClick={() => setFoundPlacement(v)}
                          className={`flex-1 rounded-lg border px-3 py-2 text-[11px] ${foundPlacement === v ? "border-[#e30613] bg-[#e30613]/10 text-white" : "border-white/10 text-white/60"}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {foundPlacement === "nearby" && (
                      <p className="mt-2 text-[11px] text-white/40">
                        On approval, {foundSerial ? foundSerial.toUpperCase() : "the found meter"} takes these coordinates.
                      </p>
                    )}
                  </div>
                </>
              )}

              {scenario !== "no_meter" && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                    Correct coordinates for {meter.serial}
                  </div>
                  <div className="flex gap-2">
                    <input className={field} value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Latitude" inputMode="decimal" />
                    <input className={field} value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Longitude" inputMode="decimal" />
                  </div>
                  <button type="button" onClick={useDeviceGps} className={`${ghost} mt-2`}>Use my current location</button>
                </div>
              )}

              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Remarks</div>
                <textarea className={`${field} min-h-24`} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="What you observed on site" />
              </div>
              <button onClick={submit} disabled={saving} className={`${btn} w-full`}>{saving ? "Sending..." : "Submit rectification"}</button>
            </div>
          )}
        </div>
      )}

      <div className={`${panel} p-5`}>
        <h2 className="text-base font-semibold">My recent submissions</h2>
        {mine.length === 0 ? (
          <p className="mt-2 text-xs text-white/40">Nothing submitted yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {mine.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{r.serial}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${r.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-white/10 text-white/60"}`}>{r.status}</span>
                </div>
                <div className="mt-1 text-[11px] text-white/50">{scenarioTitle(r.scenario)} · {new Date(r.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerView({ session }: { session: GeoSession }) {
  const [tab, setTab] = useState<"requests" | "team">("requests");
  const [reqs, setReqs] = useState<GeoRequest[]>([]);
  const [users, setUsers] = useState<FieldUser[]>([]);
  const [week, setWeek] = useState<string>(weekLabel());
  const [who, setWho] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [nu, setNu] = useState({ username: "", name: "", password: "" });

  async function load() {
    setLoading(true);
    try { setReqs(await listRequests()); setUsers(await listFieldUsers()); }
    catch { toast.error("Could not load data"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const weeks = useMemo(() => {
    const set = new Set(reqs.map((r) => r.week_label || "-"));
    set.add(weekLabel());
    return Array.from(set).sort().reverse();
  }, [reqs]);

  const filtered = useMemo(
    () => reqs.filter((r) =>
      (week === "all" || (r.week_label || "-") === week) &&
      (who === "all" || r.submitted_by === who) &&
      (status === "all" || r.status === status)),
    [reqs, week, who, status],
  );

  const stats = useMemo(() => ({
    total: filtered.length,
    pending: filtered.filter((r) => r.status === "pending").length,
    approved: filtered.filter((r) => r.status === "approved").length,
    people: new Set(filtered.map((r) => r.submitted_by)).size,
  }), [filtered]);

  async function review(r: GeoRequest, s: "approved" | "rejected") {
    try {
      await reviewRequest(r, s, session.username);
      toast.success(s === "approved" ? "Approved and master sheet updated" : "Rejected");
      load();
    } catch { toast.error("Could not update"); }
  }

  function exportXlsx() {
    const rows = filtered.map((r) => ({
      "Week": r.week_label, "Submitted at": new Date(r.created_at).toLocaleString(),
      "Field engineer": r.submitted_by_name || r.submitted_by, "Login": r.submitted_by,
      "Utility": r.utility, "Meter serial": r.serial, "Scenario": scenarioTitle(r.scenario),
      "Old latitude": r.old_latitude, "Old longitude": r.old_longitude,
      "New latitude": r.new_latitude, "New longitude": r.new_longitude,
      "Meter found on site": r.found_serial, "Found meter placement": r.found_placement,
      "Building": r.building_name, "Area": r.area, "Remarks": r.remarks,
      "Status": r.status, "Reviewed by": r.reviewed_by,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Rectifications");
    const byUser = Object.values(filtered.reduce<Record<string, Record<string, string | number>>>((acc, r) => {
      const k = r.submitted_by;
      acc[k] = acc[k] || { "Field engineer": r.submitted_by_name || k, Login: k, Requests: 0, Pending: 0, Approved: 0, Rejected: 0 };
      acc[k].Requests = Number(acc[k].Requests) + 1;
      const key = r.status.charAt(0).toUpperCase() + r.status.slice(1);
      acc[k][key] = Number(acc[k][key] ?? 0) + 1;
      return acc;
    }, {}));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byUser), "By engineer");
    XLSX.writeFile(wb, `GeoFix_Report_${week === "all" ? "all-weeks" : week}.xlsx`);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!nu.username.trim() || !nu.password.trim()) { toast.error("Username and password are required"); return; }
    try {
      await addFieldUser(nu.username, nu.name, nu.password, session.username);
      toast.success("Field engineer added");
      setNu({ username: "", name: "", password: "" });
      load();
    } catch { toast.error("Could not add, username may already exist"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["requests", "team"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider ${tab === t ? "bg-[#e30613] text-white" : "border border-white/15 text-white/60"}`}>
            {t === "requests" ? "Rectifications" : "My field team"}
          </button>
        ))}
      </div>

      {tab === "requests" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Requests", stats.total], ["Pending", stats.pending], ["Approved", stats.approved], ["Engineers active", stats.people]].map(([l, v]) => (
              <div key={String(l)} className={`${panel} p-4`}>
                <div className="text-[10px] uppercase tracking-wider text-white/40">{l}</div>
                <div className="mt-1 text-2xl font-semibold">{v}</div>
              </div>
            ))}
          </div>

          <div className={`${panel} p-4`}>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Week</div>
                <select className={field} value={week} onChange={(e) => setWeek(e.target.value)}>
                  <option value="all">All weeks</option>
                  {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Field engineer</div>
                <select className={field} value={who} onChange={(e) => setWho(e.target.value)}>
                  <option value="all">Everyone</option>
                  {users.map((u) => <option key={u.id} value={u.username}>{u.display_name || u.username}</option>)}
                </select>
              </div>
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Status</div>
                <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["all", "pending", "approved", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button onClick={exportXlsx} className={btn} disabled={!filtered.length}>Download report</button>
              <button onClick={load} className={ghost}>Refresh</button>
            </div>
          </div>

          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                <tr>
                  {["Submitted", "Engineer", "Meter", "Scenario", "Recorded", "Requested", "Found on site", "Remarks", "Status", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={10} className="px-3 py-6 text-center text-white/40">Loading...</td></tr>}
                {!loading && !filtered.length && <tr><td colSpan={10} className="px-3 py-6 text-center text-white/40">No rectification requests for this filter.</td></tr>}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-white/60">{new Date(r.created_at).toLocaleString()}<div className="text-[10px] text-white/30">{r.week_label}</div></td>
                    <td className="whitespace-nowrap px-3 py-2">{r.submitted_by_name || r.submitted_by}<div className="text-[10px] text-white/30">{r.submitted_by}</div></td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold">{r.serial}<div className="text-[10px] font-normal text-white/30">{r.building_name || r.area}</div></td>
                    <td className="px-3 py-2 text-white/70">{scenarioTitle(r.scenario)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-white/50">{r.old_latitude != null ? `${r.old_latitude}, ${r.old_longitude}` : "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-emerald-300/80">{r.new_latitude != null ? `${r.new_latitude}, ${r.new_longitude}` : "-"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-white/70">{r.found_serial || "-"}{r.found_placement ? <div className="text-[10px] text-white/30">{r.found_placement}</div> : null}</td>
                    <td className="max-w-[220px] px-3 py-2 text-white/60">{r.remarks}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${r.status === "approved" ? "bg-emerald-500/15 text-emerald-300" : r.status === "rejected" ? "bg-red-500/15 text-red-300" : "bg-white/10 text-white/60"}`}>{r.status}</span>
                      {r.reviewed_by && <div className="mt-1 text-[10px] text-white/30">by {r.reviewed_by}</div>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => review(r, "approved")} className="rounded-md bg-emerald-600/80 px-2 py-1 text-[10px] font-semibold">Approve</button>
                          <button onClick={() => review(r, "rejected")} className="rounded-md border border-white/20 px-2 py-1 text-[10px]">Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "team" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`${panel} p-5`}>
            <h2 className="text-base font-semibold">Add a field engineer</h2>
            <form onSubmit={createUser} className="mt-3 space-y-3">
              <input className={field} placeholder="Login username" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} autoCapitalize="none" />
              <input className={field} placeholder="Full name" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
              <input className={field} placeholder="Password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
              <button className={`${btn} w-full`}>Create account</button>
            </form>
          </div>
          <div className={`${panel} p-5`}>
            <h2 className="text-base font-semibold">Team under me</h2>
            <div className="mt-3 space-y-2">
              {users.map((u) => {
                const count = reqs.filter((r) => r.submitted_by === u.username).length;
                return (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3">
                    <div>
                      <div className="text-xs font-semibold">{u.display_name || u.username}</div>
                      <div className="text-[10px] text-white/40">{u.username} · {count} rectifications</div>
                    </div>
                    <button onClick={async () => { await removeFieldUser(u.id); toast.success("Removed"); load(); }} className={ghost}>Remove</button>
                  </div>
                );
              })}
              {!users.length && <p className="text-xs text-white/40">No field engineers yet.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GeoFix() {
  const [session, setSession] = useState<GeoSession | null>(getGeoSession());
  return (
    <Shell session={session} onLogout={() => { geoLogout(); setSession(null); }}>
      {!session ? <Login onDone={setSession} /> : session.role === "manager" ? <ManagerView session={session} /> : <FieldView session={session} />}
    </Shell>
  );
}
