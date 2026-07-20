import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SHEET_ID = "1WZ7tjPaDzdz34PZC7KAA2e-cI4kYpR5GziuhhWj3Z7M";
const GW = "https://connector-gateway.lovable.dev/google_sheets/v4";

function headers() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const conn = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!key || !conn) throw new Error("Missing gateway secrets");
  return { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": conn };
}

function toObjects(values: string[][]): Record<string, string>[] {
  if (!values || values.length < 2) return [];
  const [head, ...rows] = values;
  return rows
    .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      head.forEach((h, i) => { o[h?.trim() || `col_${i}`] = (r[i] ?? "").toString().trim(); });
      return o;
    });
}

type CachePayload = {
  poPr: unknown; paymentRelease: unknown; vendors: unknown; urgent: unknown;
  mspVendors: unknown; mspPractises: unknown; nocChallenges: unknown; cs: unknown;
  fetchedAt: string;
};
let cache: { at: number; payload: CachePayload } | null = null;
const CACHE_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    if (!force && cache && Date.now() - cache.at < CACHE_MS) {
      return new Response(JSON.stringify({ ...cache.payload, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ranges = [
      "'Field - PO & PR'!A1:Z1000",
      "'Field - Payment Release'!A1:Z1000",
      "'Field - Vendors'!A1:Z1000",
      "'Field - Urgent PO/PR'!A1:Z1000",
      "'MSP - Vendors'!A1:Z1000",
      "'MSP - Practises'!A1:AA1000",
      "'NOC - Vendor Challenges'!A1:Z1000",
      "'CS'!A1:Z1000",
    ];
    const qs = new URLSearchParams();
    ranges.forEach((r) => qs.append("ranges", r));

    let r: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(`${GW}/spreadsheets/${SHEET_ID}/values:batchGet?${qs}`, { headers: headers() });
      if (r.status !== 429) break;
      await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
    }
    if (!r || !r.ok) {
      if (cache) {
        return new Response(JSON.stringify({ ...cache.payload, cached: true, stale: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = r ? await r.text() : "no response";
      return new Response(JSON.stringify({ error: "sheet_fetch_failed", status: r?.status ?? 500, details: body }), {
        status: r?.status ?? 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const [po, pay, ven, urg, mspV, mspP, nocC, cs] = data.valueRanges ?? [];
    const payload: CachePayload = {
      poPr: toObjects(po?.values ?? []),
      paymentRelease: toObjects(pay?.values ?? []),
      vendors: toObjects(ven?.values ?? []),
      urgent: toObjects(urg?.values ?? []),
      mspVendors: toObjects(mspV?.values ?? []),
      mspPractises: toObjects(mspP?.values ?? []),
      nocChallenges: toObjects(nocC?.values ?? []),
      cs: toObjects(cs?.values ?? []),
      fetchedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), payload };
    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

