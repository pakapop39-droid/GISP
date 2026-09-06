import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(5).max(2000),
  supporting_file_id: z.uuid().nullable().optional(),
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
    "request_order_cancellation",
    (input) => ({
      order_id_input: input.id,
      reason_input: input.reason,
      supporting_file_id_input: input.supporting_file_id ?? null,
    }),
    "บันทึกคำขอยกเลิก Order แล้ว",
    201,
  );
}
