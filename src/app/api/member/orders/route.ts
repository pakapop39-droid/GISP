import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { parseIdQuantities, runRpcRoute } from "@/lib/api/rpc-route";
import { loadMemberOrders } from "@/lib/orders/server";

const schema = z.object({
  project_id: z.uuid(),
  project_item_ids: z.string().min(1),
});

export async function GET() {
  try {
    return NextResponse.json({ data: await loadMemberOrders() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
    const parsed = schema.parse(raw);
    const selections = parseIdQuantities(parsed.project_item_ids).map(
      ({ id, quantity }) => ({ project_item_id: id, quantity }),
    );
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ ...parsed, selections }),
    }) as NextRequest;
    return runRpcRoute(
      forwarded,
      schema.extend({
        selections: z.array(
          z.object({
            project_item_id: z.uuid(),
            quantity: z.number().positive(),
          }),
        ),
      }),
      "create_customer_order",
      (input) => ({
        project_id_input: input.project_id,
        selections_input: input.selections,
      }),
      "สร้าง Order และ Payment Schedule 50/50 แล้ว",
      201,
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "รายการสินค้าไม่ถูกต้อง",
      },
      { status: 400 },
    );
  }
}
