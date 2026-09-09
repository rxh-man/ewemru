export interface QaItem { key: string; label: string }

export const QA_ITEMS: QaItem[] = [
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

export const QA_HEADER: QaField[] = [
  { key: "reference", label: "Reference #", type: "text", placeholder: "e.g. QA-2026-014" },
  { key: "site", label: "Site Name", type: "text", required: true },
  { key: "buildingId", label: "Building ID #", type: "text", required: true, placeholder: "e.g. B-10245" },
  { key: "date", label: "Date", type: "date", required: true },
];

export const QA_SIGNERS: { key: string; label: string }[] = [
  { key: "s1", label: "e& QA/QC" },
  { key: "s2", label: "e& PM" },
  { key: "s3", label: "Etihad Water and Electricity QA/QC" },
  { key: "s4", label: "Etihad Water and Electricity PM" },
];

export type QaValues = Record<string, string>;
