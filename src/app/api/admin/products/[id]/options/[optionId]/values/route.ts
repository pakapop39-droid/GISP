import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productOptionValueSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  const { id, optionId } = await params;
  const parsed = productOptionValueSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(optionId).success || !parsed.success) return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("save_product_option_value", {
      option_value_id_input: parsed.data.optionValueId,
      option_id_input: optionId,
      label_input: parsed.data.label,
      member_price_delta_input: parsed.data.memberPriceDelta,
      factory_cost_delta_input: parsed.data.factoryCostDelta,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: parsed.data.optionValueId ? "แก้ไขค่า Option แล้ว" : "เพิ่มค่า Option แล้ว" }, { status: parsed.data.optionValueId ? 200 : 201 });
  } catch (error) { return apiError(error); }
}
