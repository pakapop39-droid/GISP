import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { productCostSchema } from "@/lib/pricing/api-schema";

type ProductRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: ProductRouteContext) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.cost.read"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database
      .from("product_cost_versions")
      .select(
        "id,product_id,variant_id,factory_cost,currency,exchange_rate_to_thb,factory_cost_thb,effective_from,effective_until,status,created_at",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: ProductRouteContext) {
  const { id } = await params;
  const parsed = productCostSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  }
  try {
    await requireAppAccess({ permissions: ["catalog.cost.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc(
      "create_product_cost_version",
      {
        product_id_input: id,
        variant_id_input: parsed.data.variantId,
        factory_cost_input: parsed.data.factoryCost,
        currency_input: parsed.data.currency,
        exchange_rate_to_thb_input: parsed.data.exchangeRateToThb,
        effective_from_input:
          parsed.data.effectiveFrom ?? new Date().toISOString(),
      },
    );
    if (error) throw error;
    return NextResponse.json(
      { data: { id: data }, message: "สร้างต้นทุนเวอร์ชันใหม่แล้ว" },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
