import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  action: z.enum(["START_REVIEW", "REQUEST_INFORMATION", "CONFIRM_RESPONSIBILITY", "COORDINATE", "PROPOSE_RESOLUTION", "MARK_IN_PROGRESS", "COMPLETE_RESOLUTION", "REJECT", "CLOSE", "REOPEN"]),
  note: z.string().trim().max(5000).optional(),
  responsibility: z.enum(["SUPPLIER", "LOGISTICS_INSURANCE", "INSTALLER", "GISP", "MEMBER"]).optional(),
  resolution_type: z.enum(["REPAIR", "REPLACEMENT", "SPARE_PART", "REWORK", "COMPENSATION", "CREDIT", "NO_ACTION"]).optional(),
  evidence_file_id: z.uuid().optional(),
  assigned_to: z.uuid().optional(),
  target_resolution_at: z.iso.datetime().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const forwarded = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ ...body, id }) }) as NextRequest;
  return runRpcRoute(forwarded, schema, "admin_claim_action", (input) => ({
    claim_id_input: input.id,
    action_input: input.action,
    note_input: input.note ?? null,
    responsibility_input: input.responsibility ?? null,
    resolution_type_input: input.resolution_type ?? null,
    evidence_file_id_input: input.evidence_file_id ?? null,
    assigned_to_input: input.assigned_to ?? null,
    target_resolution_at_input: input.target_resolution_at ?? null,
  }), "อัปเดต Claim แล้ว");
}
