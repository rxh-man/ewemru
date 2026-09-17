// Project Digital Twin — simulation engine.
// All rates below are SIMULATION DATA, not actual TAQA / e& commercial rates.

export type DeliveryModel =
  | "direct"
  | "subcontractor"
  | "reseller"
  | "hybrid"
  | "managed"
  | "custom";

export const DELIVERY_MODELS: { key: DeliveryModel; code: string; name: string; desc: string; partnerShare: number }[] = [
  { key: "direct", code: "MODEL A", name: "Direct e& Delivery", desc: "e& owns workforce, fleet, tools, project management and execution.", partnerShare: 0 },
  { key: "subcontractor", code: "MODEL B", name: "Subcontractor", desc: "External company performs defined activities under e& supervision.", partnerShare: 0.4 },
  { key: "reseller", code: "MODEL C", name: "Reseller / Partner", desc: "A reseller or implementation partner carries delivery responsibility.", partnerShare: 1 },
  { key: "hybrid", code: "MODEL D", name: "Hybrid", desc: "e& + reseller + subcontractors sharing the scope.", partnerShare: 0.7 },
  { key: "managed", code: "MODEL E", name: "Managed Service", desc: "Partner operates delivery under e& governance and reporting.", partnerShare: 0.9 },
  { key: "custom", code: "MODEL F", name: "Custom", desc: "User defines the commercial and operational structure.", partnerShare: 0.5 },
];

export const PROJECT_CATEGORIES = [
  "AMI", "Smart Metering", "IoT", "Smart City", "Field Operations",
  "Network Deployment", "Infrastructure", "Technology", "Maintenance", "Custom",
] as const;

export type SourceTag = "Approved Rate Card" | "Historical Project Data" | "User Input" | "AI Forecast" | "Estimated";
export const SOURCES: SourceTag[] = ["Approved Rate Card", "Historical Project Data", "User Input", "AI Forecast", "Estimated"];
export type Confidence = "High" | "Medium" | "Low";

