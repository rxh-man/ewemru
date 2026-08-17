export type Role = "admin" | "surveyor" | "ft" | "hr" | "routes";
export interface Session { role: Role; username: string }

export type TrackKey = "field" | "msp" | "noc" | "gnoc" | "customer" | "resources" | "fuel" | "emind";
export interface Access { tracks: TrackKey[]; innovation: boolean; urgent: boolean }
export interface Profile { name: string; title: string; photo: string }

export interface UserRecord {
  password: string;
  role: Role;
  profile?: Profile;
  access?: Access;
  manageUsers?: boolean;
}

export const ALL_TRACKS: TrackKey[] = ["field", "msp", "noc", "gnoc", "customer", "resources", "fuel", "emind"];

const BASE_USERS: Record<string, UserRecord> = {
  admin: {
    password: "rahman786",
    role: "hr",
    manageUsers: true,
    profile: { name: "Administrator", title: "Portal Administrator", photo: "" },
  },
  admin1: {
    password: "586786", role: "hr",
    profile: { name: "Fuel Governance Admin", title: "Fuel Governance", photo: "" },
    access: { tracks: ["fuel"], innovation: false, urgent: false },
  },
  field: {
    password: "900000", role: "routes",
    profile: { name: "Field Routing", title: "Field Team Route Planning", photo: "" },
  },
  mruadmin: { password: "123999", role: "admin" },
  surveyor: { password: "123111", role: "surveyor" },
  engineer: { password: "demo123", role: "ft" },
  marina: {
    password: "123999", role: "hr",
    profile: { name: "Marina Emad", title: "Contracts & Procurement", photo: "marina" },
  },
  asaad: {
    password: "786321", role: "hr",
    profile: { name: "Asaad Tawfik", title: "Head of Delivery and Operations", photo: "asaad" },
  },
  kavita: {
    password: "123000", role: "hr",
    profile: { name: "Kavita", title: "Success Manager", photo: "kavita" },
    access: { tracks: ["msp", "field", "customer", "resources"], innovation: true, urgent: false },
  },
  ahmed: {
    password: "123000", role: "hr",
    profile: { name: "Ahmed Aly Fathy", title: "Delivery & Operations", photo: "ahmed" },
  },
  arashwan: {
    password: "amr1750", role: "hr",
    profile: { name: "Amr Rashwan", title: "Delivery & Operations", photo: "amr" },
  },
};

const KEY = "mru_session";
const USERS_KEY = "mru_custom_users";

function readCustom(): Record<string, UserRecord> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || "{}") as Record<string, UserRecord>; }
  catch { return {}; }
}

function writeCustom(u: Record<string, UserRecord>) {
  if (typeof window !== "undefined") localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

export function allUsers(): Record<string, UserRecord> {
  return { ...BASE_USERS, ...readCustom() };
}

export function isBaseUser(username: string) {
  return username in BASE_USERS;
}

export function customUsers(): Record<string, UserRecord> {
  return readCustom();
}

export function createUser(username: string, rec: UserRecord): string | null {
  const u = username.trim().toLowerCase();
  if (!u) return "Username is required";
  if (!rec.password) return "Password is required";
  if (allUsers()[u]) return "That username already exists";
  const custom = readCustom();
  custom[u] = rec;
  writeCustom(custom);
  return null;
}

export function deleteUser(username: string): string | null {
  const u = username.trim().toLowerCase();
  if (isBaseUser(u)) return "Built-in users cannot be removed";
  const custom = readCustom();
  if (!custom[u]) return "User not found";
  delete custom[u];
  writeCustom(custom);
  return null;
}

export function getProfile(username: string): Profile | undefined {
  return allUsers()[username]?.profile;
}

export function getAccess(username: string): Access | undefined {
  return allUsers()[username]?.access;
}

export function canManageUsers(username: string): boolean {
  return !!allUsers()[username]?.manageUsers;
}

// Legacy exports kept for compatibility
export const HR_PROFILES: Record<string, Profile> = Object.fromEntries(
  Object.entries(BASE_USERS).filter(([, v]) => v.profile).map(([k, v]) => [k, v.profile as Profile])
);
export const HR_ACCESS: Record<string, Access> = Object.fromEntries(
  Object.entries(BASE_USERS).filter(([, v]) => v.access).map(([k, v]) => [k, v.access as Access])
);

export function login(username: string, password: string): Session | null {
  const key = username.trim().toLowerCase();
  const u = allUsers()[key];
  if (!u || u.password !== password) return null;
  const session: Session = { role: u.role, username: key };
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

export function homeFor(role: Role): string {
  if (role === "routes") return "/routes";
  if (role === "admin") return "/admin";
  if (role === "surveyor") return "/surveyor";
  if (role === "hr") return "/hr";
  return "/ft";
}
