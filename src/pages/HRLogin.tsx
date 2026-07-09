import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { login, getSession, homeFor } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";

export default function HRLogin() {
  const navigate = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (s) navigate(homeFor(s.role));
  }, [navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const s = login(u, p);
    if (!s) { setErr("Invalid username or password"); return; }
    navigate(homeFor(s.role));
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between bg-[#111] text-white p-12">
          <div className="flex items-center gap-2">
            <img src={eandLogo} alt="e&" className="h-8 w-auto invert" />
            <span className="text-sm font-semibold">PO Portal</span>
          </div>
          <div>
            <h2 className="text-3xl font-semibold leading-tight max-w-md">Contract & Procurement</h2>
            <p className="mt-3 text-sm text-white/70 max-w-md">Blockers, pending items, action owners and vendor status, always in sync.</p>
          </div>
          <p className="text-xs text-white/50">Restricted access · D&O</p>

        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <img src={eandLogo} alt="e&" className="h-7 w-auto" />
              <span className="text-sm font-semibold text-[#111]">PO Portal</span>
            </div>
            <h1 className="text-2xl font-semibold text-[#111]">Sign in</h1>
            <p className="text-sm text-muted-foreground mt-1">HR access to the MR Tracker dashboard.</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <div>
                <label className="text-xs font-medium text-[#111]">Username</label>
                <input autoFocus value={u} onChange={(e) => setU(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#111]">Password</label>
                <input type="password" value={p} onChange={(e) => setP(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-white text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <button type="submit" className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
                Sign in
              </button>
            </form>
          </div>
        </div>
      </div>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} RAHMAN08 — Internal Use</span>
          <div className="flex items-center gap-4">
            <Link to="/ft" className="hover:text-[#111]">Field Tech</Link>
            <Link to="/mru-login" className="hover:text-[#111]">MRU Automation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
