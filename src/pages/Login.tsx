import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, getSession, homeFor } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";
import { LoginVideo } from "@/components/LoginVideo";
import { R } from "@/lib/routes";


export default function Login() {
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
    navigate(R.welcome);
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <LoginVideo />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={eandLogo} alt="e&" className="h-14 w-auto mb-4 invert" />
          <h1 className="text-xl font-semibold text-white">Delivery & Operations</h1>
          <p className="text-sm text-white/70 mt-1">Innovation</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 border border-white/15 rounded-lg p-5 bg-white/95 backdrop-blur">

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
          <button type="submit" className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
