import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import {
  formulaComponentsForRpc,
  priceFormulaDraftSchema,
} from "@/lib/pricing/api-schema";

type FormulaRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: FormulaRouteContext) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();

  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const [formula, components] = await Promise.all([
      insforge.database
        .from("price_formula_versions")
        .select(
          "id,scope_type,supplier_id,product_id,version_number,name,status,effective_from,effective_until,suggested_resale_markup_percent,freight_estimate_min_percent,freight_estimate_max_percent,activated_at,created_at,updated_at",
        )
        .eq("id", id)
        .maybeSingle(),
      insforge.database
        .from("price_formula_components")
        .select(
          "id,formula_version_id,component_code,component_name,calculation_type,calculation_basis,component_value,included_in_member_price,is_enabled,sort_order",
        )
        .eq("formula_version_id", id)
        .order("sort_order")
        .limit(100),
    ]);
    if (formula.error) throw formula.error;
    if (components.error) throw components.error;
    if (!formula.data) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "ไม่พบสูตรราคา" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      data: { formula: formula.data, components: components.data ?? [] },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: FormulaRouteContext) {
  const { id } = await params;
  const parsed = priceFormulaDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  }

  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc(
      "save_price_formula_draft",
      {
        formula_version_id_input: id,
        scope_type_input: parsed.data.scopeType,
        supplier_id_input: parsed.data.supplierId,
        product_id_input: parsed.data.productId,
        name_input: parsed.data.name,
        effective_from_input:
          parsed.data.effectiveFrom ?? new Date().toISOString(),
        effective_until_input: parsed.data.effectiveUntil,
        suggested_resale_markup_percent_input:
          parsed.data.suggestedResaleMarkupPercent,
        freight_estimate_min_percent_input:
          parsed.data.freightEstimateMinPercent,
        freight_estimate_max_percent_input:
          parsed.data.freightEstimateMaxPercent,
        components_input: formulaComponentsForRpc(parsed.data.components),
      },
    );
    if (error) throw error;
    return NextResponse.json({
      data: { id: data },
      message: "อัปเดตร่างสูตรราคาแล้ว",
    });
  } catch (error) {
    return apiError(error);
  }
}
