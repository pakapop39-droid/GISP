import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";
import { apiError } from "@/lib/api/response";
import { loadMemberClaims } from "@/lib/claims/server";

const schema = z.object({
  delivery_item_id: z.uuid(),
  issue_type: z.enum(["MISSING", "WRONG_ITEM", "DAMAGED", "PRODUCTION_QUALITY", "TRANSIT_DAMAGE", "INSTALLATION", "OTHER"]),
  subject: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10).max(5000),
  claimed_quantity: z.coerce.number().positive(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  discovered_at: z.iso.datetime(),
  packaging_condition: z.string().trim().max(1000).optional(),
  temporary_action: z.string().trim().max(1000).optional(),
  evidence_file_id: z.uuid(),
});

export async function GET() {
  try { return NextResponse.json({ data: await loadMemberClaims() }); }
  catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "create_claim",
    (input) => ({
      delivery_item_id_input: input.delivery_item_id,
      issue_type_input: input.issue_type,
      subject_input: input.subject,
      description_input: input.description,
      claimed_quantity_input: input.claimed_quantity,
      severity_input: input.severity,
      discovered_at_input: input.discovered_at,
      packaging_condition_input: input.packaging_condition ?? null,
      temporary_action_input: input.temporary_action ?? null,
      evidence_file_id_input: input.evidence_file_id,
    }),
    "เปิด Claim แล้ว",
    201,
  );
}
