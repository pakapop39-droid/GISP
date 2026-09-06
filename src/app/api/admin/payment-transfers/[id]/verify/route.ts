import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  finance_note: z.string().trim().max(1000).optional(),
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
    "verify_payment_transfer",
    (input) => ({
      transfer_id_input: input.id,
      approve_input: input.approve,
      finance_note_input: input.finance_note ?? null,
    }),
    "บันทึกผลการตรวจเงินแล้ว",
  );
}
