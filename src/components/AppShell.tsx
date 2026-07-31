import { useNavigate } from "react-router-dom";
import { logout, type Session, getProfile, canManageUsers } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";
import { PHOTOS, initialsOf } from "@/lib/photos";
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
          <div className="flex items-center gap-3">
            {canManageUsers(session.username) && (
              <button onClick={() => navigate("/users")} className="text-xs font-medium text-[#111] hover:text-[#dc2626]">
                Manage users
              </button>
            )}
            {session.role === "hr" && (() => {
              const profile = getProfile(session.username);
              if (!profile) return null;
              const photo = PHOTOS[profile.photo];
              return (
                <div className="flex items-center gap-2">
                  {photo ? (
                    <img src={photo} alt={profile.name} className="h-8 w-8 rounded-full object-cover border border-border" />
                  ) : (
                    <div className="h-8 w-8 rounded-full border border-border bg-[#dc2626] text-white flex items-center justify-center text-[11px] font-semibold">
                      {initialsOf(profile.name)}
                    </div>
                  )}
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