export const COST_CATEGORIES = [
  "Labour", "Fleet", "Material", "Equipment", "Technology", "Operations", "Management", "Partner",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export type Frequency = "per_unit" | "monthly" | "one_off";
export type Owner = "e&" | "Reseller" | "Subcontractor";

export interface CostItem {
  id: string;
  category: CostCategory;
  name: string;
  unit: string;
  rate: number;
  qty: number;
  freq: Frequency;
  owner: Owner;
  source: SourceTag;
  confidence: Confidence;
}

export interface Activity { name: string; owner: Owner }

export interface Twin {
  id: string;
  name: string;
  version: string;
  scenario: string;
  updatedAt: string;
  phase: string;
  project: {
    client: string;
    projectName: string;
    category: string;
    geography: string;
    region: string;
    startDate: string;
    durationMonths: number;
    quantity: number;
    unit: string;
    contractType: string;
    currency: string;
    contractValue: number;
    revenueModel: string;
    delivery: DeliveryModel;
    complexity: "Low" | "Medium" | "High";
    slaTargetPct: number;
    penaltyPerUnit: number;
  };
  pricing: {
    perUnit: number;
    install: number;
    activation: number;
    survey: number;
    commissioning: number;
    rectification: number;
    monthlyService: number;
    slaBonus: number;
  };
  partner: {
    share: number; // 0..1 of scope delivered by partner
    mode: "per_unit" | "fixed" | "percent_revenue";
    perUnit: number;
    fixedFee: number;
    percentRevenue: number;
    mgmtFeePct: number;
    govFeePct: number;
    techFeePct: number;
    contingencyPct: number;
    overheadPct: number;
  };
  productivity: {
    perTechPerDay: number;
    workingDays: number;
    utilization: number;
    travelFactor: number;
    rectificationRate: number;
  };
  workforce: {
    techCost: number;
    supRatio: number; supCost: number;
    engRatio: number; engCost: number;
    coordRatio: number; coordCost: number;
    qaRatio: number; qaCost: number;
    hseCount: number; hseCost: number;
    mobPerHead: number;
  };
  fleet: {
    techPerVehicle: number;
    lease: number;
    maintenance: number;
    insurance: number;
    kmPerDay: number;
    kmPerLitre: number;
    fuelPerLitre: number;
  };
  cash: { clientDays: number; partnerDays: number; advancePct: number };
  targets: {
    marginPct: number;
    maxWorkforce: number;
    maxFleet: number;
    maxPartnerRate: number;
    scheduleMonths: number;
    maxCost: number;
    riskAppetite: number; // % of revenue
  };
  items: CostItem[];
  activities: Activity[];
}

const ci = (
  id: string, category: CostCategory, name: string, unit: string, rate: number, qty: number,
  freq: Frequency, source: SourceTag, confidence: Confidence, owner: Owner = "e&",
): CostItem => ({ id, category, name, unit, rate, qty, freq, owner, source, confidence });

export function demoTwin(): Twin {
  return {
    id: "twin-taqa-ami-30k",
    name: "TAQA AMI 30K",
    version: "V2.4",
    scenario: "Hybrid Delivery",
    updatedAt: new Date().toISOString(),
    phase: "Bid / Business Case",
    project: {
      client: "TAQA",
      projectName: "AMI Smart Meter Deployment",
      category: "AMI",
      geography: "United Arab Emirates",
      region: "Abu Dhabi / Al Ain",
      startDate: new Date().toISOString().slice(0, 10),
      durationMonths: 6,
      quantity: 30000,
      unit: "meters",
      contractType: "Unit Rate",
      currency: "AED",
      contractValue: 15_000_000,
      revenueModel: "Per installed meter",
      delivery: "hybrid",
      complexity: "High",
      slaTargetPct: 95,
      penaltyPerUnit: 12,
    },
    pricing: {
      perUnit: 380, install: 70, activation: 25, survey: 15, commissioning: 10,
      rectification: 45, monthlyService: 0, slaBonus: 0,
    },
    partner: {
      share: 0.7, mode: "per_unit", perUnit: 350, fixedFee: 0, percentRevenue: 70,
      mgmtFeePct: 2, govFeePct: 1.5, techFeePct: 1, contingencyPct: 4, overheadPct: 6,
    },
    productivity: { perTechPerDay: 8, workingDays: 24, utilization: 0.85, travelFactor: 1.15, rectificationRate: 0.05 },
    workforce: {
      techCost: 8500, supRatio: 8, supCost: 14000, engRatio: 20, engCost: 18000,
      coordRatio: 25, coordCost: 11000, qaRatio: 30, qaCost: 13000, hseCount: 2, hseCost: 12500,
      mobPerHead: 4200,
    },
    fleet: { techPerVehicle: 3, lease: 2600, maintenance: 350, insurance: 260, kmPerDay: 110, kmPerLitre: 11, fuelPerLitre: 3.49 },
    cash: { clientDays: 60, partnerDays: 45, advancePct: 10 },
    targets: {
      marginPct: 15, maxWorkforce: 120, maxFleet: 45, maxPartnerRate: 400,
      scheduleMonths: 6, maxCost: 13_000_000, riskAppetite: 5,
    },
    items: [
      ci("m1", "Material", "Smart meter unit (client supplied)", "meter", 0, 1, "per_unit", "Approved Rate Card", "High"),
      ci("m2", "Material", "Installation kit / seals", "kit", 18, 1, "per_unit", "Historical Project Data", "High"),
      ci("m3", "Material", "Cable & connectors", "set", 9.5, 1, "per_unit", "Historical Project Data", "Medium"),
      ci("m4", "Material", "Consumables", "unit", 4, 1, "per_unit", "Estimated", "Low"),
      ci("m5", "Material", "PPE per technician", "set", 900, 1, "one_off", "Approved Rate Card", "High"),
      ci("e1", "Equipment", "Field tablet", "device", 2400, 40, "one_off", "Approved Rate Card", "High"),
      ci("e2", "Equipment", "Testing / DLMS tool", "device", 6800, 8, "one_off", "User Input", "Medium"),
      ci("e3", "Equipment", "Barcode scanner", "device", 950, 40, "one_off", "Approved Rate Card", "High"),
      ci("t1", "Technology", "HES / platform licence", "month", 42000, 1, "monthly", "User Input", "Medium"),
      ci("t2", "Technology", "Cloud & connectivity", "month", 15500, 1, "monthly", "Estimated", "Medium"),
      ci("t3", "Technology", "AI / analytics engine", "month", 9000, 1, "monthly", "Estimated", "Low"),
      ci("o1", "Operations", "Warehouse & storage", "month", 28000, 1, "monthly", "Historical Project Data", "Medium"),
      ci("o2", "Operations", "Site office", "month", 12000, 1, "monthly", "Historical Project Data", "Medium"),
      ci("o3", "Operations", "Logistics & transportation", "month", 18000, 1, "monthly", "Estimated", "Low"),
      ci("g1", "Management", "Project management office", "month", 46000, 1, "monthly", "Approved Rate Card", "High"),
      ci("g2", "Management", "QA/QC & governance", "month", 26000, 1, "monthly", "Historical Project Data", "Medium"),
      ci("g3", "Management", "HSE & reporting", "month", 14000, 1, "monthly", "Estimated", "Medium"),
      ci("p1", "Partner", "Specialist vendor (civil works)", "month", 22000, 1, "monthly", "User Input", "Low", "Subcontractor"),
    ],
    activities: [
      { name: "Survey", owner: "Reseller" },
      { name: "Installation", owner: "Reseller" },
      { name: "Testing & commissioning", owner: "Reseller" },
      { name: "QA / QC", owner: "e&" },
      { name: "Rectification", owner: "Subcontractor" },
      { name: "Fleet", owner: "Reseller" },
      { name: "Customer coordination", owner: "e&" },
      { name: "Project governance", owner: "e&" },
      { name: "Reporting", owner: "e&" },
      { name: "Warehouse & materials", owner: "e&" },
    ],
  };
}

/* ---------------------------------- results --------------------------------- */

export interface MonthCash { month: number; label: string; revenue: number; cost: number; net: number; cumulative: number }
export interface RiskRow { name: string; probability: number; impact: number; exposure: number; mitigation: string; owner: string; status: string; severity: "High" | "Medium" | "Low" }
export interface FeasibilityRow { name: string; pass: boolean; detail: string }

export interface TwinResult {
  qty: number; qtyPartner: number; qtyEand: number;
  unitRevenue: number;
  revenue: number;
  partnerCost: number;
  labour: number;
  fleetCost: number;
  itemCost: Record<CostCategory, number>;
  fees: number;
  contingency: number;
  overhead: number;
  directCost: number;
  totalCost: number;
  grossProfit: number;
  marginPct: number;
  costPerUnit: number;
  revenuePerUnit: number;
  headcount: { techs: number; sup: number; eng: number; coord: number; qa: number; hse: number };
  workforce: number;
  fleetCount: number;
  requiredMonths: number;
  completion: string;
  cash: MonthCash[];
  peakCash: number;
  monthlyBurn: number;
  risks: RiskRow[];
  feasibility: FeasibilityRow[];
  dataQuality: number;
  status: { level: "green" | "amber" | "red"; label: string; why: string[] };
  partnerEconomics: { partnerRevenue: number; partnerCost: number; partnerMargin: number; eandContribution: number };
}

const ceil = (n: number) => (n > 0 ? Math.ceil(n) : 0);

export function compute(t: Twin): TwinResult {
  const p = t.project;
  const qty = Math.max(0, p.quantity);
  const share = t.partner.share;
  const qtyPartner = Math.round(qty * share);
  const qtyEand = qty - qtyPartner;
  const months = Math.max(1, p.durationMonths);

  const pr = t.pricing;
  const unitRevenue = pr.perUnit + pr.install + pr.activation + pr.survey + pr.commissioning;
  const revenue =
    qty * unitRevenue +
    qty * t.productivity.rectificationRate * pr.rectification +
    qty * pr.monthlyService * months +
    pr.slaBonus;

  // partner cost
  let partnerCost = 0;
  if (t.partner.mode === "per_unit") partnerCost = qtyPartner * t.partner.perUnit;
  else if (t.partner.mode === "fixed") partnerCost = share > 0 ? t.partner.fixedFee : 0;
  else partnerCost = (revenue * t.partner.percentRevenue) / 100;

  // resources for the e&-delivered scope
  const pd = t.productivity;
  const effRate = Math.max(0.1, pd.perTechPerDay * pd.utilization / Math.max(0.5, pd.travelFactor));
  const workUnits = qtyEand * (1 + pd.rectificationRate);
  const capacityPerTech = effRate * pd.workingDays * months;
  const techs = ceil(workUnits / capacityPerTech);
  const w = t.workforce;
  const sup = ceil(techs / Math.max(1, w.supRatio));
  const eng = ceil(techs / Math.max(1, w.engRatio));
  const coord = ceil(techs / Math.max(1, w.coordRatio));
  const qa = ceil(techs / Math.max(1, w.qaRatio));
  const hse = techs > 0 ? w.hseCount : 0;
  const heads = techs + sup + eng + coord + qa + hse;
  const workforce = heads;

  const labour =
    months * (techs * w.techCost + sup * w.supCost + eng * w.engCost + coord * w.coordCost + qa * w.qaCost + hse * w.hseCost) +
    heads * w.mobPerHead;

  const f = t.fleet;
  const fleetCount = ceil(techs / Math.max(1, f.techPerVehicle)) + ceil(sup / 2);
  const fuel = (fleetCount * f.kmPerDay * pd.workingDays * months / Math.max(1, f.kmPerLitre)) * f.fuelPerLitre;
  const fleetCost = fleetCount * (f.lease + f.maintenance + f.insurance) * months + fuel;

  const itemCost = Object.fromEntries(COST_CATEGORIES.map((c) => [c, 0])) as Record<CostCategory, number>;
  for (const it of t.items) {
    const base = it.rate * it.qty;
    const v = it.freq === "per_unit" ? base * qtyEand : it.freq === "monthly" ? base * months : base;
    itemCost[it.category] += v;
  }
  const itemsTotal = Object.values(itemCost).reduce((a, b) => a + b, 0);

  const fees = (revenue * (t.partner.mgmtFeePct + t.partner.govFeePct + t.partner.techFeePct)) / 100;
  const directCost = partnerCost + labour + fleetCost + itemsTotal;
  const contingency = (directCost * t.partner.contingencyPct) / 100;
  const overhead = (directCost * t.partner.overheadPct) / 100;
  const totalCost = directCost + fees + contingency + overhead;
  const grossProfit = revenue - totalCost;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // required duration if workforce capped
  const capTechs = Math.max(1, Math.min(techs || 1, t.targets.maxWorkforce));
  const requiredMonths = qtyEand > 0 ? workUnits / (effRate * pd.workingDays * capTechs) : months;

  const start = new Date(p.startDate || new Date().toISOString().slice(0, 10));
  const completionDate = new Date(start);
  completionDate.setMonth(completionDate.getMonth() + Math.ceil(Math.max(months, requiredMonths)));

  // monthly cash flow
  const cash: MonthCash[] = [];
  const clientLag = Math.round(t.cash.clientDays / 30);
  const partnerLag = Math.round(t.cash.partnerDays / 30);
  const horizon = Math.ceil(months + Math.max(clientLag, partnerLag) + 1);
  const revPerMonth = revenue / months;
  const partnerPerMonth = partnerCost / months;
  const otherPerMonth = (labour + fleetCost + itemsTotal + fees + contingency + overhead) / months;
  const advance = (revenue * t.cash.advancePct) / 100;
  let cum = 0;
  for (let m = 1; m <= horizon; m++) {
    let rev = 0;
    if (m - clientLag >= 1 && m - clientLag <= months) rev += revPerMonth * (1 - t.cash.advancePct / 100);
    if (m === 1) rev += advance;
    let cost = 0;
    if (m <= months) cost += otherPerMonth;
    if (m - partnerLag >= 1 && m - partnerLag <= months) cost += partnerPerMonth;
    const net = rev - cost;
    cum += net;
    const d = new Date(start); d.setMonth(d.getMonth() + m - 1);
    cash.push({ month: m, label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), revenue: rev, cost, net, cumulative: cum });
  }
  const peakCash = Math.min(0, ...cash.map((c) => c.cumulative));
  const monthlyBurn = totalCost / months;

  // data quality
  const good = t.items.filter((i) => i.source === "Approved Rate Card" || i.source === "Historical Project Data").length;
  const dataQuality = Math.round(
    (0.6 * (good / Math.max(1, t.items.length)) +
      0.2 * (t.items.filter((i) => i.confidence !== "Low").length / Math.max(1, t.items.length)) +
      0.2) * 100,
  );

  // risks
  const risks: RiskRow[] = [];
  const addRisk = (name: string, probability: number, impact: number, mitigation: string, owner: string) => {
    const exposure = probability * impact;
    risks.push({
      name, probability, impact, exposure, mitigation, owner, status: "Open",
      severity: exposure > revenue * 0.03 ? "High" : exposure > revenue * 0.01 ? "Medium" : "Low",
    });
  };
  if (share >= 0.6) addRisk("High partner dependency", 0.45, revenue * 0.06, "Back-to-back SLA, performance bond, dual-partner strategy", "Commercial Manager");
  if (pd.rectificationRate > 0.06) addRisk("Elevated rectification volume", 0.5, qty * pd.rectificationRate * 120, "First-time-right training, QA sampling uplift", "QA/QC Lead");
  if (pd.perTechPerDay > 8) addRisk("Optimistic productivity assumption", 0.55, (labour + fleetCost) * 0.15, "Pilot-validated productivity, phased ramp-up", "Project Manager");
  if (marginPct < t.targets.marginPct) addRisk("Margin below target", 0.7, revenue * (t.targets.marginPct - marginPct) / 100, "Re-price partner rate or reduce scope of e& delivery", "Commercial Manager");
  if (requiredMonths > t.targets.scheduleMonths) addRisk("Aggressive completion date", 0.6, qty * p.penaltyPerUnit * 0.3, "Add capacity or renegotiate milestones", "Project Director");
  if (fleetCount > t.targets.maxFleet) addRisk("Insufficient fleet capacity", 0.5, fleetCost * 0.2, "Short-term lease, shift-based vehicle sharing", "Fleet Manager");
  if (Math.abs(peakCash) > revenue * 0.15) addRisk("Cash-flow pressure", 0.4, Math.abs(peakCash) * 0.1, "Mobilisation advance, align partner payment terms", "Finance");
  if (t.items.some((i) => i.confidence === "Low")) addRisk("Unvalidated cost assumptions", 0.5, directCost * 0.05, "Confirm rate cards before bid submission", "Cost Controller");

  // feasibility
  const feasibility: FeasibilityRow[] = [
    {
      name: "Commercial feasibility",
      pass: marginPct >= t.targets.marginPct,
      detail: `Forecast margin ${marginPct.toFixed(1)}% vs target ${t.targets.marginPct}% — gap ${(marginPct - t.targets.marginPct).toFixed(1)} pts`,
    },
    {
      name: "Operational feasibility",
      pass: workforce <= t.targets.maxWorkforce,
      detail: `Requires ${workforce} people (max ${t.targets.maxWorkforce}) — capacity gap ${workforce > t.targets.maxWorkforce ? "+" + (workforce - t.targets.maxWorkforce) : 0}`,
    },
    {
      name: "Schedule feasibility",
      pass: requiredMonths <= t.targets.scheduleMonths + 0.01,
      detail: `Constraint ${t.targets.scheduleMonths} months, calculated requirement ${requiredMonths.toFixed(1)} months at ${capTechs} technicians`,
    },
    {
      name: "Financial feasibility",
      pass: totalCost <= t.targets.maxCost,
      detail: `Forecast cost ${fmtM(totalCost)} vs ceiling ${fmtM(t.targets.maxCost)}; peak funding ${fmtM(Math.abs(peakCash))}`,
    },
    {
      name: "Partner feasibility",
      pass: share === 0 || (t.partner.mode !== "per_unit" ? true : t.partner.perUnit <= t.targets.maxPartnerRate),
      detail: share === 0
        ? "No partner scope in this model"
        : `Partner rate AED ${t.partner.perUnit}/unit vs affordable ceiling AED ${t.targets.maxPartnerRate}`,
    },
    {
      name: "Fleet feasibility",
      pass: fleetCount <= t.targets.maxFleet,
      detail: `Requires ${fleetCount} vehicles (max ${t.targets.maxFleet})`,
    },
    {
      name: "Risk feasibility",
      pass: risks.reduce((a, r) => a + r.exposure, 0) <= (revenue * t.targets.riskAppetite) / 100,
      detail: `Risk exposure ${fmtM(risks.reduce((a, r) => a + r.exposure, 0))} vs appetite ${t.targets.riskAppetite}% of revenue (${fmtM((revenue * t.targets.riskAppetite) / 100)})`,
    },
  ];

  const why: string[] = [];
  const fails = feasibility.filter((x) => !x.pass);
  const sens = sensitivity(t);
  if (marginPct < t.targets.marginPct) why.push(`Forecast margin ${marginPct.toFixed(1)}% is below the ${t.targets.marginPct}% target`);
  if (fails.length) why.push(`${fails.length} feasibility check${fails.length > 1 ? "s" : ""} not met: ${fails.map((x) => x.name).join(", ")}`);
  if (sens[0] && Math.abs(sens[0].marginSwing) > 4) why.push(`High sensitivity — a 10% move in ${sens[0].name} swings margin by ${Math.abs(sens[0].marginSwing).toFixed(1)} pts`);
  if (dataQuality < 70) why.push(`Data quality ${dataQuality}% — several rates are estimated rather than rate-carded`);
  if (!why.length) why.push("All feasibility checks pass, margin is at or above target and no single assumption dominates the outcome");

  const level: "green" | "amber" | "red" =
    marginPct < t.targets.marginPct * 0.6 || fails.length >= 3 ? "red" : fails.length > 0 || (sens[0] && Math.abs(sens[0].marginSwing) > 4) ? "amber" : "green";
  const status = {
    level,
    label: level === "green" ? "Simulation Ready" : level === "amber" ? "High Sensitivity" : "Commercial Risk",
    why,
  };

  const partnerRevenue = partnerCost;
  const partnerOwnCost = qtyPartner * (t.partner.perUnit * 0.78); // simulated partner internal cost
  return {
    qty, qtyPartner, qtyEand, unitRevenue, revenue, partnerCost, labour, fleetCost, itemCost,
    fees, contingency, overhead, directCost, totalCost, grossProfit, marginPct,
    costPerUnit: qty ? totalCost / qty : 0,
    revenuePerUnit: qty ? revenue / qty : 0,
    headcount: { techs, sup, eng, coord, qa, hse },
    workforce, fleetCount, requiredMonths,
    completion: completionDate.toISOString().slice(0, 10),
    cash, peakCash, monthlyBurn, risks, feasibility, dataQuality, status,
    partnerEconomics: {
      partnerRevenue,
      partnerCost: partnerOwnCost,
      partnerMargin: partnerRevenue ? ((partnerRevenue - partnerOwnCost) / partnerRevenue) * 100 : 0,
      eandContribution: revenue - partnerCost,
    },
  };
}

