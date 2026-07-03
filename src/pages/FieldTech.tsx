import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getSession, type Session } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ENERGY_FIELDS, WATER_FIELDS } from "@/lib/fields";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/drive-files`;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

type SiteRow = Record<string, string | null> & { site_type?: "energy" | "water" };

export default function FieldTech() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string>("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [site, setSite] = useState<SiteRow | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s || s.role !== "ft") { navigate("/"); return; }
    setSession(s);
    void loadFiles("");
  }, [navigate]);

  async function loadFiles(q: string) {
    setFilesLoading(true);
    setFilesError(null);
    try {
      const url = new URL(FN_URL);
      url.searchParams.set("action", "list");
      if (q) url.searchParams.set("q", q);
      const r = await fetch(url.toString());
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Drive error ${r.status}`);
      setFiles(data.files ?? []);
    } catch (e) {
      setFilesError((e as Error).message);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const usn = query.trim();
    setSubmitted(usn);
    setSite(null);
    if (!usn) { void loadFiles(""); return; }
    setSiteLoading(true);
    try {
      const [{ data: e1 }, { data: w1 }] = await Promise.all([
        supabase.from("energy_sites" as never).select("*").eq("usn", usn).maybeSingle(),
        supabase.from("water_sites" as never).select("*").eq("serial_number", usn).maybeSingle(),
      ]);
      if (e1) setSite({ ...(e1 as SiteRow), site_type: "energy" });
      else if (w1) setSite({ ...(w1 as SiteRow), site_type: "water" });
      else setSite(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSiteLoading(false);
    }
    void loadFiles(usn);
  }

  async function download(f: DriveFile) {
    setDownloading(f.id);
    try {
      const url = new URL(FN_URL);
      url.searchParams.set("action", "download");
      url.searchParams.set("id", f.id);
      const r = await fetch(url.toString());
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = f.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast.error("Download failed: " + (e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  const fields = useMemo(() => {
    if (!site) return [];
    return site.site_type === "energy" ? ENERGY_FIELDS : WATER_FIELDS;
  }, [site]);

  if (!session) return null;

  return (
    <AppShell session={session}>
      <div className="space-y-5">
        <div className="border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#111]">Site lookup</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Enter a USN (Energy) or Serial Number (Water) to pull site details from the master tracker
            and matching survey reports from Google Drive.
          </p>
          <form onSubmit={onSearch} className="mt-3 flex gap-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. 12345678"
              className="flex-1 h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>

        {submitted && (
          <div className="border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#111]">
                Site details — {submitted}
              </h3>
              {site && (
                <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                  {site.site_type}
                </span>
              )}
            </div>
            {siteLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
            {!siteLoading && !site && (
              <p className="text-xs text-muted-foreground">
                No matching site found in the master tracker.
              </p>
            )}
            {!siteLoading && site && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                {fields.map((f) => (
                  <div key={f.key} className="flex justify-between gap-3 border-b border-border py-1">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="text-[#111] text-right font-medium truncate max-w-[60%]" title={site[f.key] ?? ""}>
                      {site[f.key] ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}

        <div className="border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#111]">
              Survey reports {submitted ? `matching "${submitted}"` : "(all)"}
            </h3>
            <span className="text-[11px] text-muted-foreground">{files.length} file(s)</span>
          </div>
          {filesLoading && <p className="text-xs text-muted-foreground">Loading files…</p>}
          {filesError && <p className="text-xs text-destructive">{filesError}</p>}
          {!filesLoading && !filesError && files.length === 0 && (
            <p className="text-xs text-muted-foreground">No reports found.</p>
          )}
          {!filesLoading && files.length > 0 && (
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-[#111] truncate">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""}
                      {f.size ? ` · ${(Number(f.size) / 1024).toFixed(0)} KB` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs px-3 h-8 inline-flex items-center rounded-md border border-input hover:bg-secondary"
                      >
                        Open
                      </a>
                    )}
                    <button
                      onClick={() => download(f)}
                      disabled={downloading === f.id}
                      className="text-xs px-3 h-8 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      {downloading === f.id ? "…" : "Download"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
