import { useNavigate } from "react-router-dom";
import { logout, type Session } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";
import { Toaster } from "sonner";

export function AppShell({ session, children }: { session: Session; children: React.ReactNode }) {
  const navigate = useNavigate();
  function handleLogout() {
    logout();
    navigate("/");
  }
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={eandLogo} alt="e&" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-[#111]">{session.role === "hr" ? "PO Portal" : "Etihad MRU Automation"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
              {session.role}
            </span>
            <button onClick={handleLogout} className="text-xs text-muted-foreground hover:text-[#111]">
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
      <Toaster position="top-center" richColors />
    </div>
  );
}
