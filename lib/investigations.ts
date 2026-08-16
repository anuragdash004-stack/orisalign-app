export interface InvestigationType {
  key: string;
  label: string;
}

export const INVESTIGATION_TYPES: InvestigationType[] = [
  { key: "IOPA", label: "IOPA" },
  { key: "OPG", label: "OPG" },
  { key: "LAT_CEPH", label: "Lateral Ceph" },
  { key: "BLOOD_TEST", label: "Blood Test" },
];

// Enough for a phone photo or a scanned PDF report, without letting someone
// accidentally upload a huge raw file.
export const MAX_INVESTIGATION_FILE_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * A patient's investigation step counts as done once either:
 *   - the orthodontist explicitly marked "None Required", or
 *   - every required investigation type has an uploaded file.
 * Not yet decided (empty types array) is not done.
 */
export function isInvestigationDone(journeySteps: Record<string, any> | null | undefined): boolean {
  const js = journeySteps || {};
  const types: string[] = js.investigation_types || [];
  if (types.length === 0) return false;
  if (types.includes("NONE")) return true;
  const files = js.investigation_files || {};
  return types.every((t) => !!files[t]?.path);
}
