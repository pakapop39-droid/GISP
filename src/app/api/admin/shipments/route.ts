import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseIdQuantities, runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  shipment_name: z.string().trim().min(2).max(180),
  order_item_ids: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const raw = schema.parse(await request.json());
    const items = parseIdQuantities(raw.order_item_ids).map(
      ({ id, quantity }) => ({ order_item_id: id, quantity }),
    );
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...raw, items }),
    }) as NextRequest;
    return runRpcRoute(
      forwarded,
      schema.extend({
        items: z.array(
          z.object({
            order_item_id: z.uuid(),
            quantity: z.number().positive(),
          }),
        ),
      }),
      "create_shipment",
      (input) => ({
        shipment_name_input: input.shipment_name,
        items_input: input.items,
      }),
      "Dispatch Gate ผ่านและสร้าง Shipment แล้ว",
      201,
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง" },
      { status: 400 },
    );
  }
}
