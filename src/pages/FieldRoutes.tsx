import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, login, logout, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import { R } from "@/lib/routes";
import eandLogo from "@/assets/eand.png";
import { decodePolyline, fetchRoadRoutes, type RoadLeg } from "@/lib/roadRoute";

const TEMPLATE_HEADERS = [
  "SERIALNUMBER", "Badge", "DISTRICT", "SUBDISTRICT", "CITYNAME", "REGION", "SECTOR",
  "PLOT", "Latitude", "Longitude", "Priority", "Status", "Planned - Date of Visit", "Team No",
];
const TEMPLATE_ROWS = [
  ["401020944427", "401020944427", "HILI", "NAHSHILAH", "Al Ain", "AA", "NAHSHILAH", "140C", 24.400777, 55.13585, "P3", "Pending to Visit", "2026-08-18", "Team 1"],
  ["401020944880", "401020944880", "RAMLAT SWEIHAN", "NAHSHILAH", "Al Ain", "AA", "NAHSHILAH", "63S", 24.41182, 55.1257, "P3", "Pending to Visit", "2026-08-18", "Team 1"],
];

const PLAN_URL = `${import.meta.env.BASE_URL}aadc-plan.xlsx`;

const TEAM_COLORS = [
  "#dc2626", "#7f1d1d", "#b91c1c", "#ef4444", "#991b1b", "#f87171", "#450a0a",
  "#e11d48", "#9f1239", "#fb7185", "#c2410c", "#a21caf",
];

interface Stop {
  day: string; team: string; order: number; serial: string; district: string; subdistrict: string;
  city: string; region: string; sector: string; plot: string; priority: string; status: string;
  lat: number; lng: number;
}

function norm(k: string) { return k.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(norm(k))) {
      const v = row[k];
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

function toDay(raw: string): string {
  if (!raw) return "Unplanned";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw;
}

function dayLabel(d: string) {
  const t = new Date(`${d}T00:00:00`);
  if (isNaN(t.getTime())) return d;
  return t.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function teamKey(t: string) {
  const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 9999 : n;
}

function numberedIcon(n: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;min-width:24px;height:24px;padding:0 4px;border-radius:12px;display:flex;align-items:center;justify-content:center;font:600 10px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 13);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [points, map]);
  return null;
}

function haversine(a: Stop, b: Stop) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pathLength(list: Stop[]) {
  let d = 0;
  for (let i = 1; i < list.length; i++) d += haversine(list[i - 1], list[i]);
  return d;
}

const OUTLIER_KM = 12;

/** Split stops whose nearest neighbour is unreasonably far (likely bad coordinates). */
function splitOutliers(list: Stop[]): { core: Stop[]; outliers: Stop[] } {
  if (list.length < 4) return { core: list, outliers: [] };
  const core: Stop[] = [];
  const outliers: Stop[] = [];
  list.forEach((s, i) => {
    let min = Infinity;
    for (let j = 0; j < list.length; j++) {
      if (j === i) continue;
      const d = haversine(s, list[j]);
      if (d < min) min = d;
      if (min <= OUTLIER_KM) break;
    }
    (min > OUTLIER_KM ? outliers : core).push(s);
  });
  if (!core.length) return { core: list, outliers: [] };
  return { core, outliers };
}



