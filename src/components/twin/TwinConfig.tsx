import { COST_CATEGORIES, DELIVERY_MODELS, PROJECT_CATEGORIES, SOURCES, fmtM, fmtN, type CostCategory, type CostItem, type Frequency, type Owner, type SourceTag, type Twin, type TwinResult } from "@/lib/twin";
import { INPUT, LABEL, Num, Panel, SourceBadge, Table, Tag, Td, Th, Txt } from "./ui";

type Set = (mut: (d: Twin) => void) => void;

export function TwinConfig({ t, set, r }: { t: Twin; set: Set; r: TwinResult }) {
  const unit = t.project.unit.replace(/s$/, "");

  function updateItem(id: string, patch: Partial<CostItem>) {
    set((d) => { const it = d.items.find((x) => x.id === id); if (it) Object.assign(it, patch); });
  }
  function addItem() {
    set((d) => d.items.push({
      id: Math.random().toString(36).slice(2), category: "Material", name: "New cost line", unit: "unit",
      rate: 0, qty: 1, freq: "per_unit", owner: "e&", source: "User Input", confidence: "Low",
    }));
  }

  const itemValue = (i: CostItem) =>
    i.freq === "per_unit" ? i.rate * i.qty * r.qtyEand : i.freq === "monthly" ? i.rate * i.qty * t.project.durationMonths : i.rate * i.qty;

  const boq = [
    { name: `Smart ${unit}s to install`, qty: t.project.quantity, unit: t.project.unit },
    { name: "e&-delivered scope", qty: r.qtyEand, unit: t.project.unit },
    { name: "Partner-delivered scope", qty: r.qtyPartner, unit: t.project.unit },
    { name: "Installation kits", qty: Math.ceil(r.qtyEand * 1.02), unit: "kits" },
    { name: "Cable & connector sets", qty: Math.ceil(r.qtyEand * 1.03), unit: "sets" },
    { name: "Consumables", qty: Math.ceil(r.qtyEand * 1.05), unit: "units" },
    { name: "Rectification allowance", qty: Math.ceil(r.qtyEand * t.productivity.rectificationRate), unit: t.project.unit },
    { name: "Technician PPE sets", qty: r.headcount.techs, unit: "sets" },
    { name: "Field tablets", qty: r.headcount.techs + r.headcount.sup, unit: "devices" },
    { name: "Testing tools", qty: Math.ceil(r.headcount.techs / 5), unit: "devices" },
    { name: "Vehicles", qty: r.fleetCount, unit: "vehicles" },
    { name: "Warehouse space", qty: Math.ceil(r.qtyEand / 2500) * 50, unit: "m²" },
  ];

  const optimiser = (mode: "min" | "rec" | "acc") => {
    const factor = mode === "min" ? 1.15 : mode === "rec" ? 1 : 0.75;
    const months = t.project.durationMonths * factor;
    const eff = t.productivity.perTechPerDay * t.productivity.utilization / t.productivity.travelFactor;
    const techs = Math.ceil((r.qtyEand * (1 + t.productivity.rectificationRate)) / Math.max(1, eff * t.productivity.workingDays * months));
    return { months, techs, fleet: Math.ceil(techs / t.fleet.techPerVehicle), people: techs + Math.ceil(techs / t.workforce.supRatio) + Math.ceil(techs / t.workforce.engRatio) + Math.ceil(techs / t.workforce.coordRatio) + Math.ceil(techs / t.workforce.qaRatio) + t.workforce.hseCount };
  };

  return (
    <div className="space-y-4">
      <Panel title="Project configuration" subtitle="The scope and contract definition behind the twin">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Txt label="Client" value={t.project.client} onChange={(v) => set((d) => { d.project.client = v; })} />
          <Txt label="Project name" value={t.project.projectName} onChange={(v) => set((d) => { d.project.projectName = v; })} />
          <Txt label="Project category" value={t.project.category} onChange={(v) => set((d) => { d.project.category = v; })} options={PROJECT_CATEGORIES} />
          <Txt label="Geography" value={t.project.geography} onChange={(v) => set((d) => { d.project.geography = v; })} />
          <Txt label="Region" value={t.project.region} onChange={(v) => set((d) => { d.project.region = v; })} />
          <label className="block">
            <span className={LABEL}>Start date</span>
            <input type="date" value={t.project.startDate} onChange={(e) => set((d) => { d.project.startDate = e.target.value; })} className={`${INPUT} mt-1`} />
          </label>
          <Num label="Contract duration (months)" value={t.project.durationMonths} onChange={(v) => set((d) => { d.project.durationMonths = Math.max(1, v); })} />
          <Num label="Quantity" value={t.project.quantity} step={500} onChange={(v) => set((d) => { d.project.quantity = v; })} />
          <Txt label="Unit" value={t.project.unit} onChange={(v) => set((d) => { d.project.unit = v; })} />
          <Txt label="Contract type" value={t.project.contractType} onChange={(v) => set((d) => { d.project.contractType = v; })} options={["Unit Rate", "Lump Sum", "Framework", "Time & Material", "Managed Service"]} />
          <Txt label="Currency" value={t.project.currency} onChange={(v) => set((d) => { d.project.currency = v; })} options={["AED", "USD", "SAR", "EUR"]} />
          <Num label="Contract value" value={t.project.contractValue} step={100000} prefix="AED" onChange={(v) => set((d) => { d.project.contractValue = v; })} />
          <Txt label="Revenue model" value={t.project.revenueModel} onChange={(v) => set((d) => { d.project.revenueModel = v; })} options={["Per installed meter", "Milestone based", "Monthly service fee", "Hybrid unit + service"]} />
          <Txt label="Project complexity" value={t.project.complexity} onChange={(v) => set((d) => { d.project.complexity = v as Twin["project"]["complexity"]; })} options={["Low", "Medium", "High"]} />
          <Num label="SLA target %" value={t.project.slaTargetPct} onChange={(v) => set((d) => { d.project.slaTargetPct = v; })} />
          <Num label={`Penalty per ${unit}`} value={t.project.penaltyPerUnit} prefix="AED" onChange={(v) => set((d) => { d.project.penaltyPerUnit = v; })} />
        </div>
      </Panel>

      <Panel title="Delivery model" subtitle="Changing the model recalculates the entire digital twin">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {DELIVERY_MODELS.map((m) => {
            const active = t.project.delivery === m.key;
            return (
              <button key={m.key}
                onClick={() => set((d) => { d.project.delivery = m.key; d.partner.share = m.partnerShare; })}
                className={`text-left rounded-lg border px-3 py-3 transition ${active ? "border-[#dc2626] bg-[#dc2626]/10" : "border-[#2b2b31] bg-[#0f0f11] hover:border-[#3d3d45]"}`}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#f87171]">{m.code}</p>
                <p className="font-heading text-[14px] font-semibold text-white mt-0.5">{m.name}</p>
                <p className="text-[11px] text-white/55 mt-1 leading-relaxed">{m.desc}</p>
                <p className="text-[10px] text-white/40 mt-1.5">Default partner scope {(m.partnerShare * 100).toFixed(0)}%</p>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Resource optimizer" subtitle="How many resources the scope actually requires">
          <div className="grid grid-cols-2 gap-3">
            <Num label={`Productivity (${t.project.unit}/tech/day)`} value={t.productivity.perTechPerDay} step={0.1} onChange={(v) => set((d) => { d.productivity.perTechPerDay = v; })} />
            <Num label="Working days / month" value={t.productivity.workingDays} onChange={(v) => set((d) => { d.productivity.workingDays = v; })} />
            <Num label="Utilization" value={t.productivity.utilization} step={0.01} onChange={(v) => set((d) => { d.productivity.utilization = v; })} hint="0–1 of paid time on tools" />
            <Num label="Travel factor" value={t.productivity.travelFactor} step={0.01} onChange={(v) => set((d) => { d.productivity.travelFactor = v; })} hint="1.15 = 15% travel overhead" />
            <Num label="Rectification / rework rate" value={t.productivity.rectificationRate} step={0.01} onChange={(v) => set((d) => { d.productivity.rectificationRate = v; })} />
            <Num label="Technicians per vehicle" value={t.fleet.techPerVehicle} onChange={(v) => set((d) => { d.fleet.techPerVehicle = Math.max(1, v); })} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {([["min", "Minimum"], ["rec", "Recommended"], ["acc", "Accelerated"]] as const).map(([k, label]) => {
              const o = optimiser(k);
              return (
                <div key={k} className="rounded-lg border border-[#2b2b31] bg-[#0f0f11] p-2.5">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">{label}</p>
                  <p className="font-heading text-[15px] font-semibold text-white mt-1">{o.techs} techs</p>
                  <p className="text-[10px] text-white/50">{o.people} people · {o.fleet} vehicles</p>
                  <p className="text-[10px] text-white/40">{o.months.toFixed(1)} months</p>
                </div>
              );
            })}
          </div>
          <Table>
            <thead><tr className="border-b border-[#26262b]"><Th>Role</Th><Th right>Count</Th><Th>Basis</Th></tr></thead>
            <tbody>
              {[
                ["Technicians", r.headcount.techs, `${fmtN(r.qtyEand)} ${t.project.unit} incl. rework ÷ capacity`],
                ["Supervisors", r.headcount.sup, `1 per ${t.workforce.supRatio} technicians`],
                ["Engineers", r.headcount.eng, `1 per ${t.workforce.engRatio} technicians`],
                ["Coordinators", r.headcount.coord, `1 per ${t.workforce.coordRatio} technicians`],
                ["QA / QC", r.headcount.qa, `1 per ${t.workforce.qaRatio} technicians`],
                ["HSE", r.headcount.hse, "Fixed allocation"],
                ["Vehicles", r.fleetCount, `${t.fleet.techPerVehicle} technicians per vehicle + supervisor fleet`],
              ].map((row) => (
                <tr key={row[0] as string} className="border-b border-[#1e1e22]">
                  <Td>{row[0] as string}</Td><Td right>{row[1] as number}</Td><Td><span className="text-white/45">{row[2] as string}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <div className="space-y-4">
          <Panel title="Workforce & fleet rates" subtitle="Monthly cost per head and per vehicle">
            <div className="grid grid-cols-2 gap-3">
              <Num label="Technician / month" value={t.workforce.techCost} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.techCost = v; })} />
              <Num label="Supervisor / month" value={t.workforce.supCost} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.supCost = v; })} />
              <Num label="Engineer / month" value={t.workforce.engCost} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.engCost = v; })} />
              <Num label="Coordinator / month" value={t.workforce.coordCost} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.coordCost = v; })} />
              <Num label="QA/QC / month" value={t.workforce.qaCost} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.qaCost = v; })} />
              <Num label="HSE / month" value={t.workforce.hseCost} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.hseCost = v; })} />
              <Num label="Visa, recruitment & training / head" value={t.workforce.mobPerHead} prefix="AED" step={100} onChange={(v) => set((d) => { d.workforce.mobPerHead = v; })} />
              <Num label="Vehicle lease / month" value={t.fleet.lease} prefix="AED" step={50} onChange={(v) => set((d) => { d.fleet.lease = v; })} />
              <Num label="Maintenance / month" value={t.fleet.maintenance} prefix="AED" step={25} onChange={(v) => set((d) => { d.fleet.maintenance = v; })} />
              <Num label="Insurance / month" value={t.fleet.insurance} prefix="AED" step={25} onChange={(v) => set((d) => { d.fleet.insurance = v; })} />
              <Num label="Km per vehicle / day" value={t.fleet.kmPerDay} onChange={(v) => set((d) => { d.fleet.kmPerDay = v; })} />
              <Num label="Fleet efficiency (km/L)" value={t.fleet.kmPerLitre} step={0.5} onChange={(v) => set((d) => { d.fleet.kmPerLitre = v; })} />
              <Num label="Fuel price (AED/L)" value={t.fleet.fuelPerLitre} step={0.01} onChange={(v) => set((d) => { d.fleet.fuelPerLitre = v; })} />
            </div>
            <p className="text-[10px] text-white/35 mt-3">
              Labour {fmtM(r.labour)} · fleet {fmtM(r.fleetCost)} for {t.project.durationMonths} months.
            </p>
          </Panel>

          <Panel title="BOQ digital twin" subtitle="Quantities recalculate with scope; override any cost line below">
            <Table>
              <thead><tr className="border-b border-[#26262b]"><Th>Item</Th><Th right>Quantity</Th><Th>Unit</Th></tr></thead>
              <tbody>
                {boq.map((b) => (
                  <tr key={b.name} className="border-b border-[#1e1e22]">
                    <Td>{b.name}</Td><Td right>{fmtN(b.qty)}</Td><Td><span className="text-white/45">{b.unit}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>
      </div>

      <Panel
        title="Cost library"
        subtitle="Every rate is editable and carries its source and confidence"
        right={<button onClick={addItem} className="h-8 px-3 rounded-md border border-[#3a3a42] text-[11px] text-white/80 hover:border-[#dc2626]">+ Add cost line</button>}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {COST_CATEGORIES.map((c) => (
            <Tag key={c}>{c} · {fmtM(r.itemCost[c as CostCategory])}</Tag>
          ))}
        </div>
        <Table>
          <thead>
            <tr className="border-b border-[#26262b]">
              <Th>Category</Th><Th>Cost item</Th><Th>Unit</Th><Th right>Rate</Th><Th right>Qty</Th>
              <Th>Frequency</Th><Th>Owner</Th><Th>Source</Th><Th right>Value</Th><Th />
            </tr>
          </thead>
          <tbody>
            {t.items.map((i) => (
              <tr key={i.id} className="border-b border-[#1e1e22]">
                <Td>
                  <select value={i.category} onChange={(e) => updateItem(i.id, { category: e.target.value as CostCategory })} className={`${INPUT} h-7 w-[110px]`}>
                    {COST_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Td>
                <Td><input value={i.name} onChange={(e) => updateItem(i.id, { name: e.target.value })} className={`${INPUT} h-7 w-[190px]`} /></Td>
                <Td><input value={i.unit} onChange={(e) => updateItem(i.id, { unit: e.target.value })} className={`${INPUT} h-7 w-[70px]`} /></Td>
                <Td right><input type="number" value={i.rate} onChange={(e) => updateItem(i.id, { rate: parseFloat(e.target.value) || 0 })} className={`${INPUT} h-7 w-[86px] text-right`} /></Td>
                <Td right><input type="number" value={i.qty} onChange={(e) => updateItem(i.id, { qty: parseFloat(e.target.value) || 0 })} className={`${INPUT} h-7 w-[64px] text-right`} /></Td>
                <Td>
                  <select value={i.freq} onChange={(e) => updateItem(i.id, { freq: e.target.value as Frequency })} className={`${INPUT} h-7 w-[96px]`}>
                    <option value="per_unit">Per unit</option><option value="monthly">Monthly</option><option value="one_off">One-off</option>
                  </select>
                </Td>
                <Td>
                  <select value={i.owner} onChange={(e) => updateItem(i.id, { owner: e.target.value as Owner })} className={`${INPUT} h-7 w-[110px]`}>
                    <option value="e&">e&</option><option value="Reseller">Reseller</option><option value="Subcontractor">Subcontractor</option>
                  </select>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    <select value={i.source} onChange={(e) => updateItem(i.id, { source: e.target.value as SourceTag })} className={`${INPUT} h-7 w-[150px]`}>
                      {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <SourceBadge source={i.source} confidence={i.confidence} />
                  </div>
                </Td>
                <Td right>{fmtM(itemValue(i))}</Td>
                <Td right>
                  <button onClick={() => set((d) => { d.items = d.items.filter((x) => x.id !== i.id); })} className="text-[11px] text-white/35 hover:text-[#f87171]">Remove</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="text-[10px] text-white/35 mt-3">
          Per-unit lines apply to the {fmtN(r.qtyEand)} {t.project.unit} delivered by e&. Monthly lines apply for {t.project.durationMonths} months.
          Rates shown are simulation data, not approved commercial rates.
        </p>
      </Panel>
    </div>
  );
}