/* -------------------------------- sensitivity ------------------------------- */

export interface SensRow { name: string; costSwing: number; marginSwing: number; monthsSwing: number }

type Lever = { name: string; apply: (t: Twin, f: number) => void };

export const LEVERS: Lever[] = [
  { name: "Meter quantity", apply: (t, f) => { t.project.quantity = Math.round(t.project.quantity * f); } },
  { name: "Client price", apply: (t, f) => { t.pricing.perUnit *= f; } },
  { name: "Reseller rate", apply: (t, f) => { t.partner.perUnit *= f; } },
  { name: "Productivity", apply: (t, f) => { t.productivity.perTechPerDay *= f; } },
  { name: "Labour cost", apply: (t, f) => { t.workforce.techCost *= f; t.workforce.supCost *= f; } },
  { name: "Fleet cost", apply: (t, f) => { t.fleet.lease *= f; t.fleet.maintenance *= f; } },
  { name: "Fuel price", apply: (t, f) => { t.fleet.fuelPerLitre *= f; } },
  { name: "Rectification", apply: (t, f) => { t.productivity.rectificationRate *= f; } },
  { name: "Material cost", apply: (t, f) => { t.items.filter((i) => i.category === "Material").forEach((i) => (i.rate *= f)); } },
  { name: "Project duration", apply: (t, f) => { t.project.durationMonths = Math.max(1, t.project.durationMonths * f); } },
  { name: "Subcontractor scope", apply: (t, f) => { t.partner.share = Math.min(1, t.partner.share * f); } },
];

