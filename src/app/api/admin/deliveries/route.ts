import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  shipment_id: z.uuid(),
  recipient_name: z.string().trim().min(2).max(180),
  proof_file_id: z.uuid(),
  delivered_with_issue: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "record_delivery",
    (input) => ({
      shipment_id_input: input.shipment_id,
      recipient_name_input: input.recipient_name,
      proof_file_id_input: input.proof_file_id,
      delivered_with_issue_input: input.delivered_with_issue,
    }),
    "บันทึก Delivery และหลักฐานแล้ว",
    201,
  );
}
