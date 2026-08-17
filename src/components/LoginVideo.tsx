const VIDEO_SRC = `${import.meta.env.BASE_URL}media/eand-bg.mp4`;

/** Looping e& brand video used as a login backdrop. */
export function LoginVideo({ overlay = "dark" }: { overlay?: "dark" | "soft" }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#111]">
      <video
        src={VIDEO_SRC}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
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