export function sensitivity(t: Twin, delta = 0.1): SensRow[] {
  const base = compute(t);
  const rows = LEVERS.map((l) => {
    const up = clone(t); l.apply(up, 1 + delta);
    const dn = clone(t); l.apply(dn, 1 - delta);
    const ru = compute(up), rd = compute(dn);
    return {
      name: l.name,
      costSwing: (ru.totalCost - rd.totalCost) / 2,
      marginSwing: (ru.marginPct - rd.marginPct) / 2,
      monthsSwing: (ru.requiredMonths - rd.requiredMonths) / 2,
    };
  });
  void base;
  return rows.sort((a, b) => Math.abs(b.marginSwing) - Math.abs(a.marginSwing));
}

/* ------------------------------- break-even -------------------------------- */

export function maxPartnerRate(t: Twin, targetMargin = t.targets.marginPct): number {
  let lo = 0, hi = Math.max(t.pricing.perUnit * 2, 1000);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const c = clone(t); c.partner.mode = "per_unit"; c.partner.perUnit = mid;
    if (compute(c).marginPct >= targetMargin) lo = mid; else hi = mid;
  }
  return lo;
}

export function minClientPrice(t: Twin, targetMargin = t.targets.marginPct): number {
  let lo = 0, hi = Math.max(t.pricing.perUnit * 4, 2000);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const c = clone(t); c.pricing.perUnit = mid;
    if (compute(c).marginPct >= targetMargin) hi = mid; else lo = mid;
  }
  return hi;
}

/* ----------------------------- historical data ----------------------------- */

