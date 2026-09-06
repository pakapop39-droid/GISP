import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productDraftSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const products: Record<string, unknown>[] = [];
    const pageSize = 200;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await insforge.database
        .from("products")
        .select("id,supplier_id,category_id,sku,factory_sku,product_type,name_th,name_en,country_code,default_lead_time_days,status,qa_status,created_at,updated_at")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      products.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
    return NextResponse.json({ data: products });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const parsed = productDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("create_catalog_product_draft", {
      supplier_id_input: parsed.data.supplierId,
      category_id_input: parsed.data.categoryId,
      sku_input: parsed.data.sku,
      factory_sku_input: parsed.data.factorySku ?? "",
      name_th_input: parsed.data.nameTh,
      name_en_input: parsed.data.nameEn ?? "",
      product_type_input: parsed.data.productType,
      country_code_input: parsed.data.countryCode,
      default_lead_time_days_input: parsed.data.defaultLeadTimeDays ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "สร้าง Product Draft แล้ว ขั้นต่อไปให้กรอก Product Detail" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
