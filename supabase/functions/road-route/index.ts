import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GW = "https://connector-gateway.lovable.dev/google_maps";

// Cost guardrails: hard caps on fan-out.
const MAX_LEGS = 14;          // teams per request
const MAX_STOPS_PER_LEG = 60; // stops per team
const CHUNK = 25;             // Routes API waypoints per call (origin + 23 intermediates + dest)

type LatLng = [number, number];
type Leg = { key: string; coords: LatLng[] };
type SegmentResult = { polyline: string; distanceMeters: number; seconds: number };
type SegmentRoute = { results: SegmentResult[]; failedSegments: number };

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

function haversineMeters(a: LatLng, b: LatLng) {
  const earthMeters = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function computeSegment(coords: LatLng[]): Promise<SegmentResult | null> {
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
  if (!route?.polyline?.encodedPolyline) return null;
  return {
    polyline: route.polyline.encodedPolyline as string,
    distanceMeters: (route.distanceMeters as number) ?? 0,
    seconds: Number(String(route.duration ?? "0s").replace("s", "")) || 0,
  };
}

async function computeResilientRoute(coords: LatLng[]): Promise<SegmentRoute> {
  if (coords.length < 2) return { results: [], failedSegments: 0 };

  const direct = await computeSegment(coords);
  if (direct) return { results: [direct], failedSegments: 0 };

  // If a chunk contains one unroutable waypoint, Google returns no route for the whole chunk.
  // Split the chunk to preserve every routable road segment instead of failing the full request.
  if (coords.length > 2) {
    const mid = Math.floor(coords.length / 2);
    const left = await computeResilientRoute(coords.slice(0, mid + 1));
    const right = await computeResilientRoute(coords.slice(mid));
    return {
      results: [...left.results, ...right.results],
      failedSegments: left.failedSegments + right.failedSegments,
    };
  }

  // Final fallback: keep the planner alive and use straight-line distance/time for this one bad pair.
  const fallbackMeters = haversineMeters(coords[0], coords[1]);
  return {
    results: [{ polyline: "", distanceMeters: fallbackMeters, seconds: Math.round((fallbackMeters / 1000 / 35) * 3600) }],
    failedSegments: 1,
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

    const out: Record<string, { polylines: string[]; km: number; minutes: number; partial?: boolean; failedSegments?: number }> = {};

    for (const leg of legs) {
      const coords = (leg.coords ?? [])
        .filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
        .slice(0, MAX_STOPS_PER_LEG);
      if (coords.length < 2) continue;

      const polylines: string[] = [];
      let meters = 0, seconds = 0, failedSegments = 0;
      // sequential (not parallel) to keep provider usage bounded
      for (let i = 0; i < coords.length - 1; i += CHUNK - 1) {
        const seg = coords.slice(i, i + CHUNK);
        if (seg.length < 2) break;
        const routed = await computeResilientRoute(seg);
        for (const r of routed.results) {
          if (r.polyline) polylines.push(r.polyline);
          meters += r.distanceMeters;
          seconds += r.seconds;
        }
        failedSegments += routed.failedSegments;
      }
      out[leg.key] = {
        polylines,
        km: meters / 1000,
        minutes: Math.round(seconds / 60),
        partial: failedSegments > 0,
        failedSegments: failedSegments || undefined,
      };
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
