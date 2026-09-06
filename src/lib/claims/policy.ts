export type ClaimResponsibility = "SUPPLIER" | "LOGISTICS_INSURANCE" | "INSTALLER" | "UNDETERMINED";

export function suggestClaimResponsibility(issueType: string): ClaimResponsibility {
  if (["WRONG_ITEM", "PRODUCTION_QUALITY"].includes(issueType)) return "SUPPLIER";
  if (["DAMAGED", "MISSING", "TRANSIT_DAMAGE"].includes(issueType)) return "LOGISTICS_INSURANCE";
  if (issueType === "INSTALLATION") return "INSTALLER";
  return "UNDETERMINED";
}

export function canCloseClaim(input: {
  status: string;
  resolutionDetails: string | null;
  resolutionEvidenceFileId: string | null;
  memberConfirmedAt: string | null;
}) {
  return input.status === "RESOLVED"
    && Boolean(input.resolutionDetails?.trim())
    && Boolean(input.resolutionEvidenceFileId)
    && Boolean(input.memberConfirmedAt);
}

export function claimedQuantityIsAvailable(delivered: number, activeClaimed: number, requested: number) {
  return requested > 0 && activeClaimed >= 0 && activeClaimed + requested <= delivered;
}
