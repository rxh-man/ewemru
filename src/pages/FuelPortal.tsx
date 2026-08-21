import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSession, login, logout, type Session } from "@/lib/auth";
import { FuelGovernance } from "@/components/FuelGovernance";
import eandLogo from "@/assets/eand.png";
import { Toaster, toast } from "sonner";

type Row = Record<string, string>;

export default function FuelPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (s?.role === "routes") setSession(s);
  }, []);

  useEffect(() => {
    if (!session) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase.functions.invoke("sheet-data");
      if (!alive) return;
      if (err) toast.error("Could not load the fuel sheet.");
      else setRows(((data as { fuel?: Row[] } | null)?.fuel ?? []) as Row[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [session]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const s = login(username, password);
    if (!s || s.role !== "routes") {
      if (s) logout();
      setError("Use your fuel governance account to continue.");
      return;
    }
    setSession(s);
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-background px-5 py-10 flex items-center justify-center">
        <section className="w-full max-w-sm" aria-labelledby="fuel-sign-in-title">
          <img src={eandLogo} alt="e&" className="h-10 w-auto mb-8" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Fuel Governance</p>
          <h1 id="fuel-sign-in-title" className="mt-2 text-3xl font-semibold text-foreground">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">Authorised fuel governance access only.</p>
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label htmlFor="fuel-user" className="text-xs font-medium text-foreground">Username</label>
              <input id="fuel-user" autoFocus autoComplete="username" value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label htmlFor="fuel-pass" className="text-xs font-medium text-foreground">Password</label>
              <input id="fuel-pass" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <button type="submit" className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
              Open fuel governance
            </button>
          </form>
        </section>
        <Toaster position="top-center" richColors />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={eandLogo} alt="e&" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-[#111]">Fuel Governance</span>
          </div>
          <button onClick={() => { logout(); setSession(null); }}
            className="text-xs text-muted-foreground hover:text-[#111]">Logout</button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">
        {loading && !rows.length ? (
          <p className="text-sm text-muted-foreground">Loading fuel data…</p>
        ) : (
          <FuelGovernance rows={rows} />
        )}
      </main>
      <Toaster position="top-center" richColors />
    </div>
  );
}
