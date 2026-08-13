import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, Legend,
} from "recharts";

const RED = ["#dc2626", "#ef4444", "#b91c1c", "#f87171", "#7f1d1d", "#fca5a5", "#991b1b", "#fecaca"];

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function clean(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s === "#ERROR!" || s === "#N/A" || s === "-") return "";
  return s;
}

/** Find a row whose cell at `labelCol` matches label (case-insensitive) and read `valueCol`. */
function pick(raw: string[][], label: string, labelCol = 0, valueCol = 1): number | null {
  const target = label.toLowerCase();
  for (const r of raw) {
    if (!r) continue;
    if (clean(r[labelCol]).toLowerCase() === target) {
      const v = clean(r[valueCol]);
      if (v === "") return null;
      return num(v);
    }
  }
  return null;
}

function pickRow(raw: string[][], label: string, labelCol = 0): string[] | null {
  const target = label.toLowerCase();
  for (const r of raw) if (r && clean(r[labelCol]).toLowerCase() === target) return r;
  return null;
}

const HIRING_STAGES = [
  "Requested",
  "Selected",
  "Documents Under Process",
  "Under Clearance Approval",
  "Clearance Approved",
  "Offer Rejected",
  "Onboarding Process",
  "Onboarded",
];

export function EmindSection({ emindRaw, fleetSheetRaw }: { emindRaw: string[][]; fleetSheetRaw: string[][] }) {
  const emind = emindRaw || [];
  const fleet = fleetSheetRaw || [];

  /* ---------------- eMind workforce ---------------- */
  const workforce = useMemo(() => ({
    plannedOverall: pick(emind, "Overall Planned"),
    required: pick(emind, "Total Resources Required"),
    planned: pick(emind, "Total Resources Planned"),
    inHouse: pick(emind, "In-House"),
    outsourced: pick(emind, "Outsourced"),
    gap: pick(emind, "Overall Gap"),
    replacement: pick(emind, "Replacement of Existing Resources"),
    additional: pick(emind, "New / Additional Resources"),
  }), [emind]);

  const phase = useMemo(() => {
    const rows: { name: string; p0: number; p1: number; total: number }[] = [];
    for (const label of ["Required", "Replacement", "New"]) {
      const r = pickRow(emind, label);
      if (r && clean(r[1]) !== "") rows.push({ name: label, p0: num(r[1]), p1: num(r[2]), total: num(r[3]) });
    }
    return rows;
  }, [emind]);

  const hiring = useMemo(() => HIRING_STAGES.map((s) => ({ name: s, value: pick(emind, s) ?? 0 }))
    .filter((d) => d.value > 0 || d.name === "Onboarded"), [emind]);

  const byProject = useMemo(() => {
    // 5B block: Metric | EWE | TAQA | Total  starting at column index 3
    const out: { name: string; ewe: number; taqa: number; total: number }[] = [];
    const labels = ["Requested (Headcount)", "Selected", "Documents Under Process", "Under Clearance Approval", "Clearance Approved", "Offer Rejected", "Onboarding Process", "Onboarded"];
    for (const l of labels) {
      const r = pickRow(emind, l, 3);
      if (!r) continue;
      out.push({ name: l.replace(" (Headcount)", ""), ewe: num(r[4]), taqa: num(r[5]), total: num(r[6]) });
    }
    return out;
  }, [emind]);

  const cear = useMemo(() => {
    const rows: { name: string; note: string }[] = [];
    for (const r of emind) {
      const label = clean(r?.[5]);
      if (!label) continue;
      if (/^(cear|missing cear|next cear)/i.test(label)) {
        const cells = [clean(r[6]), clean(r[7]), clean(r[8]), clean(r[9])].filter(Boolean);
        rows.push({ name: label, note: cells.join(" | ") || "-" });
      }
    }
    return rows;
  }, [emind]);

  /* ---------------- Fleet & resources ---------------- */
  const fleetRows = useMemo(() => {
    if (fleet.length < 2) return [] as Record<string, string>[];
    const head = fleet[0].map((h) => clean(h));
    return fleet.slice(1)
      .filter((r) => clean(r?.[1]) !== "")
      .map((r) => {
        const o: Record<string, string> = {};
        head.forEach((h, i) => { o[h || `col_${i}`] = clean(r[i]); });
        return o;
      });
  }, [fleet]);

  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [carOnly, setCarOnly] = useState<"" | "yes" | "no">("");

  const filteredFleet = useMemo(() => fleetRows.filter((r) => {
    if (dept && r.Department !== dept) return false;
    const hasCar = /^yes$/i.test(r.Car || "");
    if (carOnly === "yes" && !hasCar) return false;
    if (carOnly === "no" && hasCar) return false;
    if (q) {
      const hay = Object.values(r).join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [fleetRows, dept, carOnly, q]);

  const depts = useMemo(() => [...new Set(fleetRows.map((r) => r.Department).filter(Boolean))].sort(), [fleetRows]);

  const withCar = filteredFleet.filter((r) => /^yes$/i.test(r.Car || "")).length;
  const withoutCar = filteredFleet.length - withCar;
  const coverage = filteredFleet.length ? Math.round((withCar / filteredFleet.length) * 100) : 0;

  function tally(key: string, mapper?: (s: string) => string) {
    const m = new Map<string, number>();
    for (const r of filteredFleet) {
      const raw = r[key];
      if (!raw) continue;
      const k = mapper ? mapper(raw) : raw;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }

  const byDept = useMemo(() => tally("Department"), [filteredFleet]);
  const byResourceVendor = useMemo(() => tally("Resource Vendor"), [filteredFleet]);
  const byCarVendor = useMemo(() => tally("Car Vendor"), [filteredFleet]);
  const byRole = useMemo(() => tally("Role", (s) => s.replace(/technition/i, "Technician")), [filteredFleet]);
  const byModel = useMemo(() => tally("Vehicle Model", (s) => s.replace(/mitshubishi/i, "Mitsubishi").replace(/\bsunny\b/i, "Sunny")), [filteredFleet]);

  const missingPlate = filteredFleet.filter((r) => /^yes$/i.test(r.Car || "") && !r["Plate No."]).length;
  const missingId = filteredFleet.filter((r) => !r.ID).length;
  const missingEmail = filteredFleet.filter((r) => !r.Email).length;

  const noData = emind.length === 0 && fleetRows.length === 0;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="bg-gradient-to-br from-[#7f1d1d] via-[#991b1b] to-[#dc2626] text-white p-6">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">Delivery &amp; Operations · Executive View</div>
          <h2 className="text-2xl font-semibold mt-1">eMind Section</h2>
          <p className="text-xs opacity-80 mt-1 max-w-2xl">
            Workforce build-up under eMind and the live fleet &amp; resources status, straight from the source sheets.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            <Kpi label="Resources Required" value={workforce.required ?? "-"} sub="Total demand" />
            <Kpi label="Resources Planned" value={workforce.planned ?? "-"} sub={`In-house ${workforce.inHouse ?? "-"} | Outsourced ${workforce.outsourced ?? "-"}`} />
            <Kpi label="Open Gap" value={workforce.gap ?? "-"} sub="To be closed" />
            <Kpi label="Onboarded" value={pick(emind, "Onboarded") ?? 0} sub={`Selected ${pick(emind, "Selected") ?? 0} of ${pick(emind, "Requested") ?? 0} requested`} />
          </div>
        </div>
      </div>

      {noData && (
        <div className="rounded-lg border border-border bg-white p-6 text-center text-xs text-muted-foreground">
          No data returned from the eMind and Fleet sheets yet. Use Refresh to reload.
        </div>
      )}

      {/* Workforce breakdown */}
      {emind.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Planned Workforce Breakdown" note="Replacement of existing resources vs new demand">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Replacement", value: workforce.replacement ?? 0 },
                      { name: "New / Additional", value: workforce.additional ?? 0 },
                    ]}
                    dataKey="value" nameKey="name" outerRadius={80} label={{ fontSize: 11 }}
                  >
                    <Cell fill="#dc2626" />
                    <Cell fill="#7f1d1d" />
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Phase Plan" note="P0 and P1 split of the total requirement">
              {phase.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={phase}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="p0" name="P0" fill="#dc2626"><LabelList dataKey="p0" position="top" fontSize={10} /></Bar>
                    <Bar dataKey="p1" name="P1" fill="#7f1d1d"><LabelList dataKey="p1" position="top" fontSize={10} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Hiring Funnel" note="Where the 113 requested profiles currently stand">
              {hiring.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={hiring} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#dc2626">
                      <LabelList dataKey="value" position="right" fontSize={11} />
                      {hiring.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card title="Hiring Status by Project" note="Etihad WE vs TAQA">
              {byProject.length === 0 ? <Empty /> : (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Stage</th>
                        <th className="text-right px-3 py-2">EWE</th>
                        <th className="text-right px-3 py-2">TAQA</th>
                        <th className="text-right px-3 py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byProject.map((r, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 font-medium text-[#111]">{r.name}</td>
                          <td className="px-3 py-2 text-right">{r.ewe}</td>
                          <td className="px-3 py-2 text-right">{r.taqa}</td>
                          <td className="px-3 py-2 text-right font-semibold">{r.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {cear.length > 0 && (
            <div className="rounded-lg border border-border bg-white">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-[#111]">CEAR / Approval Position</div>
                <div className="text-[11px] text-muted-foreground">Clearance and CEAR coverage per project as recorded in the sheet</div>
              </div>
              <div className="divide-y divide-border">
                {cear.map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="text-xs font-medium text-[#111]">{c.name}</div>
                    <div className="text-xs text-muted-foreground text-right">{c.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Fleet & resources status */}
      {fleetRows.length > 0 && (
        <>
          <div className="rounded-lg border border-border bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-semibold text-[#111] mr-2">Fleet &amp; Resources Status</div>
              <select value={dept} onChange={(e) => setDept(e.target.value)}
                className="h-8 px-2 text-xs border border-input rounded-md bg-white">
                <option value="">All departments</option>
                {depts.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="inline-flex border border-border rounded-md overflow-hidden">
                {([{ k: "", l: "All" }, { k: "yes", l: "With car" }, { k: "no", l: "Without car" }] as const).map((t) => (
                  <button key={t.k} onClick={() => setCarOnly(t.k)}
                    className={`px-3 h-8 text-[11px] font-semibold border-r border-border last:border-r-0 ${carOnly === t.k ? "bg-[#dc2626] text-white" : "text-[#111] hover:bg-secondary"}`}>
                    {t.l}
                  </button>
                ))}
              </div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search employee, plate, vendor…"
                className="h-8 px-3 text-xs border border-input rounded-md bg-white w-56" />
              <div className="ml-auto text-[11px] text-muted-foreground">{filteredFleet.length} of {fleetRows.length} resources</div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total Resources" value={filteredFleet.length} />
            <Stat label="Without Vehicle" value={withoutCar} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Resources by Department" note="Headcount split across programs">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byDept}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626">
                    <LabelList dataKey="value" position="top" fontSize={11} />
                    {byDept.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Resources by Vendor" note="Manpower supply concentration">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byResourceVendor} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626">
                    <LabelList dataKey="value" position="right" fontSize={11} />
                    {byResourceVendor.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Fleet by Car Vendor" note="Where the vehicles are leased from">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCarVendor} dataKey="value" nameKey="name" outerRadius={85} label={{ fontSize: 10 }}>
                    {byCarVendor.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Fleet by Vehicle Model" note="Standardisation view">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byModel} layout="vertical" margin={{ left: 20, right: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626">
                    <LabelList dataKey="value" position="right" fontSize={11} />
                    {byModel.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Roles Mix" note="Field capability distribution">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byRole}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#dc2626">
                  <LabelList dataKey="value" position="top" fontSize={11} />
                  {byRole.map((_, i) => <Cell key={i} fill={RED[i % RED.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Stat label="Vehicles Missing Plate No." value={missingPlate} tone="red" sub="Data quality" />
            <Stat label="Resources Missing Staff ID" value={missingId} sub="Data quality" />
            <Stat label="Resources Missing Email" value={missingEmail} sub="Data quality" />
          </div>

          <div className="rounded-lg border border-border bg-white">
            <div className="px-4 py-3 border-b border-border">
              <div className="text-xs font-semibold text-[#111]">Resource &amp; Fleet Register</div>
              <div className="text-[11px] text-muted-foreground">Every resource with assigned vehicle, plate and vendor</div>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50 sticky top-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Employee</th>
                    <th className="text-left px-3 py-2">ID</th>
                    <th className="text-left px-3 py-2">Department</th>
                    <th className="text-left px-3 py-2">Role</th>
                    <th className="text-left px-3 py-2">Car</th>
                    <th className="text-left px-3 py-2">Vehicle</th>
                    <th className="text-left px-3 py-2">Year</th>
                    <th className="text-left px-3 py-2">Plate No.</th>
                    <th className="text-left px-3 py-2">Resource Vendor</th>
                    <th className="text-left px-3 py-2">Car Vendor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFleet.map((r, i) => {
                    const hasCar = /^yes$/i.test(r.Car || "");
                    return (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-[#111]">{r.Employee || "-"}</td>
                        <td className="px-3 py-2">{r.ID || "-"}</td>
                        <td className="px-3 py-2">{r.Department || "-"}</td>
                        <td className="px-3 py-2">{r.Role || "-"}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${hasCar ? "bg-green-100 text-green-700 border border-green-200" : "bg-secondary text-muted-foreground"}`}>
                            {hasCar ? "Assigned" : "None"}
                          </span>
                        </td>
                        <td className="px-3 py-2">{r["Vehicle Model"] || "-"}</td>
                        <td className="px-3 py-2">{r.Year || "-"}</td>
                        <td className="px-3 py-2">{r["Plate No."] || "-"}</td>
                        <td className="px-3 py-2">{r["Resource Vendor"] || "-"}</td>
                        <td className="px-3 py-2">{r["Car Vendor"] || "-"}</td>
                      </tr>
                    );
                  })}
                  {filteredFleet.length === 0 && (
                    <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">No resources match your filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/15">
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: "red" }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${tone === "red" ? "text-[#dc2626]" : "text-[#111]"}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="text-xs font-semibold text-[#111]">{title}</div>
      {note && <div className="text-[11px] text-muted-foreground mb-2">{note}</div>}
      {children}
    </div>
  );
}

function Empty() {
  return <div className="text-[11px] text-muted-foreground py-8 text-center">No values recorded in the sheet yet.</div>;
}
