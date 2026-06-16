import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { login, getSession } from "@/lib/auth";
import eandLogo from "@/assets/eand.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Etihad MRU Automation" },
      { name: "description", content: "Sign in to the e& MRU field verification tool." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = getSession();
    if (s) navigate({ to: s.role === "admin" ? "/admin" : "/surveyor" });
  }, [navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const s = login(u, p);
    if (!s) { setErr("Invalid username or password"); return; }
    navigate({ to: s.role === "admin" ? "/admin" : "/surveyor" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={eandLogo} alt="e&" className="h-14 w-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#111]">Etihad MRU Automation</h1>
          <p className="text-sm text-muted-foreground mt-1">Field verifier sign in</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 border border-border rounded-lg p-5">
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
