import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productSourceSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = productSourceSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("save_product_source_detail", {
      product_id_input: id,
      supplier_product_code_input: parsed.data.supplierProductCode ?? "",
      source_row_number_input: parsed.data.sourceRowNumber ?? null,
      source_specification_raw_input: parsed.data.sourceSpecificationRaw ?? "",
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "บันทึกข้อมูลอ้างอิงจาก Supplier แล้ว" });
  } catch (error) { return apiError(error); }
}
