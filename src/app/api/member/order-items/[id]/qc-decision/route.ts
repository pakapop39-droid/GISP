import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  decision: z.enum(["APPROVED", "ADDITIONAL_REVIEW_REQUESTED"]),
  note: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const incoming = await request.json().catch(() => ({})) as Record<string, unknown>;
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...incoming, id }),
  }) as NextRequest;
  return runRpcRoute(
    forwarded,
    schema,
    "respond_custom_qc",
    (input) => ({
      order_item_id_input: input.id,
      decision_input: input.decision,
      note_input: input.note ?? null,
    }),
    incoming.decision === "APPROVED"
      ? "อนุมัติผล QC แล้ว"
      : "ส่งคำขอตรวจเพิ่มเติมแล้ว",
  );
}
