import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  application_id: z.uuid(),
  review_note: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "approve_member_application",
    (input) => ({
      application_id_input: input.application_id,
      review_note_input: input.review_note ?? null,
    }),
    "อนุมัติสมาชิกเรียบร้อยแล้ว",
  );
}
