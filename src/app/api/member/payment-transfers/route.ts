import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  payment_schedule_id: z.uuid(),
  amount: z.coerce.number().positive(),
  transferred_at: z.iso.datetime(),
  evidence_file_id: z.uuid(),
});

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "submit_payment_transfer",
    (input) => ({
      payment_schedule_id_input: input.payment_schedule_id,
      amount_input: input.amount,
      transferred_at_input: input.transferred_at,
      evidence_file_id_input: input.evidence_file_id,
    }),
    "ส่งหลักฐานการโอนเพื่อรอ Finance ตรวจแล้ว",
    201,
  );
}