export interface HistoricalProject {
  name: string; client: string; year: number; quantity: number; region: string; complexity: string;
  workforce: number; productivity: number; durationMonths: number; fleet: number;
  rectificationPct: number; cost: number; revenue: number; marginPct: number;
}

export const HISTORY: HistoricalProject[] = [
  { name: "EtihadWE AMI Phase 1", client: "EtihadWE", year: 2023, quantity: 22000, region: "Northern Emirates", complexity: "Medium", workforce: 58, productivity: 6.9, durationMonths: 7, fleet: 21, rectificationPct: 6.4, cost: 8_600_000, revenue: 10_450_000, marginPct: 17.7 },
  { name: "EtihadWE AMI Phase 2", client: "EtihadWE", year: 2024, quantity: 34000, region: "Northern Emirates", complexity: "High", workforce: 74, productivity: 7.4, durationMonths: 8, fleet: 27, rectificationPct: 5.8, cost: 12_900_000, revenue: 15_100_000, marginPct: 14.6 },
  { name: "TAQA AMI 2025", client: "TAQA", year: 2025, quantity: 26500, region: "Abu Dhabi", complexity: "High", workforce: 69, productivity: 6.7, durationMonths: 7, fleet: 25, rectificationPct: 7.1, cost: 11_200_000, revenue: 13_250_000, marginPct: 15.5 },
  { name: "Smart City Deployment", client: "Municipality", year: 2024, quantity: 12000, region: "Dubai", complexity: "Medium", workforce: 33, productivity: 8.1, durationMonths: 5, fleet: 12, rectificationPct: 4.2, cost: 4_150_000, revenue: 5_050_000, marginPct: 17.8 },
  { name: "IoT Field Deployment", client: "Enterprise", year: 2023, quantity: 8000, region: "Abu Dhabi", complexity: "Low", workforce: 19, productivity: 9.2, durationMonths: 4, fleet: 8, rectificationPct: 3.1, cost: 2_300_000, revenue: 2_950_000, marginPct: 22.0 },
  { name: "Water Meter Retrofit", client: "EtihadWE", year: 2022, quantity: 18500, region: "Northern Emirates", complexity: "Medium", workforce: 47, productivity: 7.1, durationMonths: 6, fleet: 18, rectificationPct: 6.9, cost: 6_400_000, revenue: 7_600_000, marginPct: 15.8 },
];

export const AI_MODELS = [
  "Statistical Forecast", "Time-Series Forecast", "Regression Model", "Gradient Boosting",
  "Random Forest", "Neural Network", "LLM Analysis", "Hybrid AI Model", "Custom Model",
] as const;
export type AiModel = (typeof AI_MODELS)[number];

export const MODEL_META: Record<string, { engine: string; training: string; lastTrained: string; coverage: string }> = {
  "Statistical Forecast": { engine: "Weighted historical mean", training: "6 delivered projects", lastTrained: "Recomputed on load", coverage: "Cost, productivity, duration" },
  "Time-Series Forecast": { engine: "Trend + seasonality (demo)", training: "Monthly installation curves", lastTrained: "Demo engine", coverage: "Duration, monthly capacity" },
  "Regression Model": { engine: "Linear regression on volume & complexity", training: "6 projects, 4 features", lastTrained: "Demo engine", coverage: "Workforce, cost/unit" },
  "Gradient Boosting": { engine: "Boosted trees (not connected)", training: "—", lastTrained: "Not trained", coverage: "Cost forecast (placeholder)" },
  "Random Forest": { engine: "Ensemble trees (not connected)", training: "—", lastTrained: "Not trained", coverage: "Rectification (placeholder)" },
  "Neural Network": { engine: "MLP (not connected)", training: "—", lastTrained: "Not trained", coverage: "Placeholder" },
  "LLM Analysis": { engine: "Lovable AI narrative layer", training: "Prompted with this twin only", lastTrained: "n/a", coverage: "Explanation, executive brief" },
  "Hybrid AI Model": { engine: "Statistical + regression blend", training: "6 projects", lastTrained: "Demo engine", coverage: "All forecast outputs" },
  "Custom Model": { engine: "Bring-your-own endpoint", training: "Configured by administrator", lastTrained: "—", coverage: "Replaceable" },
};

export interface Forecast {
  model: string;
  cost: number; costPerUnit: number; labour: number; fleet: number; material: number; partner: number;
  months: number; monthlyCapacity: number; workforce: number; fleetCount: number;
  rectificationPct: number; marginPct: number; breakEvenPrice: number; maxPartnerRate: number;
  peakCash: number; monthlyBurn: number;
  scheduleRisk: number; costRisk: number;
  confidence: number; confidenceLabel: Confidence; reasons: string[];
  completion: string;
}

function similar(t: Twin) {
  return HISTORY.filter(
    (h) => Math.abs(h.quantity - t.project.quantity) / Math.max(1, t.project.quantity) < 0.6 &&
      (h.complexity === t.project.complexity || h.client === t.project.client),
  );
}

const MODEL_BIAS: Record<string, { cost: number; prod: number; rect: number }> = {
  "Statistical Forecast": { cost: 1.0, prod: 1.0, rect: 1.0 },
  "Time-Series Forecast": { cost: 1.02, prod: 0.98, rect: 1.03 },
  "Regression Model": { cost: 0.98, prod: 1.02, rect: 0.97 },
  "Gradient Boosting": { cost: 1.05, prod: 0.95, rect: 1.08 },
  "Random Forest": { cost: 1.04, prod: 0.96, rect: 1.06 },
  "Neural Network": { cost: 1.07, prod: 0.93, rect: 1.1 },
  "LLM Analysis": { cost: 1.0, prod: 1.0, rect: 1.0 },
  "Hybrid AI Model": { cost: 1.03, prod: 0.97, rect: 1.04 },
  "Custom Model": { cost: 1.0, prod: 1.0, rect: 1.0 },
};

