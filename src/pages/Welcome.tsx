import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, homeFor, HR_PROFILES } from "@/lib/auth";
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
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  const s = getSession();
  const displayName = s && (HR_PROFILES[s.username]?.name || s.username);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div
        className={`flex flex-col items-center transition-all duration-500 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <img src={eandLogo} alt="e&" className="h-12 w-auto mb-6" />
        <h1 className="text-3xl font-semibold text-[#111] tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Loading your workspace…
        </p>
        <div className="mt-6 h-1 w-24 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-[#dc2626] animate-[load_2s_ease-out_forwards]" />
        </div>
      </div>
      <style>{`
        @keyframes load {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
