import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSession, canManageUsers, allUsers, customUsers, createUser, deleteUser,
  isBaseUser, ALL_TRACKS, type Session, type TrackKey,
} from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { toast } from "sonner";

export default function UserAdmin() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [tick, setTick] = useState(0);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [tracks, setTracks] = useState<TrackKey[]>([...ALL_TRACKS]);
  const [innovation, setInnovation] = useState(true);
  const [urgent, setUrgent] = useState(true);

  useEffect(() => {
    const s = getSession();
    if (!s) { navigate("/"); return; }
    if (!canManageUsers(s.username)) { navigate("/hr"); return; }
    setSession(s);
  }, [navigate]);

  const users = useMemo(() => allUsers(), [tick]);
  const custom = useMemo(() => customUsers(), [tick]);

  function toggleTrack(t: TrackKey) {
    setTracks((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = createUser(username, {
      password,
      role: "hr",
      profile: { name: name.trim() || username.trim(), title: title.trim() || "Delivery & Operations User", photo: "" },
      access: { tracks, innovation, urgent },
    });
    if (err) { toast.error(err); return; }
    toast.success(`User "${username.trim().toLowerCase()}" created`);
    setUsername(""); setPassword(""); setName(""); setTitle("");
    setTracks([...ALL_TRACKS]); setInnovation(true); setUrgent(true);
    setTick((t) => t + 1);
  }

  function remove(u: string) {
    const err = deleteUser(u);
    if (err) { toast.error(err); return; }
    toast.success(`Removed "${u}"`);
    setTick((t) => t + 1);
  }

  if (!session) return null;

  return (
    <AppShell session={session}>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-[#111]">User Management</h1>
          <p className="text-xs text-muted-foreground mt-1">Create Delivery & Operations logins and scope their access.</p>
        </div>

        <form onSubmit={submit} className="border border-border rounded-lg p-4 bg-white space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input required placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)}
              className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
            <input required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
            <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
              className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
            <input placeholder="Designation" value={title} onChange={(e) => setTitle(e.target.value)}
              className="h-9 px-3 text-sm border border-input rounded-md bg-white" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracks</span>
            {ALL_TRACKS.map((t) => (
              <button type="button" key={t} onClick={() => toggleTrack(t)}
                className={`px-3 h-8 rounded-md text-xs font-medium border transition ${tracks.includes(t) ? "bg-[#dc2626] text-white border-[#dc2626]" : "bg-white text-[#111] border-border hover:bg-secondary"}`}>
                {t}
              </button>
            ))}
            <span className="mx-2 h-6 w-px bg-border" />
            <button type="button" onClick={() => setInnovation((v) => !v)}
              className={`px-3 h-8 rounded-md text-xs font-medium border transition ${innovation ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border"}`}>
              Innovation Tools
            </button>
            <button type="button" onClick={() => setUrgent((v) => !v)}
              className={`px-3 h-8 rounded-md text-xs font-medium border transition ${urgent ? "bg-[#111] text-white border-[#111]" : "bg-white text-[#111] border-border"}`}>
              Top Urgent PO / PR
            </button>
          </div>
          <button type="submit" className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90">
            Create user
          </button>
        </form>

        <div className="border border-border rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-xs font-semibold text-[#111]">
            All users · {Object.keys(users).length}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  {["Username", "Name", "Designation", "Role", "Access", "Type", ""].map((h) => (
                    <th key={h} className="text-left font-medium px-3 py-2 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(users).map(([u, rec]) => (
                  <tr key={u} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-[#111]">{u}</td>
                    <td className="px-3 py-2">{rec.profile?.name || "—"}</td>
                    <td className="px-3 py-2">{rec.profile?.title || "—"}</td>
                    <td className="px-3 py-2 uppercase">{rec.role}</td>
                    <td className="px-3 py-2">{rec.access ? rec.access.tracks.join(", ") : "Full"}</td>
                    <td className="px-3 py-2">{isBaseUser(u) ? "Built-in" : "Custom"}</td>
                    <td className="px-3 py-2 text-right">
                      {!isBaseUser(u) && (
                        <button onClick={() => remove(u)} className="text-[#dc2626] hover:underline">Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Object.keys(custom).length === 0 && (
            <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border">
              Custom users are stored on this browser/device.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
