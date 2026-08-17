import { useRef, useState } from "react";
import videoAsset from "@/assets/eand-bg.mp4.asset.json";

/**
 * Candidate sources, tried in order:
 *  1. file shipped with the build (works on GitHub Pages when the media folder is committed)
 *  2. Lovable CDN asset (absolute, works from any host incl. GitHub Pages)
 */
const SOURCES = [
  `${import.meta.env.BASE_URL}media/eand-bg.mp4`,
  `https://ewemru.lovable.app${videoAsset.url}`,
  videoAsset.url,
];

/** Looping e& brand video used as a login backdrop. */
export function LoginVideo({ overlay = "dark" }: { overlay?: "dark" | "soft" }) {
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLVideoElement>(null);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#111]">
      <video
        ref={ref}
        key={SOURCES[idx]}
        src={SOURCES[idx]}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        aria-hidden="true"
        onError={() => setIdx((i) => (i < SOURCES.length - 1 ? i + 1 : i))}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className={
          overlay === "dark"
            ? "absolute inset-0 bg-gradient-to-t from-[#111]/95 via-[#111]/70 to-[#111]/40"
            : "absolute inset-0 bg-white/80 backdrop-blur-[2px]"
        }
      />
    </div>
  );
}