/** Nearest-neighbour ordering + 2-opt refinement so consecutive stops are the closest ones. */
function optimizeRoute(list: Stop[]): Stop[] {
  if (list.length < 3) return list;
  const remaining = list.slice(1);
  const order = [list[0]];
  while (remaining.length) {
    const cur = order[order.length - 1];
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(cur, remaining[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    order.push(remaining.splice(best, 1)[0]);
  }
  // 2-opt (bounded passes to stay fast on large days)
  const n = order.length;
  const maxPasses = n > 300 ? 1 : 6;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 0; i < n - 2; i++) {
      for (let k = i + 2; k < n; k++) {
        const a = order[i], b = order[i + 1], c = order[k], d = order[k + 1];
        const delta = haversine(a, c) + (d ? haversine(b, d) : 0) - haversine(a, b) - (d ? haversine(c, d) : 0);
        if (delta < -1e-9) {
          let x = i + 1, y = k;
          while (x < y) { const t = order[x]; order[x] = order[y]; order[y] = t; x++; y--; }
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return order;
}

function parseWorkbook(buf: ArrayBuffer): Stop[] {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames.find((n) => {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: "" });
    return rows.length > 0 && Object.keys(rows[0]).some((k) => ["latitude", "lat"].includes(norm(k)));
  }) ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
  const counters = new Map<string, number>();
  const out: Stop[] = [];
  rows.forEach((row) => {
    const lat = parseFloat(pick(row, ["latitude", "lat", "y", "ycoordinate"]));
    const lng = parseFloat(pick(row, ["longitude", "long", "lng", "lon", "x", "xcoordinate"]));
    if (!isFinite(lat) || !isFinite(lng)) return;
    const day = toDay(pick(row, ["planneddateofvisit", "planneddate", "dateofvisit", "visitdate", "date", "day"]));
    const team = pick(row, ["teamno", "team", "teamnumber", "crew"]) || "Team 1";
    const key = `${day}|${team}`;
    const order = (counters.get(key) ?? 0) + 1;
    counters.set(key, order);
    out.push({
      day, team, order, lat, lng,
      serial: pick(row, ["serialnumber", "serial", "badge", "usn", "siteid"]),
      district: pick(row, ["district"]),
      subdistrict: pick(row, ["subdistrict"]),
      city: pick(row, ["cityname", "city"]),
      region: pick(row, ["region"]),
      sector: pick(row, ["sector"]),
      plot: pick(row, ["plot"]),
      priority: pick(row, ["priority"]),
      status: pick(row, ["status"]),
    });
  });
  return out;
}

/** Default UAE public holidays to exclude (editable in the UI). */
const DEFAULT_HOLIDAYS = "2026-12-02, 2026-12-03";

function parseHolidays(raw: string): Set<string> {
  return new Set(
    raw.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
  );
}

/** Builds working dates from a start date, honouring selected weekdays and excluded holidays. */
function workingDates(start: string, count: number, workdays: number[], holidays: Set<string>): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00`);
  if (isNaN(d.getTime()) || !workdays.length) return out;
  let guard = 0;
  while (out.length < count && guard < 2000) {
    const iso = d.toISOString().slice(0, 10);
    if (workdays.includes(d.getDay()) && !holidays.has(iso)) out.push(iso);
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

interface PlanConfig {
  teams: number;
  target: number;
  start: string;
  workdays: number[];
  holidays: Set<string>;
}

/**
 * Geographic auto-planner: sequences every coordinate into one shortest chain,
 * slices it into day-sized clusters and spreads those clusters across teams and working days.
 */
function buildPlan(list: Stop[], cfg: PlanConfig): Stop[] {
  const ordered = optimizeRoute(list);
  const chunks: Stop[][] = [];
  for (let i = 0; i < ordered.length; i += cfg.target) chunks.push(ordered.slice(i, i + cfg.target));
  const dayCount = Math.ceil(chunks.length / cfg.teams);
  const dates = workingDates(cfg.start, dayCount, cfg.workdays, cfg.holidays);
  const out: Stop[] = [];
  chunks.forEach((chunk, i) => {
    const dayIdx = Math.floor(i / cfg.teams);
    const day = dates[dayIdx] ?? "Unplanned";
    const team = `Team ${(i % cfg.teams) + 1}`;
    optimizeRoute(chunk).forEach((s, j) => out.push({ ...s, day, team, order: j + 1 }));
  });
  return out;
}


export default function FieldRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("");
  const [team, setTeam] = useState("all");
  const [optimize, setOptimize] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [teamCount, setTeamCount] = useState(4);
  const [targetPerDay, setTargetPerDay] = useState(15);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [workdays, setWorkdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [holidayText, setHolidayText] = useState(DEFAULT_HOLIDAYS);
  const [planned, setPlanned] = useState(false);
  const [roadMode, setRoadMode] = useState(false);
  const [roadLegs, setRoadLegs] = useState<Record<string, RoadLeg>>({});
  const [roadLoading, setRoadLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    const s = getSession();
    if (s?.role === "routes") setSession(s);
  }, [navigate]);

  function handlePlannerLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    const nextSession = login(username, password);
    if (!nextSession || nextSession.role !== "routes") {
      if (nextSession) logout();
      setLoginError("Use your Field Visit Planning account to continue.");
      return;
    }
    sessionStorage.setItem("post_login", R.routes);
    navigate(R.welcome);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(PLAN_URL);
        if (!res.ok) throw new Error(String(res.status));
        const parsed = parseWorkbook(await res.arrayBuffer());
        if (!alive) return;
        setStops(parsed);
        setFileName("AADC_-_Plan.xlsx (baseline plan)");
        setDay(parsed[0]?.day ?? "");
      } catch {
        if (alive) toast.error("Baseline plan could not be loaded. Upload an Excel file to continue.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const days = useMemo(() => Array.from(new Set(stops.map((s) => s.day))).sort(), [stops]);
  const teams = useMemo(
    () => Array.from(new Set(stops.map((s) => s.team))).sort((a, b) => teamKey(a) - teamKey(b)),
    [stops],
  );
  const teamColor = (t: string) => TEAM_COLORS[Math.max(0, teams.indexOf(t)) % TEAM_COLORS.length];

  const dayStops = useMemo(
    () => stops.filter((s) => s.day === day && (team === "all" || s.team === team)),
    [stops, day, team],
  );

  const routes = useMemo(() => {
    const byTeam = new Map<string, Stop[]>();
    dayStops.forEach((s) => byTeam.set(s.team, [...(byTeam.get(s.team) ?? []), s]));
    return Array.from(byTeam.entries())
      .sort((a, b) => teamKey(a[0]) - teamKey(b[0]))
      .map(([t, list]) => {
        const seq = [...list].sort((a, b) => a.order - b.order);
        if (!optimize) return { team: t, color: teamColor(t), stops: seq, outliers: [] as Stop[] };
        const { core, outliers } = splitOutliers(seq);
        const ordered = optimizeRoute(core);
        // far / suspect points are pushed to the very end of the visit order
        const tail = optimizeRoute(outliers);
        return { team: t, color: teamColor(t), stops: [...ordered, ...tail], outliers: tail };
      });
  }, [dayStops, teams, optimize]);

  const outlierCount = useMemo(() => routes.reduce((n, r) => n + r.outliers.length, 0), [routes]);

  const routeKm = useMemo(
    () => routes.reduce((sum, r) => sum + pathLength(r.stops.filter((s) => !r.outliers.includes(s))), 0),
    [routes],
  );

  /** Road-following paths (Google Routes API) — fetched only while road mode is on. */
  useEffect(() => {
    if (!roadMode) { setRoadLegs({}); return; }
    const legs = routes.map((r) => ({
      key: r.team,
      coords: r.stops.filter((s) => !r.outliers.includes(s)).map((s) => [s.lat, s.lng] as [number, number]),
    })).filter((l) => l.coords.length >= 2);
    if (!legs.length) { setRoadLegs({}); return; }
    let alive = true;
    setRoadLoading(true);
    fetchRoadRoutes(legs)
      .then((res) => { if (alive) setRoadLegs(res); })
      .catch((e) => {
        if (!alive) return;
        setRoadMode(false);
        toast.error("Road routing unavailable", { description: e instanceof Error ? e.message.slice(0, 180) : "Try again" });
      })
      .finally(() => { if (alive) setRoadLoading(false); });
    return () => { alive = false; };
  }, [roadMode, routes]);

  const roadKm = useMemo(
    () => Object.values(roadLegs).reduce((s, l) => s + (l.km ?? 0), 0),
    [roadLegs],
  );


  const points = useMemo(
    () => routes.flatMap((r) => r.stops.map((s) => [s.lat, s.lng] as [number, number])),
    [routes],
  );

  /** Baseline (sheet order) distance for the same day, used to quantify the AI saving. */
  const baselineKm = useMemo(() => {
    const byTeam = new Map<string, Stop[]>();
    dayStops.forEach((s) => byTeam.set(s.team, [...(byTeam.get(s.team) ?? []), s]));
    return Array.from(byTeam.values()).reduce(
      (sum, list) => sum + pathLength([...list].sort((a, b) => a.order - b.order)),
      0,
    );
  }, [dayStops]);

  const insights = useMemo(() => {
    const visits = dayStops.length;
    const saved = Math.max(0, baselineKm - routeKm);
    const savedPct = baselineKm > 0 ? (saved / baselineKm) * 100 : 0;
    const perTeam = routes.map((r) => r.stops.length);
    const maxT = Math.max(1, ...perTeam);
    const minT = Math.min(...(perTeam.length ? perTeam : [0]));
    const balance = perTeam.length > 1 ? Math.round((minT / maxT) * 100) : 100;
    const density = visits > 0 && routeKm > 0 ? visits / routeKm : 0;
    const hours = routeKm / 45 + visits * 0.35; // drive time + avg 21 min per site
    const fuelAed = (routeKm / 11) * 3.49;
    const confidence = Math.max(
      45,
      Math.min(99, Math.round(96 - (outlierCount / Math.max(1, visits)) * 180)),
    );
    const topArea = (() => {
      const m = new Map<string, number>();
      dayStops.forEach((s) => {
        const k = s.subdistrict || s.district || s.city || "Unspecified";
        m.set(k, (m.get(k) ?? 0) + 1);
      });
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0];
    })();
    const priorityMix = (() => {
      const m = new Map<string, number>();
      dayStops.forEach((s) => m.set(s.priority || "Unset", (m.get(s.priority || "Unset") ?? 0) + 1));
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    })();
    return { visits, saved, savedPct, balance, density, hours, fuelAed, confidence, topArea, priorityMix, maxT, minT };
  }, [dayStops, routes, routeKm, baselineKm, outlierCount]);

  const narrative = useMemo(() => {
    const out: { tone: "good" | "warn" | "info"; text: string }[] = [];
    out.push({
      tone: insights.savedPct >= 5 ? "good" : "info",
      text: `Route engine re-sequenced ${insights.visits} visits across ${routes.length} team${routes.length === 1 ? "" : "s"}, cutting ${insights.saved.toFixed(0)} km (${insights.savedPct.toFixed(1)}%) versus the sheet order.`,
    });
    if (outlierCount > 0)
      out.push({
        tone: "warn",
        text: `${outlierCount} coordinate${outlierCount === 1 ? "" : "s"} sit beyond ${OUTLIER_KM} km of any cluster — excluded from the path and queued last. Validate GPS accuracy before dispatch.`,
      });
    if (insights.balance < 70)
      out.push({
        tone: "warn",
        text: `Workload is skewed: heaviest team carries ${insights.maxT} visits vs ${insights.minT} on the lightest (${insights.balance}% balance). Rebalancing would recover crew capacity.`,
      });
    else out.push({ tone: "good", text: `Crew load is balanced at ${insights.balance}% across teams — no reassignment needed.` });
    if (insights.topArea)
      out.push({
        tone: "info",
        text: `Highest density in ${insights.topArea[0]} with ${insights.topArea[1]} visits — ideal anchor cluster to start the day and reduce dead mileage.`,
      });
    out.push({
      tone: "info",
      text: `Projected field effort ${insights.hours.toFixed(1)} crew-hours and AED ${insights.fuelAed.toFixed(0)} fuel at 11 km/L · AED 3.49/L.`,
    });
    return out;
  }, [insights, routes.length, outlierCount]);

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plan");
    XLSX.writeFile(wb, "field-visit-plan-template.xlsx");
  }

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const parsed = parseWorkbook(await file.arrayBuffer());
      if (!parsed.length) { toast.error("No valid Latitude/Longitude rows found."); return; }
      setStops(parsed);
      setFileName(file.name);
      setDay(parsed[0].day);
      setTeam("all");
      toast.success(`${parsed.length.toLocaleString()} planned visits loaded`);
    } catch {
      toast.error("Could not read that file. Please upload an .xlsx or .csv file.");
    } finally {
      setLoading(false);
    }
  }

  function generatePlan() {
    if (!stops.length) { toast.error("Upload a plan file first."); return; }
    if (teamCount < 1 || targetPerDay < 1) { toast.error("Teams and target per day must be at least 1."); return; }
    if (!workdays.length) { toast.error("Select at least one working day."); return; }
    setLoading(true);
    try {
      const next = buildPlan(stops, {
        teams: teamCount,
        target: targetPerDay,
        start: startDate,
        workdays,
        holidays: parseHolidays(holidayText),
      });
      setStops(next);
      setPlanned(true);
      setTeam("all");
      setDay(next[0]?.day ?? "");
      const dayTotal = new Set(next.map((s) => s.day)).size;
      toast.success(`Plan built: ${next.length.toLocaleString()} visits · ${teamCount} teams · ${dayTotal} working days`);
    } catch {
      toast.error("Could not build the plan. Check the coordinates and try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleWorkday(d: number) {
    setWorkdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  function downloadPlan() {
    if (!stops.length) { toast.error("Nothing to download yet."); return; }
    const sorted = [...stops].sort(
      (a, b) => a.day.localeCompare(b.day) || teamKey(a.team) - teamKey(b.team) || a.order - b.order,
    );
    const rows = sorted.map((s) => [
      s.serial, s.serial, s.district, s.subdistrict, s.city, s.region, s.sector, s.plot,
      s.lat, s.lng, s.priority, s.status, s.day, s.team, s.order,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([[...TEMPLATE_HEADERS, "Visit Order"], ...rows]);
    ws["!cols"] = [...TEMPLATE_HEADERS, "Visit Order"].map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Optimised Plan");
    XLSX.writeFile(wb, `field-visit-plan-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Plan downloaded");
  }



  function gmapsLink(list: Stop[]) {
    const pts = list.slice(0, 10).map((s) => `${s.lat},${s.lng}`);
    const waypoints = pts.slice(1, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${pts[0]}&destination=${pts[pts.length - 1]}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 flex items-center justify-center">
        <section className="w-full max-w-sm" aria-labelledby="planner-sign-in-title">
          <img src={eandLogo} alt="e&" className="h-10 w-auto mb-8" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Field Visit Planning</p>
          <h1 id="planner-sign-in-title" className="mt-2 text-3xl font-semibold text-foreground">Planner sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Authorised field planning access only.</p>
          <form onSubmit={handlePlannerLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="planner-username" className="text-xs font-medium text-foreground">Username</label>
              <input
                id="planner-username"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="planner-password" className="text-xs font-medium text-foreground">Password</label>
              <input
                id="planner-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {loginError && <p role="alert" className="text-xs text-destructive">{loginError}</p>}
            <button type="submit" className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
              Open planner
            </button>
          </form>
        </section>
      </main>
    );
  }


  return (
    <AppShell session={session}>
      <div className="space-y-4">
        {/* ── AI command-centre hero ───────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-[#0b0b0f] text-white">
          <div className="absolute inset-0 opacity-[0.35]"
            style={{ backgroundImage: "radial-gradient(circle at 15% 20%, #dc2626 0, transparent 42%), radial-gradient(circle at 85% 10%, #7f1d1d 0, transparent 45%)" }} />
          <div className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
          <div className="relative p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-[#dc2626] animate-ping" />
                    <span className="relative h-2 w-2 rounded-full bg-[#dc2626]" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    Route Intelligence Engine · Live
                  </span>
                </div>
                <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
                  Field Visit Route Planner
                </h1>
                <p className="mt-1 text-xs text-white/55 max-w-xl">
                  Geospatial clustering · nearest-neighbour sequencing · 2-opt refinement · anomaly detection.
                  {" "}{stops.length.toLocaleString()} visits · {teams.length} teams · {days.length} planned days.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={downloadTemplate}
                  className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 text-xs font-medium text-white hover:bg-white/10 transition">
                  Template
                </button>
                <button onClick={downloadPlan} disabled={!stops.length}
                  className="h-9 px-3 rounded-lg border border-white/20 bg-white/5 text-xs font-medium text-white hover:bg-white/10 transition disabled:opacity-40">
                  Download plan
                </button>

                <button onClick={() => inputRef.current?.click()}
                  className="h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold hover:brightness-110 transition shadow-[0_6px_24px_-6px_rgba(220,38,38,.9)]">
                  Upload plan
                </button>
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </div>
            </div>

            {stops.length > 0 && (
              <div className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { k: "Visits today", v: insights.visits.toLocaleString(), s: `${routes.length} active teams` },
                  { k: "AI distance saved", v: `${insights.saved.toFixed(0)} km`, s: `${insights.savedPct.toFixed(1)}% shorter` },
                  { k: "Off-route flags", v: `${outlierCount}`, s: "check data accuracy" },
                ].map((c) => (
                  <div key={c.k} className="rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-2.5">
                    <p className="text-[9px] uppercase tracking-wider text-white/45">{c.k}</p>
                    <p className="text-lg font-semibold tabular-nums">{c.v}</p>
                    <p className="text-[10px] text-white/40 truncate">{c.s}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading && !stops.length ? (
          <div className="border border-border rounded-xl p-8 text-center bg-white text-sm text-muted-foreground">
            Initialising route intelligence…
          </div>
        ) : !stops.length ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center bg-white">
            <p className="text-sm font-medium text-[#111]">No plan loaded</p>
            <p className="text-xs text-muted-foreground mt-1">
              Columns: SERIALNUMBER, DISTRICT, SUBDISTRICT, CITYNAME, REGION, SECTOR, PLOT, Latitude, Longitude, Priority, Status, Planned - Date of Visit, Team No.
            </p>
          </div>
        ) : (
          <>
            {/* ── Auto-planner ─────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-white p-3 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#111]">Auto plan builder</p>
                  <p className="text-[11px] text-muted-foreground">
                    Clusters coordinates, splits them by daily target and spreads across teams on working days only.
                  </p>
                </div>
                {planned && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">
                    Plan generated
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">No of teams</span>
                  <input type="number" min={1} max={30} value={teamCount}
                    onChange={(e) => setTeamCount(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2 text-xs" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Target per team / day</span>
                  <input type="number" min={1} max={200} value={targetPerDay}
                    onChange={(e) => setTargetPerDay(Math.max(1, Number(e.target.value) || 1))}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2 text-xs" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Start date</span>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2 text-xs" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Exclude holidays (YYYY-MM-DD)</span>
                  <input value={holidayText} onChange={(e) => setHolidayText(e.target.value)}
                    placeholder="2026-12-02, 2026-12-03"
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-white px-2 text-xs" />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Working days</span>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <button key={d} onClick={() => toggleWorkday(i)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-medium border transition ${workdays.includes(i) ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                    {d}
                  </button>
                ))}
                <button onClick={generatePlan}
                  className="ml-auto h-9 px-4 rounded-lg bg-[#dc2626] text-white text-xs font-semibold hover:brightness-110 transition">
                  Build plan
                </button>
                <button onClick={downloadPlan}
                  className="h-9 px-3 rounded-lg border border-border text-xs font-semibold text-[#111] hover:bg-secondary transition">
                  Download plan
                </button>
              </div>
            </div>

            {/* ── Controls ─────────────────────────────────────── */}

            <div className="rounded-xl border border-border bg-white p-3 space-y-2.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14">Day</span>
                <select value={day} onChange={(e) => setDay(e.target.value)}
                  className="h-9 px-2 text-xs border border-input rounded-lg bg-white max-w-[240px]">
                  {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
                </select>
                <button onClick={() => setOptimize((v) => !v)}
                  className={`h-9 px-3 rounded-lg text-xs font-semibold border transition ${optimize ? "bg-[#dc2626] text-white border-[#dc2626]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                  {optimize ? "AI sequencing: ON" : "AI sequencing: OFF"}
                </button>
                <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-[220px]">{fileName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14">Team</span>
                <button onClick={() => setTeam("all")}
                  className={`px-3 h-8 rounded-lg text-xs font-medium border transition ${team === "all" ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                  All
                </button>
                {teams.map((t) => (
                  <button key={t} onClick={() => setTeam(t)}
                    className={`px-3 h-8 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${team === t ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: teamColor(t) }} />
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* ── Map ─────────────────────────────────────── */}
              <div className="lg:col-span-2 rounded-xl border border-border overflow-hidden bg-white shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <p className="text-[11px] font-semibold text-[#111] uppercase tracking-wider">
                    Optimised field graph · {dayLabel(day)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {dayStops.length} nodes · {routeKm.toFixed(0)} km
                    {outlierCount > 0 && <span className="text-[#b45309]"> · {outlierCount} flagged</span>}
                  </p>
                </div>
                <MapContainer center={[24.4, 55.13]} zoom={9} scrollWheelZoom style={{ height: 500, width: "100%", background: "#ffffff" }}>
                  <TileLayer attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds points={points} />
                  {routes.map((r) => {
                    const linePts = r.stops.filter((s) => !r.outliers.includes(s)).map((s) => [s.lat, s.lng] as [number, number]);
                    return (
                      <Fragment key={r.team}>
                        <Polyline positions={linePts} pathOptions={{ color: r.color, weight: 10, opacity: 0.18 }} />
                        <Polyline positions={linePts} pathOptions={{ color: r.color, weight: 2.5, opacity: 0.95 }} />
                        {r.stops.map((s, i) => {
                          const flagged = r.outliers.includes(s);
                          return (
                            <Marker key={`${s.team}-${s.serial}-${i}`} position={[s.lat, s.lng]}
                              icon={numberedIcon(i + 1, flagged ? "#f59e0b" : r.color)}>
                              <Popup>
                                <div className="text-xs leading-5">
                                  <div className="font-semibold">{s.serial}</div>
                                  <div>{s.district}{s.subdistrict ? ` / ${s.subdistrict}` : ""}</div>
                                  <div>{s.city} · {s.region} · Plot {s.plot || "-"}</div>
                                  <div>{r.team} · Stop {i + 1} · {dayLabel(s.day)}</div>
                                  <div>{s.priority} · {s.status}</div>
                                  {flagged && (
                                    <div className="mt-1 font-semibold text-[#b45309]">
                                      Excluded from route path - check data for accuracy (coordinates far from cluster). Visit last if valid.
                                    </div>
                                  )}
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </MapContainer>
              </div>

              {/* ── AI insight panel ────────────────────────── */}
              <div className="rounded-xl border border-border bg-white shadow-sm flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-[#0b0b0f] text-white">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Route AI · Analyst brief</p>
                  <p className="text-sm font-semibold mt-0.5">Recommendations for {dayLabel(day)}</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2 border-b border-border">
                  {[
                    { k: "Efficiency index", v: `${Math.min(100, Math.round(insights.savedPct * 4 + 55))}` },
                    { k: "Crew balance", v: `${insights.balance}%` },
                    { k: "Stops per km", v: insights.density.toFixed(2) },
                    { k: "Anomalies", v: String(outlierCount) },
                  ].map((m) => (
                    <div key={m.k} className="rounded-lg border border-border bg-secondary/40 px-2.5 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.k}</p>
                      <p className="text-base font-semibold text-[#111] tabular-nums">{m.v}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 space-y-2 overflow-y-auto max-h-[300px]">
                  {narrative.map((n, i) => (
                    <div key={i}
                      className={`rounded-lg border p-2.5 text-[11px] leading-5 ${
                        n.tone === "warn"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : n.tone === "good"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                            : "border-border bg-white text-[#111]"
                      }`}>
                      <span className="font-semibold mr-1">
                        {n.tone === "warn" ? "Risk" : n.tone === "good" ? "Gain" : "Signal"}
                      </span>
                      {n.text}
                    </div>
                  ))}
                </div>
                <div className="mt-auto px-3 py-2.5 border-t border-border">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Priority mix</p>
                  <div className="space-y-1.5">
                    {insights.priorityMix.map(([p, n]) => (
                      <div key={p} className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-muted-foreground truncate">{p}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full bg-[#dc2626]"
                            style={{ width: `${Math.round((n / Math.max(1, insights.visits)) * 100)}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-[#111] w-8 text-right">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Team route cards ────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {routes.map((r) => {
                const km = pathLength(r.stops.filter((s) => !r.outliers.includes(s)));
                return (
                  <div key={r.team} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                    <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#111]">
                        <span className="h-6 w-6 rounded-lg flex items-center justify-center text-[10px] text-white"
                          style={{ background: r.color }}>
                          {r.team.replace(/[^0-9]/g, "") || "T"}
                        </span>
                        <span>{r.team}</span>
                        <span className="text-muted-foreground font-normal">
                          {r.stops.length} visits · {km.toFixed(0)} km
                          {r.outliers.length > 0 && <span className="text-[#b45309]"> · {r.outliers.length} flagged</span>}
                        </span>
                      </div>
                      <a href={gmapsLink(r.stops)} target="_blank" rel="noreferrer"
                        className="text-[11px] font-semibold text-[#dc2626] hover:underline whitespace-nowrap">
                        Navigate →
                      </a>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <tbody>
                          {r.stops.map((s, i) => (
                            <tr key={`${s.serial}-${i}`}
                              className={`border-t border-border ${r.outliers.includes(s) ? "bg-amber-50" : "hover:bg-secondary/50"}`}
                              title={r.outliers.includes(s) ? "Check data for accuracy - excluded from optimised path, visit last" : undefined}>
                              <td className="px-3 py-1.5 w-8 text-muted-foreground tabular-nums">{i + 1}</td>
                              <td className="px-3 py-1.5 font-medium text-[#111] whitespace-nowrap">
                                {s.serial}
                                {r.outliers.includes(s) && (
                                  <span className="ml-2 text-[10px] font-semibold text-[#b45309]">check data</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground">{s.subdistrict || s.district}</td>
                              <td className="px-3 py-1.5 text-right text-muted-foreground whitespace-nowrap tabular-nums">
                                {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
