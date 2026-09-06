import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z
  .object({
    id: z.uuid(),
    resolution: z.string().trim().max(5000).optional(),
    rejection_reason: z.string().trim().max(5000).optional(),
  })
  .refine((value) => value.resolution || value.rejection_reason, {
    message: "ต้องมี Resolution หรือ Rejection Reason",
  });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, id }),
  }) as NextRequest;
  return runRpcRoute(
    forwarded,
    schema,
    "admin_claim_action",
    (input) => ({
      claim_id_input: input.id,
      action_input: input.rejection_reason ? "REJECT" : "PROPOSE_RESOLUTION",
      note_input: input.rejection_reason ?? input.resolution ?? null,
      responsibility_input: null,
      resolution_type_input: input.rejection_reason ? null : "REPAIR",
      evidence_file_id_input: null,
      assigned_to_input: null,
      target_resolution_at_input: null,
    }),
    "บันทึกผล Claim แล้ว",
  );
}
