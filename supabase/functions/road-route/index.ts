import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GW = "https://connector-gateway.lovable.dev/google_maps";

// Cost guardrails: hard caps on fan-out.
const MAX_LEGS = 14;          // teams per request
const MAX_STOPS_PER_LEG = 60; // stops per team
const CHUNK = 25;             // Routes API waypoints per call (origin + 23 intermediates + dest)

type LatLng = [number, number];
type Leg = { key: string; coords: LatLng[] };

function gwHeaders() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const conn = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key || !conn) throw new Error("Missing Google Maps connector credentials");
  return {
    Authorization: `Bearer ${key}`,
    "X-Connection-Api-Key": conn,
    "Content-Type": "application/json",
    "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration",
  };
}

const pt = ([lat, lng]: LatLng) => ({ location: { latLng: { latitude: lat, longitude: lng } } });

async function computeSegment(coords: LatLng[]) {
  const body = {
    origin: pt(coords[0]),
    destination: pt(coords[coords.length - 1]),
    intermediates: coords.slice(1, -1).map(pt),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    polylineQuality: "OVERVIEW",
  };
  const res = await fetch(`${GW}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: gwHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 403) {
      const reason = (() => {
        try { return (JSON.parse(text)?.error?.details ?? []).find((d: { reason?: string }) => d.reason)?.reason; }
        catch { return undefined; }
      })();
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED")
        throw new Error("Google Maps server key is referrer-restricted. Set the server key's application restrictions to \"None\" or \"IP addresses\".");
      if (reason === "API_KEY_SERVICE_BLOCKED")
        throw new Error("Google Maps server key does not allow the Routes API. Add Routes API to the key's allowed-APIs list.");
    }
    throw new Error(`[${res.status}]: ${text}`);
  }
  const json = await res.json();
  const route = json?.routes?.[0];
  if (!route) throw new Error("No road route returned for this segment");
  return {
    polyline: route.polyline?.encodedPolyline as string,
    distanceMeters: (route.distanceMeters as number) ?? 0,
    seconds: Number(String(route.duration ?? "0s").replace("s", "")) || 0,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { legs } = (await req.json()) as { legs?: Leg[] };
    if (!Array.isArray(legs) || legs.length === 0)
      return new Response(JSON.stringify({ error: "legs required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    if (legs.length > MAX_LEGS)
      return new Response(JSON.stringify({ error: `Too many teams in one request (max ${MAX_LEGS})` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const out: Record<string, { polylines: string[]; km: number; minutes: number }> = {};

    for (const leg of legs) {
      const coords = (leg.coords ?? [])
        .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
        .slice(0, MAX_STOPS_PER_LEG);
      if (coords.length < 2) continue;

      const polylines: string[] = [];
      let meters = 0, seconds = 0;
      // sequential (not parallel) to keep provider usage bounded
      for (let i = 0; i < coords.length - 1; i += CHUNK - 1) {
        const seg = coords.slice(i, i + CHUNK);
        if (seg.length < 2) break;
        const r = await computeSegment(seg);
        polylines.push(r.polyline);
        meters += r.distanceMeters;
        seconds += r.seconds;
      }
      out[leg.key] = { polylines, km: meters / 1000, minutes: Math.round(seconds / 60) };
    }

    return new Response(JSON.stringify({ legs: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("road-route failed:", msg);
    return new Response(JSON.stringify({ error: "Road routing failed", details: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
