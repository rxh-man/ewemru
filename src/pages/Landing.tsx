import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getSession, homeFor } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";

export default function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    const s = getSession();
    if (s) navigate(homeFor(s.role));
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={eandLogo} alt="e&" className="h-8 w-auto" />
            <span className="text-sm font-semibold text-[#111]">Operations Portal</span>
          </div>
          <Link to="/hr-login" className="text-xs font-medium text-primary hover:opacity-80">Sign in</Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary mb-4">Etihad WE · Internal</p>
          <h1 className="text-4xl sm:text-5xl font-semibold text-[#111] leading-tight max-w-3xl">
            One workspace for procurement tracking, vendor payments and field operations.
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl">
            Live insights from the master tracker. Sign in to view blockers, pending items and action owners across every project.
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/hr-login" className="group relative overflow-hidden rounded-xl border border-border p-6 bg-white hover:border-primary transition">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide">HR Command Center</div>
              <h3 className="mt-3 text-lg font-semibold text-[#111]">MR Tracker Dashboard</h3>
              <p className="mt-1 text-sm text-muted-foreground">Live blockers, pending items, action owners across PO/PR, payments and vendors.</p>
              <div className="mt-6 text-sm font-medium text-primary">Sign in →</div>
            </Link>
            <div className="rounded-xl border border-border p-6 bg-secondary/40">
              <div className="text-xs font-semibold text-[#111] uppercase tracking-wide">Field Operations</div>
              <h3 className="mt-3 text-lg font-semibold text-[#111]">Survey Reports</h3>
              <p className="mt-1 text-sm text-muted-foreground">Field engineers access site survey reports on the ground by USN.</p>
              <div className="mt-6 text-xs text-muted-foreground">Access via issued credentials only.</div>
            </div>
            <div className="rounded-xl border border-border p-6 bg-secondary/40">
              <div className="text-xs font-semibold text-[#111] uppercase tracking-wide">Master Data</div>
              <h3 className="mt-3 text-lg font-semibold text-[#111]">Energy & Water Sites</h3>
              <p className="mt-1 text-sm text-muted-foreground">Central reference for site USNs, meters and vendor coverage.</p>
              <div className="mt-6 text-xs text-muted-foreground">Managed by admin.</div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Etihad WE — Internal Use</span>
          <div className="flex items-center gap-4">
            <Link to="/ft" className="hover:text-[#111]">Field Tech</Link>
            <Link to="/mru-login" className="hover:text-[#111]">MRU Automation</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