export function forecast(t: Twin, model: string): Forecast {
  const base = compute(t);
  const pool = similar(t);
  const ref = pool.length ? pool : HISTORY;
  const avgProd = ref.reduce((a, h) => a + h.productivity, 0) / ref.length;
  const avgRect = ref.reduce((a, h) => a + h.rectificationPct, 0) / ref.length / 100;
  const bias = MODEL_BIAS[model] ?? MODEL_BIAS["Statistical Forecast"];

  // rebuild the twin with history-informed assumptions
  const f = clone(t);
  f.productivity.perTechPerDay = (t.productivity.perTechPerDay * 0.4 + avgProd * 0.6) * bias.prod;
  f.productivity.rectificationRate = (t.productivity.rectificationRate * 0.4 + avgRect * 0.6) * bias.rect;
  const r = compute(f);
  const cost = r.totalCost * bias.cost;
  const marginPct = r.revenue > 0 ? ((r.revenue - cost) / r.revenue) * 100 : 0;

  const reasons = [
    `${HISTORY.length} historical projects available, ${pool.length} comparable in scope and complexity`,
    `Historical productivity ${avgProd.toFixed(1)} ${t.project.unit}/technician/day vs planned ${t.productivity.perTechPerDay.toFixed(1)}`,
    `Historical rectification ${(avgRect * 100).toFixed(1)}% vs planned ${(t.productivity.rectificationRate * 100).toFixed(1)}%`,
    `Fuel rate AED ${t.fleet.fuelPerLitre}/L entered manually`,
    `${t.items.filter((i) => i.source === "Estimated").length} cost lines are estimated, not rate-carded`,
  ];
  let confidence = Math.round(
    35 + 8 * pool.length + (base.dataQuality - 60) * 0.35 + (MODEL_BIAS[model] ? 0 : -10),
  );
  if (!pool.length) confidence = Math.min(confidence, 45);
  if (["Gradient Boosting", "Random Forest", "Neural Network"].includes(model)) confidence = Math.min(confidence, 52);
  confidence = Math.max(18, Math.min(88, confidence));
  const confidenceLabel: Confidence = confidence >= 70 ? "High" : confidence >= 50 ? "Medium" : "Low";
  if (!pool.length) reasons.unshift("Low confidence — no historical project of comparable scope was found");

  return {
    model,
    cost, costPerUnit: r.qty ? cost / r.qty : 0,
    labour: r.labour, fleet: r.fleetCost, material: r.itemCost.Material, partner: r.partnerCost,
    months: r.requiredMonths, monthlyCapacity: Math.round(r.qtyEand / Math.max(1, r.requiredMonths)),
    workforce: r.workforce, fleetCount: r.fleetCount,
    rectificationPct: f.productivity.rectificationRate * 100,
    marginPct, breakEvenPrice: minClientPrice(f, 0), maxPartnerRate: maxPartnerRate(f),
    peakCash: r.peakCash, monthlyBurn: r.monthlyBurn,
    scheduleRisk: Math.min(95, Math.max(5, (r.requiredMonths / Math.max(1, t.targets.scheduleMonths)) * 55)),
    costRisk: Math.min(95, Math.max(5, (cost / Math.max(1, t.targets.maxCost)) * 60)),
    confidence, confidenceLabel, reasons,
    completion: r.completion,
  };
}

/* --------------------------------- scenarios -------------------------------- */

export function scenarioFrom(base: Twin, kind: string): Twin {
  const t = clone(base);
  t.scenario = kind;
  switch (kind) {
    case "Base Case": t.project.delivery = "direct"; t.partner.share = 0; break;
    case "Reseller Case": t.project.delivery = "reseller"; t.partner.share = 1; break;
    case "Hybrid Delivery": t.project.delivery = "hybrid"; t.partner.share = 0.7; break;
    case "Accelerated":
      t.project.durationMonths = Math.max(2, Math.round(base.project.durationMonths * 0.7));
      t.workforce.techCost = base.workforce.techCost * 1.08; break;
    case "Low Cost":
      t.fleet.techPerVehicle = base.fleet.techPerVehicle + 1;
      t.partner.overheadPct = Math.max(0, base.partner.overheadPct - 2); break;
    case "High Risk":
      t.productivity.rectificationRate = 0.1;
      t.productivity.perTechPerDay = base.productivity.perTechPerDay * 0.8; break;
    case "Expansion": t.project.quantity = 50000; break;
    case "AI Optimized":
      t.productivity.utilization = Math.min(0.95, base.productivity.utilization + 0.07);
      t.productivity.travelFactor = Math.max(1, base.productivity.travelFactor - 0.08);
      t.fleet.kmPerDay = base.fleet.kmPerDay * 0.86;
      t.productivity.rectificationRate = Math.max(0.02, base.productivity.rectificationRate * 0.8); break;
    default: break;
  }
  if (t.project.delivery === "direct") t.partner.share = 0;
  return t;
}

export const SCENARIO_PRESETS = [
  "Base Case", "Reseller Case", "Hybrid Delivery", "Accelerated", "Low Cost", "High Risk", "Expansion", "AI Optimized",
];

/* --------------------------------- what-if ---------------------------------- */

export interface WhatIf { matched: boolean; label: string; twin: Twin; notes: string[] }

export function applyQuestion(base: Twin, qRaw: string): WhatIf {
  const q = qRaw.toLowerCase();
  const t = clone(base);
  const notes: string[] = [];
  let matched = false;
  const num = (re: RegExp) => { const m = q.match(re); return m ? parseFloat(m[1].replace(/,/g, "")) : null; };

  const qty = num(/(\d[\d,]{2,})\s*(?:meters|meter|units|installations)/);
  if (qty) { t.project.quantity = qty; notes.push(`Scope changed to ${qty.toLocaleString()} ${t.project.unit}`); matched = true; }

  const prodDrop = num(/productivity\D{0,20}(\d+(?:\.\d+)?)\s*%/);
  if (prodDrop) {
    const dir = /(drop|fall|decrease|down|lower|reduc)/.test(q) ? -1 : 1;
    t.productivity.perTechPerDay *= 1 + (dir * prodDrop) / 100;
    notes.push(`Productivity ${dir < 0 ? "reduced" : "increased"} by ${prodDrop}% to ${t.productivity.perTechPerDay.toFixed(1)}/day`);
    matched = true;
  }
  const rect = q.match(/rectification\D{0,30}?(\d+(?:\.\d+)?)\s*%\D{0,10}?(\d+(?:\.\d+)?)\s*%/);
  if (rect) { t.productivity.rectificationRate = parseFloat(rect[2]) / 100; notes.push(`Rectification set to ${rect[2]}%`); matched = true; }
  else {
    const r1 = num(/rectification\D{0,20}(\d+(?:\.\d+)?)\s*%/);
    if (r1) { t.productivity.rectificationRate = r1 / 100; notes.push(`Rectification set to ${r1}%`); matched = true; }
  }
  const months = num(/(\d+(?:\.\d+)?)\s*months?/) ?? (/five months/.test(q) ? 5 : /four months/.test(q) ? 4 : /three months/.test(q) ? 3 : null);
  if (months) { t.project.durationMonths = months; t.targets.scheduleMonths = months; notes.push(`Target duration set to ${months} months`); matched = true; }
  const fuel = num(/fuel\D{0,20}(\d+(?:\.\d+)?)\s*%/);
  if (fuel) { const dir = /(drop|decrease|down|lower)/.test(q) ? -1 : 1; t.fleet.fuelPerLitre *= 1 + (dir * fuel) / 100; notes.push(`Fuel price now AED ${t.fleet.fuelPerLitre.toFixed(2)}/L`); matched = true; }
  const veh = num(/(\d+)\s*(?:vehicles|vans|cars)/);
  if (veh) { t.fleet.techPerVehicle = Math.max(1, t.fleet.techPerVehicle - 1); notes.push(`Fleet density increased (approx. +${veh} vehicles by lowering technicians per vehicle)`); matched = true; }
  const rate = num(/(?:reseller|partner)\D{0,25}?(?:aed\s*)?(\d{2,4})\s*(?:\/|per)?\s*(?:meter|unit)?/);
  if (rate && /reseller|partner/.test(q) && !/maximum|max|afford/.test(q)) {
    t.partner.mode = "per_unit"; t.partner.perUnit = rate; notes.push(`Partner rate set to AED ${rate}/${t.project.unit.replace(/s$/, "")}`); matched = true;
  }
  const marginT = num(/(\d+(?:\.\d+)?)\s*%\s*margin/) ?? num(/margin\D{0,10}(\d+(?:\.\d+)?)\s*%/);
  if (marginT) { t.targets.marginPct = marginT; notes.push(`Target margin set to ${marginT}%`); matched = true; }
  if (/direct/.test(q) && /reseller|partner/.test(q) && /compare/.test(q)) { notes.push("Use the Scenarios tab comparison — Base Case vs Reseller Case are pre-built"); matched = true; }
  if (/subcontract/.test(q)) {
    const s = num(/(\d+(?:\.\d+)?)\s*%/);
    if (s !== null) { t.partner.share = Math.min(1, s / 100); notes.push(`Partner scope share set to ${s}%`); matched = true; }
  }

  return { matched, label: qRaw, twin: t, notes };
}

