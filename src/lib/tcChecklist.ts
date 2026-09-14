export interface TcItem { key: string; label: string }

export const TC_ITEMS: TcItem[] = [
  { key: "q1", label: "Checked & verified the GW or DCU No as per the QC Report" },
  { key: "q2", label: "Firmware Version Checked & Updated" },
  { key: "q3", label: "Profile Updation Done" },
  { key: "q4", label: "Signal Strength Value Verified" },
  { key: "q5", label: "Network Forced to 3G" },
  { key: "q6", label: "Cleared data from DCU Events Out & Meter Read Out Folders" },
  { key: "q7", label: "Ping Test Done" },
  { key: "q8", label: "HDLC Modification Done" },
  { key: "q9", label: "Screen Shots & Video Recorded as a proof of Commissioning" },
  { key: "q10", label: "Report Updated Correctly" },
];

export const TC_ANSWERS = ["YES", "NO", "N/A"] as const;

export interface TcHeaderField { key: string; label: string; type: "text" | "date"; required?: boolean; placeholder?: string }

export const TC_HEADER: TcHeaderField[] = [
  { key: "building", label: "Building Name", type: "text", required: true },
  { key: "tcDate", label: "T & C Date", type: "date", required: true },
  { key: "gw", label: "GW S/No", type: "text", required: true, placeholder: "e.g. GW123456" },
  { key: "ip", label: "IP Address", type: "text", placeholder: "e.g. 10.20.30.40" },
  { key: "iccid", label: "SIM ICCID", type: "text", placeholder: "e.g. 8997100000012345678" },
  { key: "employeeId", label: "Employee ID", type: "text", required: true, placeholder: "e.g. 100482" },
];

export type TcValues = Record<string, string>;
