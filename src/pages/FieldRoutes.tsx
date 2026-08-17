import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";

const TEMPLATE_HEADERS = ["Day", "Team", "Stop No", "Site Name", "USN", "Latitude", "Longitude", "Region", "Remarks"];
const TEMPLATE_ROWS = [
  ["Monday", "Team A", 1, "Al Barsha Tower", "USN-10021", 25.1101, 55.1968, "Dubai", "Start of day"],
  ["Monday", "Team A", 2, "Business Bay Node", "USN-10022", 25.1857, 55.2645, "Dubai", ""],
  ["Monday", "Team B", 1, "Sharjah Industrial 5", "USN-20014", 25.3182, 55.3919, "Sharjah", ""],
  ["Tuesday", "Team A", 1, "Abu Dhabi Corniche", "USN-30045", 24.4672, 54.3339, "Abu Dhabi", ""],
];

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const TEAM_COLORS = ["#dc2626", "#7f1d1d", "#b91c1c", "#ef4444", "#991b1b", "#f87171", "#450a0a", "#e11d48"];

interface Stop {
  day: string; team: string; order: number; site: string; usn: string;
  lat: number; lng: number; region: string; remarks: string;
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (keys.includes(norm)) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

function numberedIcon(n: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:600 11px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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

export default function FieldRoutes() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [fileName, setFileName] = useState("");
  const [day, setDay] = useState<string>("");
  const [team, setTeam] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { navigate("/"); return; }
    setSession(s);
  }, [navigate]);

  const days = useMemo(() => {
    const set = Array.from(new Set(stops.map((s) => s.day)));
    return set.sort((a, b) => {
      const ia = DAY_ORDER.indexOf(a.toLowerCase()), ib = DAY_ORDER.indexOf(b.toLowerCase());
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.localeCompare(b);
    });
  }, [stops]);

  const teams = useMemo(() => Array.from(new Set(stops.map((s) => s.team))).sort(), [stops]);
  const teamColor = (t: string) => TEAM_COLORS[Math.max(0, teams.indexOf(t)) % TEAM_COLORS.length];

  const dayStops = useMemo(
    () => stops.filter((s) => s.day === day && (team === "all" || s.team === team)),
    [stops, day, team],
  );

  const routes = useMemo(() => {
    const byTeam = new Map<string, Stop[]>();
    dayStops.forEach((s) => byTeam.set(s.team, [...(byTeam.get(s.team) ?? []), s]));
    return Array.from(byTeam.entries()).map(([t, list]) => ({
      team: t,
      color: teamColor(t),
      stops: [...list].sort((a, b) => a.order - b.order),
    }));
  }, [dayStops, teams]);

  const points = useMemo(() => routes.flatMap((r) => r.stops.map((s) => [s.lat, s.lng] as [number, number])), [routes]);

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_ROWS]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Route Plan");
    XLSX.writeFile(wb, "field-route-plan-template.xlsx");
  }

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const parsed: Stop[] = [];
      rows.forEach((row, i) => {
        const lat = parseFloat(pick(row, ["latitude", "lat", "ycoordinate", "y"]));
        const lng = parseFloat(pick(row, ["longitude", "long", "lng", "lon", "xcoordinate", "x"]));
        if (!isFinite(lat) || !isFinite(lng)) return;
        parsed.push({
          day: pick(row, ["day", "dayofweek", "visitday", "date"]) || "Unassigned",
          team: pick(row, ["team", "crew", "teamname", "squad"]) || "Team 1",
          order: parseFloat(pick(row, ["stopno", "stop", "order", "sequence", "seq", "sno"])) || i + 1,
          site: pick(row, ["sitename", "site", "location", "name"]) || `Site ${i + 1}`,
          usn: pick(row, ["usn", "siteid", "id"]),
          lat, lng,
          region: pick(row, ["region", "emirate", "area", "zone"]),
          remarks: pick(row, ["remarks", "remark", "notes", "comment"]),
        });
      });
      if (!parsed.length) { toast.error("No valid coordinates found. Use the template columns."); return; }
      setStops(parsed);
      setFileName(file.name);
      const firstDay = parsed.map((p) => p.day)[0];
      setDay(firstDay);
      setTeam("all");
      toast.success(`${parsed.length} stops loaded from ${file.name}`);
    } catch {
      toast.error("Could not read that file. Please upload an .xlsx or .csv file.");
    }
  }

  function gmapsLink(list: Stop[]) {
    const pts = list.map((s) => `${s.lat},${s.lng}`);
    const origin = pts[0];
    const destination = pts[pts.length - 1];
    const waypoints = pts.slice(1, -1).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=driving`;
  }

  if (!session) return null;

  return (
    <AppShell session={session}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[#111]">Field Route Planner</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Upload the route plan sheet to map each team&apos;s daily travel path.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate}
              className="h-9 px-3 rounded-md border border-border bg-white text-xs font-medium text-[#111] hover:bg-secondary">
              Download template
            </button>
            <button onClick={() => inputRef.current?.click()}
              className="h-9 px-4 rounded-md bg-[#dc2626] text-white text-xs font-semibold hover:opacity-90">
              Upload Excel
            </button>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
          </div>
        </div>

        {!stops.length ? (
          <div className="border border-dashed border-border rounded-lg p-8 text-center bg-white">
            <p className="text-sm font-medium text-[#111]">No route plan loaded</p>
            <p className="text-xs text-muted-foreground mt-1">
              Required columns: Day, Team, Stop No, Site Name, USN, Latitude, Longitude. Region and Remarks are optional.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border border-border rounded-lg bg-white p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Day</span>
              {days.map((d) => (
                <button key={d} onClick={() => setDay(d)}
                  className={`px-3 h-8 rounded-md text-xs font-medium border transition ${d === day ? "bg-[#dc2626] text-white border-[#dc2626]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                  {d}
                </button>
              ))}
              <span className="mx-1 h-6 w-px bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Team</span>
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
              <span className="ml-auto text-[11px] text-muted-foreground">{fileName} · {dayStops.length} stops</span>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-white">
              <MapContainer center={[25.2, 55.27]} zoom={9} scrollWheelZoom style={{ height: 420, width: "100%" }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitBounds points={points} />
                {routes.map((r) => (
                  <Fragment key={r.team}>
                    <Polyline positions={r.stops.map((s) => [s.lat, s.lng] as [number, number])}
                      pathOptions={{ color: r.color, weight: 3, opacity: 0.85 }} />
                    {r.stops.map((s, i) => (
                      <Marker key={`${s.team}-${s.usn}-${i}`} position={[s.lat, s.lng]} icon={numberedIcon(i + 1, r.color)}>
                        <Popup>
                          <div className="text-xs">
                            <div className="font-semibold">{s.site}</div>
                            <div>{s.usn}</div>
                            <div>{r.team} · Stop {i + 1} · {s.day}</div>
                            {s.region && <div>{s.region}</div>}
                            {s.remarks && <div className="text-muted-foreground">{s.remarks}</div>}
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
                  <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#111]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                      {r.team} · {day} · {r.stops.length} stops
                    </div>
                    <a href={gmapsLink(r.stops)} target="_blank" rel="noreferrer"
                      className="text-[11px] font-medium text-[#dc2626] hover:underline">
                      Open route in Google Maps
                    </a>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {r.stops.map((s, i) => (
                        <tr key={`${s.usn}-${i}`} className="border-t border-border">
                          <td className="px-3 py-2 w-8 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-[#111]">{s.site}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.usn}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                            {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
