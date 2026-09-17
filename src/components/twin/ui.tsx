import type { ReactNode } from "react";
import type { Confidence, SourceTag } from "@/lib/twin";

export const PANEL = "rounded-xl border border-[#26262b] bg-[#131316]";
export const INPUT =
  "w-full h-9 px-2.5 rounded-md bg-[#0d0d0f] border border-[#2c2c32] text-[13px] text-white outline-none focus:border-[#dc2626]";
export const LABEL = "text-[10px] uppercase tracking-[0.14em] text-white/45";

export function Panel({
  title, subtitle, right, children, className = "",
}: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`${PANEL} ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#26262b]">
          <div>
            {title && <h3 className="font-heading text-[13px] font-semibold tracking-wide text-white uppercase">{title}</h3>}
            {subtitle && <p className="text-[11px] text-white/45 mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-[#22c55e]" : tone === "warn" ? "text-[#f59e0b]" : tone === "bad" ? "text-[#ef4444]" : "text-white";
  return (
    <div className="rounded-lg border border-[#26262b] bg-[#0f0f11] px-3 py-2.5">
      <p className={LABEL}>{label}</p>
      <p className={`font-heading text-[17px] font-semibold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
    </div>
  );
}

export function Num({
  label, value, onChange, step = 1, prefix, suffix, hint,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; prefix?: string; suffix?: string; hint?: string }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        {prefix && <span className="text-[11px] text-white/40">{prefix}</span>}
        <input
          type="number" step={step} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={INPUT}
        />
        {suffix && <span className="text-[11px] text-white/40 whitespace-nowrap">{suffix}</span>}
      </span>
      {hint && <span className="block text-[10px] text-white/35 mt-0.5">{hint}</span>}
    </label>
  );
}

export function Txt({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options?: readonly string[] }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} mt-1`}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} mt-1`} />
      )}
    </label>
  );
}

export function Range({
  label, value, min, max, step = 1, onChange, format,
}: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={LABEL}>{label}</span>
        <span className="font-heading text-[13px] font-semibold text-white">{format ? format(value) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-2 accent-[#dc2626]"
      />
      <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
        <span>{format ? format(min) : min}</span><span>{format ? format(max) : max}</span>
      </div>
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "good" | "warn" | "bad" | "brand" }) {
  const cls = {
    muted: "border-[#2f2f36] text-white/55",
    good: "border-[#22c55e]/40 text-[#4ade80] bg-[#22c55e]/10",
    warn: "border-[#f59e0b]/40 text-[#fbbf24] bg-[#f59e0b]/10",
    bad: "border-[#ef4444]/40 text-[#f87171] bg-[#ef4444]/10",
    brand: "border-[#dc2626]/50 text-[#f87171] bg-[#dc2626]/10",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

export function SourceBadge({ source, confidence }: { source: SourceTag; confidence?: Confidence }) {
  const tone = source === "Approved Rate Card" || source === "Historical Project Data" ? "good" : source === "Estimated" ? "warn" : "muted";
  return (
    <span className="inline-flex items-center gap-1">
      <Tag tone={tone as "good" | "warn" | "muted"}>{source}</Tag>
      {confidence && <Tag tone={confidence === "High" ? "good" : confidence === "Medium" ? "muted" : "bad"}>{confidence}</Tag>}
    </span>
  );
}

export function Bar({ pct, tone = "brand" }: { pct: number; tone?: "brand" | "good" | "warn" | "bad" }) {
  const bg = { brand: "bg-[#dc2626]", good: "bg-[#22c55e]", warn: "bg-[#f59e0b]", bad: "bg-[#ef4444]" }[tone];
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${bg}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return <th className={`px-2.5 py-2 text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
export function Td({ children, right, className = "" }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-2.5 py-2 text-[12px] text-white/85 ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[560px] border-collapse">{children}</table>
    </div>
  );
}
