import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import {
  formulaComponentsForRpc,
  priceFormulaDraftSchema,
} from "@/lib/pricing/api-schema";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const formulas = await insforge.database
      .from("price_formula_versions")
      .select(
        "id,scope_type,supplier_id,product_id,version_number,name,status,effective_from,effective_until,suggested_resale_markup_percent,freight_estimate_min_percent,freight_estimate_max_percent,activated_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (formulas.error) throw formulas.error;

    const formulaIds = (formulas.data ?? []).map((formula) => String(formula.id));
    const components = formulaIds.length
      ? await insforge.database
          .from("price_formula_components")
          .select(
            "id,formula_version_id,component_code,component_name,calculation_type,calculation_basis,component_value,included_in_member_price,is_enabled,sort_order",
          )
          .in("formula_version_id", formulaIds)
          .order("sort_order")
          .limit(1000)
      : { data: [], error: null };
    if (components.error) throw components.error;

    return NextResponse.json({
      data: { formulas: formulas.data ?? [], components: components.data ?? [] },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const parsed = priceFormulaDraftSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);

  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc(
      "save_price_formula_draft",
      {
        formula_version_id_input: null,
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
    return NextResponse.json(
      { data: { id: data }, message: "บันทึกร่างสูตรราคาแล้ว" },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
