import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  decision_note: z.string().trim().min(3).max(2000),
  approved_refund_amount: z.coerce.number().min(0).default(0),
  approved_deduction_amount: z.coerce.number().min(0).default(0),
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
    "decide_order_cancellation",
    (input) => ({
      cancellation_request_id_input: input.id,
      approve_input: input.approve,
      decision_note_input: input.decision_note,
      approved_refund_amount_input: input.approved_refund_amount,
      approved_deduction_amount_input: input.approved_deduction_amount,
    }),
    "บันทึกผลพิจารณาการยกเลิกแล้ว",
  );
}
