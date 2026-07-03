import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FOLDER_ID = "1KOFf6sYXmrE4OLWFEJJSLx5tNco2qJZJ";
const GW = "https://connector-gateway.lovable.dev/google_drive/drive/v3";

function gwHeaders() {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const conn = Deno.env.get("GOOGLE_DRIVE_API_KEY");
  if (!key || !conn) throw new Error("Missing gateway secrets");
  return { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": conn };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "list";

    if (action === "list") {
      const search = (url.searchParams.get("q") ?? "").trim().replace(/'/g, "\\'");
      const qParts = [`'${FOLDER_ID}' in parents`, "trashed=false"];
      if (search) qParts.push(`name contains '${search}'`);
      const qs = new URLSearchParams({
        q: qParts.join(" and "),
        fields: "files(id,name,mimeType,size,modifiedTime,iconLink,webViewLink)",
        orderBy: "name",
        pageSize: "200",
      });
      const r = await fetch(`${GW}/files?${qs}`, { headers: gwHeaders() });
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download") {
      const id = url.searchParams.get("id");
      if (!id) return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
      const meta = await fetch(`${GW}/files/${id}?fields=name,mimeType`, { headers: gwHeaders() });
      if (!meta.ok) return new Response(await meta.text(), { status: meta.status, headers: corsHeaders });
      const info = await meta.json();
      let dl: Response;
      let filename = info.name as string;
      if (typeof info.mimeType === "string" && info.mimeType.startsWith("application/vnd.google-apps.")) {
        // Google-native docs need export
        const exportMime = info.mimeType === "application/vnd.google-apps.spreadsheet"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : info.mimeType === "application/vnd.google-apps.presentation"
          ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          : "application/pdf";
        dl = await fetch(`${GW}/files/${id}/export?mimeType=${encodeURIComponent(exportMime)}`, { headers: gwHeaders() });
        if (exportMime.endsWith("sheet")) filename += ".xlsx";
        else if (exportMime.endsWith("presentation")) filename += ".pptx";
        else filename += ".pdf";
      } else {
        dl = await fetch(`${GW}/files/${id}?alt=media`, { headers: gwHeaders() });
      }
      if (!dl.ok) return new Response(await dl.text(), { status: dl.status, headers: corsHeaders });
      return new Response(dl.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": dl.headers.get("Content-Type") ?? "application/octet-stream",
          "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
