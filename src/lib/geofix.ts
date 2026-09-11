import { supabase } from "@/integrations/supabase/client";

export type GeoRole = "manager" | "field";
export interface GeoSession { role: GeoRole; username: string; name: string }

const SKEY = "geofix_session";
const MANAGER = { username: "manager", password: "53786", name: "Manager" };

export function getGeoSession(): GeoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SKEY);
    return raw ? (JSON.parse(raw) as GeoSession) : null;
  } catch { return null; }
}

export function geoLogout() {
  if (typeof window !== "undefined") localStorage.removeItem(SKEY);
}

export async function geoLogin(username: string, password: string): Promise<GeoSession | null> {
  const u = username.trim().toLowerCase();
  let session: GeoSession | null = null;
  if (u === MANAGER.username && password === MANAGER.password) {
    session = { role: "manager", username: u, name: MANAGER.name };
  } else {
    const { data } = await supabase
      .from("geofix_field_users")
      .select("username, display_name, password, active")
      .eq("username", u)
      .maybeSingle();
    if (data && data.active && data.password === password) {
      session = { role: "field", username: u, name: data.display_name || u };
    }
  }
  if (session) localStorage.setItem(SKEY, JSON.stringify(session));
  return session;
}

export interface Meter {
  id: string; utility: string; serial: string; msn: string | null; acc_no: string | null;
  premise: string | null; area: string | null; mru: string | null; meter_type: string | null;
  premise_desc: string | null; manufacturer: string | null;
  latitude: number | null; longitude: number | null; raw_location: string | null;
  building_name: string | null; building_id: string | null;
  install_status: string | null; action_required: string | null;
}

const METER_COLS =
  "id, utility, serial, msn, acc_no, premise, area, mru, meter_type, premise_desc, manufacturer, latitude, longitude, raw_location, building_name, building_id, install_status, action_required";

export async function searchMeters(term: string): Promise<Meter[]> {
  const t = term.trim();
  if (t.length < 3) return [];
  const like = `%${t}%`;
  const { data, error } = await supabase
    .from("geofix_meters")
    .select(METER_COLS)
    .or(`serial.ilike.${like},msn.ilike.${like},acc_no.ilike.${like},premise.ilike.${like}`)
    .limit(25);
  if (error) throw error;
  return (data ?? []) as Meter[];
}

export const SCENARIOS = [
  {
    key: "wrong_meter",
    title: "Wrong meter at this location",
    hint: "A different meter is installed at these coordinates.",
  },
  {
    key: "coords_wrong",
    title: "Meter found nearby, coordinates wrong",
    hint: "Correct meter, but standing away from the recorded point.",
  },
  {
    key: "no_meter",
    title: "No meter / no workman data",
    hint: "Nothing installed at the site, needs re-survey.",
  },
] as const;

export type ScenarioKey = (typeof SCENARIOS)[number]["key"];

export function scenarioTitle(key: string) {
  return SCENARIOS.find((s) => s.key === key)?.title ?? key;
}

export function weekLabel(d: Date = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export interface GeoRequest {
  id: string; utility: string | null; serial: string; scenario: string;
  old_latitude: number | null; old_longitude: number | null;
  new_latitude: number | null; new_longitude: number | null;
  found_serial: string | null; found_placement: string | null;
  found_meter_new_latitude: number | null; found_meter_new_longitude: number | null;
  building_name: string | null; area: string | null; remarks: string | null;
  submitted_by: string; submitted_by_name: string | null; week_label: string | null;
  status: string; reviewed_by: string | null; reviewed_at: string | null;
  created_at: string; meter_id: string | null;
}

export async function listRequests(): Promise<GeoRequest[]> {
  const { data, error } = await supabase
    .from("geofix_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as GeoRequest[];
}

export async function myRequests(username: string): Promise<GeoRequest[]> {
  const { data, error } = await supabase
    .from("geofix_requests")
    .select("*")
    .eq("submitted_by", username)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as GeoRequest[];
}

export async function reviewRequest(r: GeoRequest, status: "approved" | "rejected", reviewer: string) {
  const { error } = await supabase
    .from("geofix_requests")
    .update({ status, reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
    .eq("id", r.id);
  if (error) throw error;

  if (status !== "approved") return;
  if (r.meter_id && r.new_latitude != null && r.new_longitude != null) {
    await supabase
      .from("geofix_meters")
      .update({
        latitude: r.new_latitude,
        longitude: r.new_longitude,
        raw_location: `${r.new_latitude}, ${r.new_longitude}`,
      })
      .eq("id", r.meter_id);
  }
  if (r.found_serial && r.found_meter_new_latitude != null && r.found_meter_new_longitude != null) {
    await supabase
      .from("geofix_meters")
      .update({
        latitude: r.found_meter_new_latitude,
        longitude: r.found_meter_new_longitude,
        raw_location: `${r.found_meter_new_latitude}, ${r.found_meter_new_longitude}`,
      })
      .eq("serial", r.found_serial);
  }
}

export interface FieldUser { id: string; username: string; display_name: string | null; password: string; active: boolean }

export async function listFieldUsers(): Promise<FieldUser[]> {
  const { data, error } = await supabase
    .from("geofix_field_users")
    .select("id, username, display_name, password, active")
    .order("username");
  if (error) throw error;
  return (data ?? []) as FieldUser[];
}

export async function addFieldUser(username: string, displayName: string, password: string, by: string) {
  const { error } = await supabase.from("geofix_field_users").insert({
    username: username.trim().toLowerCase(),
    display_name: displayName.trim() || username.trim(),
    password,
    created_by: by,
  });
  if (error) throw error;
}

export async function removeFieldUser(id: string) {
  const { error } = await supabase.from("geofix_field_users").delete().eq("id", id);
  if (error) throw error;
}