export const AGENTS = [
  { key: "commercial", name: "Commercial Agent", role: "Pricing, revenue and margin position" },
  { key: "cost", name: "Cost Agent", role: "Cost build-up and cost drivers" },
  { key: "resource", name: "Resource Agent", role: "Workforce requirement and structure" },
  { key: "fleet", name: "Fleet Agent", role: "Vehicle requirement and fuel exposure" },
  { key: "boq", name: "BOQ Agent", role: "Materials, kits and quantities" },
  { key: "delivery", name: "Delivery Agent", role: "Duration and monthly capacity" },
  { key: "risk", name: "Risk Agent", role: "Risk register and exposure" },
  { key: "reseller", name: "Reseller Agent", role: "Partner economics and break-even" },
  { key: "forecast", name: "Forecast Agent", role: "Prediction models and confidence" },
  { key: "executive", name: "Executive Agent", role: "Executive summary and decisions" },
] as const;

export function agentFindings(t: Twin, r: TwinResult, f: Forecast) {
  const u = t.project.unit.replace(/s$/, "");
  return {
    commercial: [
      `Revenue ${fmtM(r.revenue)} at AED ${r.revenuePerUnit.toFixed(0)} per ${u} all-in.`,
      `Forecast margin ${r.marginPct.toFixed(1)}% vs target ${t.targets.marginPct}%.`,
      `Minimum client price for target margin: AED ${minClientPrice(t).toFixed(0)}.`,
    ],
    cost: [
      `Total cost ${fmtM(r.totalCost)} — AED ${r.costPerUnit.toFixed(0)} per ${u}.`,
      `Largest blocks: partner ${fmtM(r.partnerCost)}, labour ${fmtM(r.labour)}, fleet ${fmtM(r.fleetCost)}.`,
      `Contingency ${fmtM(r.contingency)} and overhead ${fmtM(r.overhead)} applied on direct cost.`,
    ],
    resource: [
      `${r.workforce} people required: ${r.headcount.techs} technicians, ${r.headcount.sup} supervisors, ${r.headcount.eng} engineers, ${r.headcount.qa} QA/QC.`,
      `Effective output ${(t.productivity.perTechPerDay * t.productivity.utilization / t.productivity.travelFactor).toFixed(1)} ${u}/technician/day after utilisation and travel.`,
    ],
    fleet: [
      `${r.fleetCount} vehicles at ${t.fleet.techPerVehicle} technicians per vehicle.`,
      `Fuel exposure inside ${fmtM(r.fleetCost)} fleet cost at AED ${t.fleet.fuelPerLitre}/L and ${t.fleet.kmPerLitre} km/L.`,
    ],
    boq: [
      `Material ${fmtM(r.itemCost.Material)}, equipment ${fmtM(r.itemCost.Equipment)} for ${r.qtyEand.toLocaleString()} e&-delivered ${t.project.unit}.`,
      `BOQ recalculates automatically with scope; manual override available per line.`,
    ],
    delivery: [
      `Calculated requirement ${r.requiredMonths.toFixed(1)} months against a ${t.targets.scheduleMonths}-month constraint.`,
      `Forecast completion ${new Date(f.completion).toLocaleDateString("en-GB")} using history-adjusted productivity.`,
    ],
    risk: [
      `${r.risks.length} active risks, total exposure ${fmtM(r.risks.reduce((a, x) => a + x.exposure, 0))}.`,
      r.risks[0] ? `Largest: ${r.risks[0].name} (${fmtM(r.risks[0].exposure)}).` : "No material risk triggered by current assumptions.",
    ],
    reseller: [
      t.partner.share > 0
        ? `Partner delivers ${(t.partner.share * 100).toFixed(0)}% of scope for ${fmtM(r.partnerCost)}; e& contribution ${fmtM(r.partnerEconomics.eandContribution)}.`
        : "No partner scope in the selected delivery model.",
      `Maximum affordable partner rate at ${t.targets.marginPct}% margin: AED ${maxPartnerRate(t).toFixed(0)}/${u}.`,
    ],
    forecast: [
      `${f.model} forecasts ${fmtM(f.cost)} cost and ${f.marginPct.toFixed(1)}% margin.`,
      `Confidence ${f.confidence}% (${f.confidenceLabel}) — ${f.reasons[0]}.`,
    ],
    executive: [
      `${t.project.client} — ${t.project.projectName}: ${r.qty.toLocaleString()} ${t.project.unit} in ${t.project.durationMonths} months.`,
      `${r.status.label}. ${r.status.why[0]}.`,
      `${r.feasibility.filter((x) => !x.pass).length} of ${r.feasibility.length} feasibility checks not met.`,
    ],
  } as Record<string, string[]>;
}

