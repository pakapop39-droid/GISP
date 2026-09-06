export type QcChecklistResult = "PASSED" | "FAILED" | "NOT_INSPECTED";
export type QcFailedDisposition = "FAILED" | "REWORK_REQUIRED";
export type QcOverallResult = "PASSED" | QcFailedDisposition;

export function deriveQcOverallResult(
  checklistResults: QcChecklistResult[],
  failedDisposition: QcFailedDisposition = "FAILED",
): QcOverallResult | null {
  if (!checklistResults.length || checklistResults.some((result) => result === "NOT_INSPECTED")) {
    return null;
  }

  return checklistResults.every((result) => result === "PASSED")
    ? "PASSED"
    : failedDisposition;
}
