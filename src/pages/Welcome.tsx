import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, homeFor, getProfile } from "@/lib/auth";
import { PHOTOS, initialsOf } from "@/lib/photos";
import eandLogo from "@/assets/eand.png";

export default function Welcome() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) { navigate("/"); return; }

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => navigate(homeFor(s.role), { replace: true }), 500);
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const s = getSession();
  const profile = s ? getProfile(s.username) : undefined;
  const displayName = profile?.name || s?.username;
  const photo = profile ? PHOTOS[profile.photo] : undefined;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div
        className={`flex flex-col items-center transition-all duration-500 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <img src={eandLogo} alt="e&" className="h-12 w-auto mb-6" />
        {profile && (
          photo ? (
            <img
              src={photo}
              alt={profile.name}
              className="h-24 w-24 rounded-lg object-cover border border-border shadow-sm mb-4 animate-[pop_400ms_ease-out]"
            />
          ) : (
            <div className="h-24 w-24 rounded-lg border border-border bg-[#dc2626] text-white flex items-center justify-center text-2xl font-semibold mb-4 animate-[pop_400ms_ease-out]">
              {initialsOf(profile.name)}
            </div>
          )
        )}
        <h1 className="text-3xl font-semibold text-[#111] tracking-tight">
          Welcome, {displayName}
        </h1>
        {profile?.title && (
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{profile.title}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Loading your workspace…
        </p>
        <div className="mt-6 h-1 w-24 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-[#dc2626] animate-[load_3s_ease-out_forwards]" />
        </div>
      </div>
      <style>{`
        @keyframes load {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes pop {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
