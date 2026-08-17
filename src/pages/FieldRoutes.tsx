import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";

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

export default function FieldRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("");
  const [team, setTeam] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { navigate("/"); return; }
    setSession(s);
  }, [navigate]);

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
        return { team: t, color: teamColor(t), stops: optimize ? optimizeRoute(seq) : seq };
      });
  }, [dayStops, teams, optimize]);

  const routeKm = useMemo(() => routes.reduce((sum, r) => sum + pathLength(r.stops), 0), [routes]);

  const points = useMemo(
    () => routes.flatMap((r) => r.stops.map((s) => [s.lat, s.lng] as [number, number])),
    [routes],
  );

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

  function gmapsLink(list: Stop[]) {
    const pts = list.slice(0, 10).map((s) => `${s.lat},${s.lng}`);
    const waypoints = pts.slice(1, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${pts[0]}&destination=${pts[pts.length - 1]}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
  }

  if (!session) return null;

  return (
    <AppShell session={session}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#111]">Field Visit Route Planner</h1>
            <p className="text-xs text-muted-foreground mt-1">
              AADC baseline plan preloaded · {stops.length.toLocaleString()} visits · {teams.length} teams · {days.length} planned days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate}
              className="h-9 px-3 rounded-md border border-border bg-white text-xs font-medium text-[#111] hover:bg-secondary">
              Download template
            </button>
            <button onClick={() => inputRef.current?.click()}
              className="h-9 px-4 rounded-md bg-[#dc2626] text-white text-xs font-semibold hover:opacity-90">
              Upload plan
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>
        </div>

        {loading && !stops.length ? (
          <div className="border border-border rounded-lg p-8 text-center bg-white text-sm text-muted-foreground">
            Loading plan...
          </div>
        ) : !stops.length ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center bg-white">
            <p className="text-sm font-medium text-[#111]">No plan loaded</p>
            <p className="text-xs text-muted-foreground mt-1">
              Columns: SERIALNUMBER, DISTRICT, SUBDISTRICT, CITYNAME, REGION, SECTOR, PLOT, Latitude, Longitude, Priority, Status, Planned - Date of Visit, Team No.
            </p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-lg bg-white p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14">Day</span>
                <select value={day} onChange={(e) => setDay(e.target.value)}
                  className="h-9 px-2 text-xs border border-input rounded-md bg-white max-w-[240px]">
                  {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
                </select>
                <span className="ml-auto text-[11px] text-muted-foreground truncate">{fileName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-14">Team</span>
                <button onClick={() => setTeam("all")}
                  className={`px-3 h-8 rounded-md text-xs font-medium border transition ${team === "all" ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                  All
                </button>
                {teams.map((t) => (
                  <button key={t} onClick={() => setTeam(t)}
                    className={`px-3 h-8 rounded-md text-xs font-medium border transition flex items-center gap-1.5 ${team === t ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                    <span className="h-2 w-2 rounded-full" style={{ background: teamColor(t) }} />
                    {t}
                  </button>
                ))}
                <span className="ml-auto text-[11px] font-medium text-[#111]">{dayStops.length} visits this day</span>
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-white">
              <MapContainer center={[24.4, 55.13]} zoom={9} scrollWheelZoom style={{ height: 460, width: "100%" }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitBounds points={points} />
                {routes.map((r) => (
                  <Fragment key={r.team}>
                    <Polyline positions={r.stops.map((s) => [s.lat, s.lng] as [number, number])}
                      pathOptions={{ color: r.color, weight: 3, opacity: 0.85 }} />
                    {r.stops.map((s, i) => (
                      <Marker key={`${s.team}-${s.serial}-${i}`} position={[s.lat, s.lng]} icon={numberedIcon(i + 1, r.color)}>
                        <Popup>
                          <div className="text-xs leading-5">
                            <div className="font-semibold">{s.serial}</div>
                            <div>{s.district}{s.subdistrict ? ` / ${s.subdistrict}` : ""}</div>
                            <div>{s.city} · {s.region} · Plot {s.plot || "-"}</div>
                            <div>{r.team} · Stop {i + 1} · {dayLabel(s.day)}</div>
                            <div>{s.priority} · {s.status}</div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </Fragment>
                ))}
              </MapContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {routes.map((r) => (
                <div key={r.team} className="border border-border rounded-lg bg-white overflow-hidden">
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#111]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                      {r.team} · {dayLabel(day)} · {r.stops.length} visits
                    </div>
                    <a href={gmapsLink(r.stops)} target="_blank" rel="noreferrer"
                      className="text-[11px] font-medium text-[#dc2626] hover:underline whitespace-nowrap">
                      Open in Google Maps
                    </a>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {r.stops.map((s, i) => (
                          <tr key={`${s.serial}-${i}`} className="border-t border-border">
                            <td className="px-3 py-1.5 w-8 text-muted-foreground">{i + 1}</td>
                            <td className="px-3 py-1.5 font-medium text-[#111] whitespace-nowrap">{s.serial}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{s.subdistrict || s.district}</td>
                            <td className="px-3 py-1.5 text-right text-muted-foreground whitespace-nowrap">
                              {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
