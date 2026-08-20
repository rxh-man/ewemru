export type FieldType = "text" | "date" | "textarea" | "choice";

export interface RmaField {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  readonly?: boolean;
}

export type RmaSection =
  | { kind: "grid"; title: string; cols: number; fields: RmaField[] }
  | { kind: "table"; title: string; cols: 1 | 2; fields: RmaField[] }
  | {
      kind: "trace";
      title: string;
      columns: { key: string; label: string; width: number }[];
      minRows: number;
    }
  | { kind: "notes"; title: string; items: string[] };

export interface RmaFormDef {
  id: "esyasoft" | "datakorum";
  vendor: string;
  docTitle: string;
  blurb: string;
  sections: RmaSection[];
}

const OKNO = ["OK", "NO", "N/A"];
const YN = ["Y", "N", "N/A"];
const GOODPOOR = ["Good", "Poor", "N/A"];

export const ESYASOFT: RmaFormDef = {
  id: "esyasoft",
  vendor: "Esyasoft",
  docTitle: "GATEWAY DIAGNOSTIC & VISUAL INSPECTION REPORT",
  blurb: "Gateway diagnostics + visual inspection checklist",
  sections: [
    {
      kind: "grid",
      title: "Device Identification",
      cols: 2,
      fields: [
        { key: "company", label: "Company", type: "text", required: true, readonly: true },
        { key: "sr", label: "Gateway Sr. No", type: "text", required: true },
        { key: "model", label: "Gateway Model", type: "text", required: true },
        { key: "series", label: "Gateway Series", type: "text" },
        { key: "fw", label: "Firmware Version", type: "text" },
        { key: "by", label: "Checking By", type: "text", required: true },
        { key: "date", label: "Date", type: "date", required: true },
      ],
    },
    {
      kind: "table",
      title: "First Diagnostic Report",
      cols: 1,
      fields: [
        { key: "d1", label: "Gateway not powering up", type: "choice", options: OKNO },
        { key: "d2", label: "SMPS faulty", type: "choice", options: OKNO },
        { key: "d3", label: "Antenna damaged", type: "choice", options: OKNO },
        { key: "d4", label: "SIM slot damaged", type: "choice", options: OKNO },
        { key: "d5", label: "Backup battery faulty", type: "choice", options: OKNO },
        { key: "d6", label: "PCB damaged", type: "choice", options: OKNO },
        { key: "d7", label: "SIM not detecting / not registering", type: "choice", options: OKNO },
        { key: "d8", label: "Firmware stopped", type: "choice", options: OKNO },
        { key: "d9", label: "Gateway not accessible in local tool", type: "choice", options: OKNO },
        { key: "d10", label: "Interface ports are not working", type: "choice", options: OKNO },
        { key: "d11", label: "Other issues", type: "text" },
        { key: "d12", label: "Issue identified", type: "text" },
        { key: "d13", label: "Images / evidence reference", type: "text" },
      ],
    },
    {
      kind: "table",
      title: "Visual Inspection Checklist",
      cols: 2,
      fields: [
        { key: "v1", label: "Packaging", type: "choice", options: OKNO },
        { key: "v2", label: "Screws", type: "choice", options: OKNO },
        { key: "v3", label: "Enclosure", type: "choice", options: OKNO },
        { key: "v4", label: "Power Cables", type: "choice", options: OKNO },
        { key: "v5", label: "Interface Cables", type: "choice", options: OKNO },
        { key: "v6", label: "Antenna", type: "choice", options: OKNO },
        { key: "v7", label: "Connectors", type: "choice", options: OKNO },
        { key: "v8", label: "PVC Gland", type: "choice", options: OKNO },
        { key: "v9", label: "PCB", type: "choice", options: OKNO },
        { key: "v10", label: "Components", type: "choice", options: OKNO },
        { key: "v11", label: "Any other remarks", type: "text" },
        { key: "v12", label: "Images / evidence reference", type: "text" },
      ],
    },
  ],
};

