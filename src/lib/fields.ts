export const ENERGY_FIELDS: { key: string; label: string }[] = [
  { key: "area", label: "Area" },
  { key: "acc_no", label: "Acc No" },
  { key: "premise", label: "Premise" },
  { key: "usn", label: "USN" },
  { key: "msn", label: "MSN" },
  { key: "type", label: "Type" },
  { key: "mru", label: "MRU" },
  { key: "premise_desc", label: "Premise Desc" },
  { key: "location", label: "Location" },
  { key: "linked_main_water_meter", label: "Linked Main Water Meter" },
  { key: "sub_water_meter", label: "Sub Water Meter" },
  { key: "mps_as_per_loc", label: "MPs as per Loc" },
  { key: "building_name", label: "e& Survey Building" },
  { key: "building_id", label: "e& Survey Building ID#" },
  { key: "action_required", label: "Action Required (Energy)" },
  { key: "assigned_surveyor", label: "For Survey (Assigned)" },
  { key: "date_survey_completed", label: "Date (Survey Completed)" },
  { key: "week_of_submission", label: "Week of Submission" },
  { key: "new_data", label: "New Data" },
];

export const WATER_FIELDS: { key: string; label: string }[] = [
  { key: "area", label: "Area" },
  { key: "acc_no", label: "Acc No" },
  { key: "premise", label: "Premise" },
  { key: "main_installation", label: "Main Installation" },
  { key: "serial_number", label: "Serial Number" },
  { key: "msn", label: "MSN" },
  { key: "size", label: "Size" },
  { key: "mru", label: "MRU" },
  { key: "premise_desc", label: "Premise Desc" },
  { key: "location", label: "Location" },
  { key: "linked_main_water_meter", label: "Linked Main Water Meter" },
  { key: "mps_as_per_loc", label: "MPs as per Loc" },
  { key: "building_name", label: "W_e& Survey Building" },
  { key: "building_id", label: "W_e& Survey Building ID#" },
  { key: "action_required", label: "Action Required (Water)" },
  { key: "assigned_surveyor", label: "For Survey (Assigned)" },
  { key: "date_survey_completed", label: "Date (Survey Completed)" },
  { key: "week_of_submission", label: "Week of Submission" },
  { key: "new_data", label: "New Data" },
];

function norm(s: string) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapRow(row: Record<string, unknown>, fields: { key: string; label: string }[]) {
  const out: Record<string, string | null> = {};
  const headerMap = new Map<string, string>();
  for (const k of Object.keys(row)) headerMap.set(norm(k), k);
  for (const f of fields) {
    const candidates = [f.label, f.key];
    let val: unknown = undefined;
    for (const c of candidates) {
      const hit = headerMap.get(norm(c));
      if (hit !== undefined) { val = row[hit]; break; }
    }
    out[f.key] = (val === undefined || val === null || val === "") ? null : String(val).trim();
  }
  return out;
}
