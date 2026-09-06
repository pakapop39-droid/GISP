import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({ id: z.uuid(), cost_type: z.string().trim().min(2).max(100), amount: z.coerce.number().nonnegative(), currency: z.string().length(3).default("THB"), note: z.string().trim().max(1000).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const forwarded = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ ...body, id }) }) as NextRequest;
  return runRpcRoute(forwarded, schema, "record_claim_internal_cost", (input) => ({ claim_id_input: input.id, cost_type_input: input.cost_type, amount_input: input.amount, currency_input: input.currency.toUpperCase(), internal_note_input: input.note ?? null }), "บันทึกต้นทุนภายในแล้ว");
}
