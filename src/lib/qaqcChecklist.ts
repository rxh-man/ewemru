export interface QaItem { key: string; label: string }

export const QA_ITEMS: QaItem[] = [
  { key: "g0", label: "Same Gateway (GW S/No) as per report confirmed found at site" },
  { key: "g1", label: "GRP Box Installed Properly" },
  { key: "g2", label: "Containment Installed Properly" },
  { key: "g3", label: "Cable is Pulled" },
  { key: "g4", label: "Cable is terminated properly" },
  { key: "g5", label: "Proper labels available" },
  { key: "g6", label: "Gateway is installed properly" },
  { key: "g7", label: "Gateway is powered up" },
  { key: "g8", label: "SIM is Installed" },
  { key: "g9", label: "Gateway is activated" },
  { key: "g10", label: "On Site Verification for meter connectivity (Gurux for 1-M DLMS)" },
];

export const QA_ANSWERS = ["YES", "NO", "N/A"] as const;

export interface QaField { key: string; label: string; type: "text" | "date"; required?: boolean; placeholder?: string }

export type QaProject = "ewe" | "taqa";

export const QA_PROJECTS: Record<QaProject, { name: string; blurb: string }> = {
  ewe: {
    name: "Etihad WE",
    blurb: "Gateway installation inspection for the Etihad WE smart metering programme.",
  },
  taqa: {
    name: "TAQA",
    blurb: "Same inspection adapted for TAQA, with Building ID / UNAID captured on the record.",
  },
};

export function qaHeader(project: QaProject): QaField[] {
  return [
    { key: "reference", label: "Reference #", type: "text", placeholder: "e.g. QA-2026-014" },
    { key: "site", label: "Building Name", type: "text", required: true },
    {
      key: "buildingId",
      label: project === "taqa" ? "Building ID / UNAID" : "Building ID #",
      type: "text",
      required: true,
      placeholder: project === "taqa" ? "e.g. UNAID-104578" : "e.g. B-10245",
    },
    { key: "gw", label: "GW S/No", type: "text", required: true, placeholder: "e.g. GW123456" },
    { key: "ip", label: "IP Address", type: "text", placeholder: "e.g. 10.20.30.40" },
    { key: "iccid", label: "SIM ICCID", type: "text", placeholder: "e.g. 8997100000012345678" },
    { key: "employeeId", label: "Employee ID", type: "text", required: true, placeholder: "e.g. 100482" },
    { key: "date", label: "Date", type: "date", required: true },
  ];
}

export const QA_HEADER: QaField[] = qaHeader("ewe");

export function qaSigners(project: QaProject): { key: string; label: string }[] {
  const client = project === "taqa" ? "TAQA" : "Etihad Water and Electricity";
  return [
    { key: "s1", label: "e& QA/QC" },
    { key: "s2", label: "e& PM" },
    { key: "s3", label: `${client} QA/QC` },
    { key: "s4", label: `${client} PM` },
  ];
}

export const QA_SIGNERS = qaSigners("ewe");

export type QaValues = Record<string, string>;

export interface QaMaterial { key: string; no: string; label: string; unit: string; section?: boolean }

export const QA_MATERIALS: QaMaterial[] = [
  { key: "m1", no: "BQ2.0", label: "Supply and installation of Gateway for Electricity meters - SCOPE OF SUPPLY", unit: "", section: true },
  { key: "m2", no: "BQ2.1", label: "Supply and installation of RS485 Gateways with Cellular 3G/4G Modem as specified for electricity meters (Buildings).", unit: "EA" },
  { key: "m3", no: "BQ 2.2", label: "Supply and installation of RS485 Gateways with Cellular 3G/4G Modem as specified for electricity meters (Villas).", unit: "EA" },
  { key: "m4", no: "BQ 3.0", label: "Supply and installation of GRP Enclosure, Direct Mounting, PVC Box", unit: "", section: true },
  { key: "m5", no: "BQ 3.1", label: "Supply and installation of GRP Enclosure complete with Battery charger, thermostat with all terminations as specified in Buildings. Works to include power supply wiring to LVAC panels with necessary isolation MCBs as specified.", unit: "SET" },
  { key: "m6", no: "BQ 3.2", label: "Supply and installation of GRP Enclosure complete with Battery charger, thermostat with all terminations as specified in Villa areas. Works to include power supply wiring to Feeder Pillar panels with necessary isolation MCBs as specified.", unit: "SET" },
  { key: "m7", no: "BQ 3.3", label: "Supply and installation of PVC Box complete with all terminations as specified in Buildings. Works to include power supply wiring to LVAC panels with necessary isolation MCBs as specified.", unit: "SET" },
  { key: "m8", no: "BQ 3.4", label: "Direct Mounting of Communication Devices with all terminations as specified in Buildings. Works to include power supply wiring to LVAC panels with necessary isolation MCBs as specified.", unit: "SET" },
  { key: "m9", no: "IN 5.0", label: "SMART ELECTRICITY METERS - INSTALLATION WORKS", unit: "", section: true },
  { key: "m10", no: "BQ5.1", label: "Installation of cabling, ducting and terminations of THREE PHASE smart electricity meters in buildings. Works to include supply of RS485 wire, termination boxes, cable ducts / conduits in each floor and all necessary accessories, as per FEWA+L16 standard procedures.", unit: "EA" },
  { key: "m11", no: "BQ5.2", label: "Installation of cabling, ducting and terminations of SINGLE PHASE smart electricity meters in buildings. Works to include supply of RS485 wire, termination boxes, cable ducts / conduits in each floor and all necessary accessories, as per FEWA standard procedures.", unit: "EA" },
  { key: "m12", no: "BQ5.3", label: "Supply and installation of RS485 Gateways with Cellular 3G/4G Modem as specified for SINGLE PHASE smart electricity meters (Villas).", unit: "EA" },
  { key: "m13", no: "BQ5.4", label: "Supply and installation of RS485 Gateways with Cellular 3G/4G Modem as specified for THREE PHASE smart electricity meters (Villas).", unit: "EA" },
  { key: "m14", no: "", label: "SMART ENERGY METERS - Other Works", unit: "", section: true },
  { key: "m15", no: "1", label: "Core drilling works in concrete slabs between walls", unit: "SET" },
  { key: "m16", no: "2", label: "Core drilling works in concrete slabs between floors", unit: "SET" },
  { key: "m17", no: "3", label: "Civil works related to foundations and brackets for mounting of GRP enclosures in villa areas.", unit: "SET" },
  { key: "m18", no: "4", label: "Supply of Solar Panels with MPTT Charge controller (24 VDC) and battery backup for autonomy of 24 hours.", unit: "SET" },
  { key: "m19", no: "5", label: "Installation, testing and commissioning of solar panels.", unit: "SET" },
  { key: "m20", no: "6", label: "Additional communication cabling works between Communication Gateway and Electricity/Water Meters for Villas, with use of extra cable length, per meter run.", unit: "Meter Run" },
  { key: "m21", no: "7", label: "Additional power tapping from power source with use of additional cable and installation accessories.", unit: "Meter Run" },
];
