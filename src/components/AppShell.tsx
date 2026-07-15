import { useNavigate } from "react-router-dom";
import { logout, type Session, HR_PROFILES } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";
import marinaDp from "@/assets/marina.png";
import asaadDp from "@/assets/asaad.png";
import { Toaster } from "sonner";

const HR_PHOTOS: Record<string, string> = { marina: marinaDp, asaad: asaadDp };

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
          <div className="flex items-center gap-3">
            {session.role === "hr" && (() => {
              const profile = HR_PROFILES[session.username];
              if (!profile) return null;
              const photo = HR_PHOTOS[profile.photo];
              return (
                <div className="flex items-center gap-2">
                  <img src={photo} alt={profile.name} className="h-8 w-8 rounded-full object-cover border border-border" />
                  <div className="hidden sm:flex flex-col leading-tight">
                    <span className="text-xs font-medium text-[#111]">{profile.name}</span>
                    <span className="text-[10px] text-muted-foreground">{profile.title}</span>
                  </div>
                </div>
              );
            })()}
            {session.role !== "hr" && (
              <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">
                {session.role}
              </span>
            )}
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
