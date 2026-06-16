export type Role = "admin" | "surveyor";
export interface Session { role: Role; username: string }

const KEY = "mru_session";

const USERS: Record<string, { password: string; role: Role }> = {
  admin: { password: "123999", role: "admin" },
  surveyor: { password: "123111", role: "surveyor" },
};

export function login(username: string, password: string): Session | null {
  const u = USERS[username.trim().toLowerCase()];
  if (!u || u.password !== password) return null;
  const session: Session = { role: u.role, username: username.trim().toLowerCase() };
  localStorage.setItem(KEY, JSON.stringify(session));
  return session;
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as Session : null;
  } catch { return null; }
}

export function logout() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}
