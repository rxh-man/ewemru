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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ranges = ["PO & PR!A1:Z1000", "Payment Release!A1:Z1000", "Vendors!A1:Z1000"];
    const qs = new URLSearchParams();
    ranges.forEach((r) => qs.append("ranges", r));
    const r = await fetch(`${GW}/spreadsheets/${SHEET_ID}/values:batchGet?${qs}`, { headers: headers() });
    if (!r.ok) {
      const body = await r.text();
      return new Response(JSON.stringify({ error: "sheet_fetch_failed", status: r.status, details: body }), {
        status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const [po, pay, ven] = data.valueRanges ?? [];
    return new Response(JSON.stringify({
      poPr: toObjects(po?.values ?? []),
      paymentRelease: toObjects(pay?.values ?? []),
      vendors: toObjects(ven?.values ?? []),
      fetchedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
