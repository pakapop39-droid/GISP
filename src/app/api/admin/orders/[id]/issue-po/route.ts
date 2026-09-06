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
    "issue_supplier_orders",
    (input) => ({ order_id_input: input.id }),
    "ออก Supplier PO แล้ว",
  );
}
