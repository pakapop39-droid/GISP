import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ id }),
  }) as NextRequest;
  return runRpcRoute(
    forwarded,
    z.object({ id: z.uuid() }),
    "approve_custom_qc",
    (input) => ({ order_item_id_input: input.id }),
    "อนุมัติ QC สำหรับสินค้า Custom แล้ว",
  );
}