export const DATAKORUM: RmaFormDef = {
  id: "datakorum",
  vendor: "Datakorum",
  docTitle: "RMA & FAILURE ANALYSIS REQUEST FORM",
  blurb: "RMA claim + installation checklist",
  sections: [
    {
      kind: "grid",
      title: "Claim Information",
      cols: 3,
      fields: [
        { key: "claimDate", label: "Claim Date", type: "date", required: true },
        { key: "company", label: "Your Company", type: "text", required: true, readonly: true },
        { key: "name", label: "Your Name", type: "text", required: true },
        { key: "email", label: "Your Email", type: "text" },
        { key: "ref", label: "Your Claim Reference", type: "text" },
        { key: "distributor", label: "Distributor", type: "text" },
        { key: "phone", label: "Phone Number", type: "text" },
        { key: "customer", label: "Final Customer", type: "text" },
      ],
    },
    {
      kind: "grid",
      title: "Claim Summary",
      cols: 2,
      fields: [
        { key: "qty", label: "Total Number of Devices Included", type: "text", required: true },
        { key: "models", label: "Models Included & Quantity of Each", type: "text", required: true },
        {
          key: "identical",
          label: "Is the Failure Identical Across All Devices?",
          type: "choice",
          options: ["Yes", "No"],
          required: true,
        },
        {
          key: "origin",
          label: "Origin of Defect",
          type: "choice",
          options: ["Field", "Customer Inspection", "Customer Lab", "Other"],
          required: true,
        },
        {
          key: "condition",
          label: "Condition of Product",
          type: "choice",
          options: [
            "Brand new - never installed",
            "Good condition - installed in field",
            "Visible signs of ageing",
            "Damaged - broken or cracked",
          ],
          required: true,
        },
        {
          key: "desc",
          label: "General Failure Description",
          type: "textarea",
          required: true,
          placeholder: "Describe the failure, when it appeared and how it was detected",
        },
      ],
    },
    {
      kind: "trace",
      title: "Traceability",
      minRows: 3,
      columns: [
        { key: "serial", label: "Serial Number", width: 0.2 input(name "href" file name) },
        { key: "mfg", label: "MFG", width: 0.11 },
        { key: "model", label: "Gateway Model", width: 0.18 },
        { key: "fw", label: "FW Version", width: 0.12 },
        { key: "power", label: "Power Source", width: 0.14 },
        { key: "notes", label: "Notes", width: 0.25 },
      ],
    },
    {
      kind: "table",
      title: "Installation Checklist",
      cols: 2,
      fields: [
        { key: "c1", label: "Customer technical team trained by Datakorum", type: "choice", options: YN },
        { key: "c2", label: "Commissioned by authorised personnel", type: "choice", options: YN },
        { key: "c3", label: "Installation steps from technical manual followed", type: "choice", options: YN },
        { key: "c4", label: "Removal date", type: "text" },
        { key: "c5", label: "Was the location ever flooded?", type: "choice", options: YN },
        { key: "c6", label: "Device opened / tampered by external personnel?", type: "choice", options: YN },
        { key: "c7", label: "Physical condition of the Gateway", type: "choice", options: GOODPOOR },
        { key: "c8", label: "Enclosure condition", type: "choice", options: GOODPOOR },
        { key: "c9", label: "IP protection rating condition", type: "choice", options: GOODPOOR },
        { key: "c10", label: "PCB condition", type: "choice", options: GOODPOOR },
        { key: "c11", label: "SIM tray condition", type: "choice", options: GOODPOOR },
        { key: "c12", label: "AC Gateways: PSU visual inspection", type: "choice", options: GOODPOOR },
        { key: "c13", label: "AC Gateways: PSU output voltage", type: "text" },
        { key: "c14", label: "AC Gateways: PSU fuse status", type: "choice", options: GOODPOOR },
        { key: "c15", label: "Battery Gateways: battery visual inspection", type: "choice", options: GOODPOOR },
        { key: "c16", label: "Battery Gateways: battery voltage", type: "text" },
        { key: "c17", label: "LED status", type: "choice", options: YN },
        { key: "c18", label: "Error messages displayed during reboot", type: "choice", options: YN },
        { key: "c19", label: "SIM status during initialization", type: "choice", options: YN },
        { key: "c20", label: "Configured APN", type: "text" },
        { key: "c21", label: "CSQ and RSSI value", type: "text" },
        { key: "c22", label: "Gateway able to connect to server", type: "choice", options: YN },
        { key: "c23", label: "Heartbeat sent on reboot", type: "choice", options: YN },
        { key: "c24", label: "Configuration received from MW", type: "choice", options: YN },
        { key: "c25", label: "Firmware updated to latest version", type: "choice", options: YN },
        { key: "c26", label: "Meter wiring and polarity correct", type: "choice", options: YN },
        { key: "c27", label: "Meter configuration applied at HES / MW", type: "choice", options: YN },
        { key: "c28", label: "Meter responding to reading commands", type: "choice", options: YN },
        { key: "c29", label: "Attached documentation (photos, logs, MW traces)", type: "text" },
      ],
    },
    {
      kind: "notes",
      title: "Shipment Terms",
      items: [
        "All products should be provided in good condition.",
        "Do not mark the samples with tape or stickers - use a marker pen instead.",
        "Pack the product in a box to prevent physical stress during shipment.",
        "Products should be provided free of charge; reciprocally the analysis is done free of charge.",
      ],
    },
  ],
};

export const RMA_FORMS: RmaFormDef[] = [ESYASOFT, DATAKORUM];
