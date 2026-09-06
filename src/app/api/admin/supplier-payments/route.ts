import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  supplier_order_id: z.uuid(),
  payment_type: z.enum(["DEPOSIT", "BALANCE", "PARTIAL"]),
  amount: z.coerce.number().positive(),
  note: z.string().trim().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "create_supplier_payment",
    (input) => ({
      supplier_order_id_input: input.supplier_order_id,
      payment_type_input: input.payment_type,
      amount_input: input.amount,
      note_input: input.note ?? null,
    }),
    "สร้าง Supplier Payment Request แล้ว",
    201,
  );
}
