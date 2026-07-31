import marina from "@/assets/marina.png";
import asaad from "@/assets/asaad.png";
import kavita from "@/assets/kavita.png";
import ahmed from "@/assets/ahmed.png";
import amr from "@/assets/amr.png";

export const PHOTOS: Record<string, string> = { marina, asaad, kavita, ahmed, amr };

export function initialsOf(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
