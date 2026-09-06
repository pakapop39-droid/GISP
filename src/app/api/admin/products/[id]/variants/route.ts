import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productVariantSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = productVariantSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const input = parsed.data;
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("save_product_variant", {
      variant_id_input: input.variantId, product_id_input: id, sku_input: input.sku,
      factory_sku_input: input.factorySku ?? "", name_input: input.name,
      specification_summary_input: input.specificationSummary ?? "", width_mm_input: input.widthMm ?? null,
      depth_mm_input: input.depthMm ?? null, height_mm_input: input.heightMm ?? null, weight_kg_input: input.weightKg ?? null,
      cbm_input: input.cbm ?? null, material_summary_input: input.materialSummary ?? "",
      finish_summary_input: input.finishSummary ?? "", moq_input: input.moq ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: input.variantId ? "แก้ไข Variant แล้ว" : "เพิ่ม Variant แล้ว" }, { status: input.variantId ? 200 : 201 });
  } catch (error) { return apiError(error); }
}
