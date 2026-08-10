import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Which engineers logged duplicate KM values?",
  "Any sudden surge in KM within a week?",
  "Why does Jaseem have low KM?",
  "Top 5 employees by payable amount",
];

function Line({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function FuelAssistant({ dataset }: { dataset: unknown }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("fuel-ai", {
        body: { messages: next, dataset },
      });
      if (error) throw error;
      const reply = (data as { reply?: string; error?: string })?.reply
        || (data as { error?: string })?.error
        || "No answer returned.";
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `Could not reach the assistant: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => boxRef.current?.scrollTo({ top: 1e9 }));
    }
  }

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-[#4a0505] to-[#c41212] flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white">Fuel Governance Assistant</p>
          <p className="text-[10px] text-white/70">Ask about duplicate readings, KM surges, payables or an employee</p>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} className="text-[10px] text-white/80 hover:text-white underline">Clear</button>
        )}
      </div>

      <div ref={boxRef} className="max-h-72 overflow-y-auto px-4 py-3 space-y-3">
        {msgs.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Answers are computed from the trips currently in view (respects your date filter).
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <div className={`inline-block max-w-[85%] text-left text-xs whitespace-pre-wrap leading-relaxed ${
              m.role === "user"
                ? "rounded-lg bg-[#dc2626] text-white px-3 py-2"
                : "text-[#111]"
            }`}>
              <Line text={m.content} />
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-muted-foreground animate-pulse">Analysing trips…</p>}
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => ask(s)} disabled={busy}
            className="text-[10px] px-2 py-1 rounded-full border border-border hover:bg-secondary disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }}
        className="border-t border-border px-3 py-2 flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about fuel consumption…"
          className="flex-1 h-9 px-3 text-sm border border-input rounded-md bg-white" />
        <button type="submit" disabled={busy || !input.trim()}
          className="h-9 px-3 rounded-md bg-[#dc2626] text-white text-[11px] font-semibold hover:opacity-90 disabled:opacity-50">
          Ask
        </button>
      </form>
    </div>
  );
}
