import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  decision_note: z.string().trim().max(1000).optional(),
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
    "review_supplier_payment",
    (input) => ({
      supplier_payment_id_input: input.id,
      approve_input: input.approve,
      decision_note_input: input.decision_note ?? null,
    }),
    "บันทึกผลอนุมัติ Supplier Payment แล้ว",
  );
}
