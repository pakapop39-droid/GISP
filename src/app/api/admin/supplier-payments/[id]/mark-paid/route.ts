import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({ id: z.uuid(), evidence_file_id: z.uuid() });

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
    "mark_supplier_payment_paid",
    (input) => ({
      supplier_payment_id_input: input.id,
      evidence_file_id_input: input.evidence_file_id,
    }),
    "บันทึก Supplier Payment เป็น Paid แล้ว",
  );
}
