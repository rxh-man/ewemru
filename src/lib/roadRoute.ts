import { supabase } from "@/integrations/supabase/client";

export type LatLng = [number, number];
export interface RoadLeg { polylines: string[]; km: number; minutes: number }

/** Google encoded-polyline decoder. */
export function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let shift = 0, result = 0, b: number;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

const cache = new Map<string, Record<string, RoadLeg>>();

/** Fetch road-snapped paths for each team leg. Cached per identical request to avoid re-billing. */
export async function fetchRoadRoutes(
  legs: { key: string; coords: LatLng[] }[],
): Promise<Record<string, RoadLeg>> {
  const payload = legs.filter((l) => l.coords.length >= 2);
  if (!payload.length) return {};
  const cacheKey = JSON.stringify(
    payload.map((l) => [l.key, l.coords.map((c) => [c[0].toFixed(5), c[1].toFixed(5)])]),
  );
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const { data, error } = await supabase.functions.invoke("road-route", { body: { legs: payload } });
  if (error) {
    let details = error.message;
    const ctx = (error as { context?: { text?: () => Promise<string> } }).context;
    if (ctx?.text) { try { details = await ctx.text(); } catch { /* keep message */ } }
    throw new Error(details);
  }
  const result = (data?.legs ?? {}) as Record<string, RoadLeg>;
  cache.set(cacheKey, result);
  return result;
}