export function execBrief(t: Twin, r: TwinResult, f: Forecast): { heading: string; lines: string[] }[] {
  const fails = r.feasibility.filter((x) => !x.pass);
  const sens = sensitivity(t).slice(0, 3);
  const dm = DELIVERY_MODELS.find((d) => d.key === t.project.delivery)!;
  return [
    { heading: "Project overview", lines: [`${t.project.client} — ${t.project.projectName}. ${r.qty.toLocaleString()} ${t.project.unit} across ${t.project.region} over ${t.project.durationMonths} months, ${t.project.complexity.toLowerCase()} complexity, ${t.project.slaTargetPct}% SLA.`] },
    { heading: "Commercial position", lines: [`Revenue ${fmtM(r.revenue)}, cost ${fmtM(r.totalCost)}, gross profit ${fmtM(r.grossProfit)} at ${r.marginPct.toFixed(1)}% margin (target ${t.targets.marginPct}%). Cost per ${t.project.unit.replace(/s$/, "")} AED ${r.costPerUnit.toFixed(0)} against revenue of AED ${r.revenuePerUnit.toFixed(0)}.`] },
    { heading: "Delivery model", lines: [`${dm.code} · ${dm.name}. ${(t.partner.share * 100).toFixed(0)}% of scope with partners at ${t.partner.mode === "per_unit" ? `AED ${t.partner.perUnit}/unit` : t.partner.mode === "fixed" ? fmtM(t.partner.fixedFee) + " fixed" : `${t.partner.percentRevenue}% of revenue`}, ${(100 - t.partner.share * 100).toFixed(0)}% delivered by e&.`] },
    { heading: "Resource requirement", lines: [`${r.workforce} people and ${r.fleetCount} vehicles for the e& scope; ${r.headcount.techs} technicians at ${t.productivity.perTechPerDay}/day planned productivity.`] },
    { heading: "Financial forecast", lines: [`${f.model}: cost ${fmtM(f.cost)}, margin ${f.marginPct.toFixed(1)}%, completion ${new Date(f.completion).toLocaleDateString("en-GB")}, rectification ${f.rectificationPct.toFixed(1)}%. Confidence ${f.confidence}% (${f.confidenceLabel}).`] },
    { heading: "Major cost drivers", lines: sens.map((s) => `${s.name}: ±10% moves margin by ${Math.abs(s.marginSwing).toFixed(1)} pts and cost by ${fmtM(Math.abs(s.costSwing))}.`) },
    { heading: "Key risks", lines: r.risks.slice(0, 4).map((x) => `${x.name} — exposure ${fmtM(x.exposure)} (${x.severity}). Mitigation: ${x.mitigation}.`) },
    { heading: "Decisions required", lines: [
      fails.length ? `Resolve: ${fails.map((x) => x.name).join(", ")}.` : "No feasibility blockers at current assumptions.",
      `Confirm partner rate ceiling of AED ${maxPartnerRate(t).toFixed(0)} and minimum client price of AED ${minClientPrice(t).toFixed(0)}.`,
      `Approve peak funding requirement of ${fmtM(Math.abs(r.peakCash))} under ${t.cash.clientDays}-day client terms.`,
    ] },
    { heading: "Assumptions & data quality", lines: [`Data quality ${r.dataQuality}%. ${t.items.filter((i) => i.source === "Estimated").length} cost lines estimated. All figures are simulation data, not actual client commercial rates.`] },
  ];
}

/* --------------------------------- plan/actual ------------------------------ */

export function planActual(t: Twin, r: TwinResult, f: Forecast) {
  // Demo actuals: available for the first 35% of the project only.
  const a = {
    cost: r.totalCost * 1.06, productivity: t.productivity.perTechPerDay * 0.84,
    workforce: r.workforce + 5, fleet: r.fleetCount + 2,
    rectification: t.productivity.rectificationRate * 100 * 1.3, duration: r.requiredMonths * 1.12,
    revenue: r.revenue * 0.98,
  };
  return [
    { metric: "Cost", plan: r.totalCost, forecast: f.cost, actual: a.cost, unit: "AED" },
    { metric: `Productivity (${t.project.unit}/tech/day)`, plan: t.productivity.perTechPerDay, forecast: f.cost ? (f.workforce ? t.productivity.perTechPerDay * 0.93 : 0) : 0, actual: a.productivity, unit: "" },
    { metric: "Workforce", plan: r.workforce, forecast: f.workforce, actual: a.workforce, unit: "" },
    { metric: "Fleet", plan: r.fleetCount, forecast: f.fleetCount, actual: a.fleet, unit: "" },
    { metric: "Rectification %", plan: t.productivity.rectificationRate * 100, forecast: f.rectificationPct, actual: a.rectification, unit: "%" },
    { metric: "Duration (months)", plan: t.project.durationMonths, forecast: f.months, actual: a.duration, unit: "" },
    { metric: "Revenue", plan: r.revenue, forecast: r.revenue, actual: a.revenue, unit: "AED" },
  ];
}

export const LIFECYCLE = [
  "Opportunity", "Bid / Business Case", "Project Award", "Planning", "Execution", "Monitoring", "Closure", "Historical Learning",
];

/* --------------------------------- utilities -------------------------------- */

export function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toFixed(0)}`;
}
export function fmtN(n: number, d = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
}

/* --------------------------------- audit log -------------------------------- */

export interface AuditEntry { id: string; field: string; from: string; to: string; by: string; at: string; impact: string }

const AUDIT_KEY = "twin_audit";
const TWIN_KEY = "twin_state";

export function readAudit(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]") as AuditEntry[]; } catch { return []; }
}
export function pushAudit(e: Omit<AuditEntry, "id" | "at">) {
  const list = readAudit();
  list.unshift({ ...e, id: Math.random().toString(36).slice(2), at: new Date().toISOString() });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(list.slice(0, 200)));
}
export function saveTwin(t: Twin) { localStorage.setItem(TWIN_KEY, JSON.stringify(t)); }
export function loadTwin(): Twin | null {
  try { const raw = localStorage.getItem(TWIN_KEY); return raw ? (JSON.parse(raw) as Twin) : null; } catch { return null; }
}

/* ----------------------------------- auth ----------------------------------- */

const SESSION_KEY = "twin_session";
const TWIN_USERS: Record<string, { password: string; name: string; title: string }> = {
  asaad: { password: "1286", name: "Asaad Tawfik", title: "Head of Delivery & Operations" },
};

export interface TwinSession { username: string; name: string; title: string }

export function twinLogin(u: string, p: string): TwinSession | null {
  const rec = TWIN_USERS[u.trim().toLowerCase()];
  if (!rec || rec.password !== p) return null;
  const s: TwinSession = { username: u.trim().toLowerCase(), name: rec.name, title: rec.title };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}
export function twinSession(): TwinSession | null {
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? (JSON.parse(raw) as TwinSession) : null; } catch { return null; }
}
export function twinLogout() { localStorage.removeItem(SESSION_KEY); }
