import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productDetailSchema } from "@/lib/catalog/api-schema";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const admin = createInsForgeAdminClient();
    const [productResult, variantsResult, optionsResult, mediaResult, documentsResult, filesResult] = await Promise.all([
      admin.database.from("products").select("*").eq("id", id).maybeSingle(),
      admin.database.from("product_variants").select("*").eq("product_id", id).order("created_at", { ascending: true }).limit(100),
      admin.database.from("product_options").select("id,product_id,name,is_required,sort_order,created_at").eq("product_id", id).order("sort_order", { ascending: true }).limit(50),
      admin.database.from("product_media").select("id,product_id,file_id,media_type,is_primary,sort_order,created_at").eq("product_id", id).order("sort_order", { ascending: true }).limit(30),
      admin.database.from("product_documents").select("id,product_id,file_id,document_type,source_page,is_member_visible,created_at").eq("product_id", id).order("created_at", { ascending: false }).limit(30),
      admin.database.from("file_metadata").select("id,original_name,mime_type,size_bytes,bucket,object_key,created_at").eq("entity_id", id).limit(50),
    ]);
    for (const result of [productResult, variantsResult, optionsResult, mediaResult, documentsResult, filesResult]) {
      if (result.error) throw result.error;
    }
    if (!productResult.data) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบสินค้า" }, { status: 404 });
    const product = productResult.data;
    const optionIds = (optionsResult.data ?? []).map((item) => item.id);
    const [supplierResult, categoryResult, optionValuesResult] = await Promise.all([
      admin.database.from("suppliers").select("id,code,name,status,default_currency").eq("id", product.supplier_id).maybeSingle(),
      product.category_id
        ? admin.database.from("categories").select("id,code,name_th").eq("id", product.category_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      optionIds.length
        ? admin.database.from("product_option_values").select("id,option_id,label,member_price_delta,factory_cost_delta,status,sort_order,created_at").in("option_id", optionIds).order("sort_order", { ascending: true }).limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (supplierResult.error || categoryResult.error || optionValuesResult.error) throw supplierResult.error ?? categoryResult.error ?? optionValuesResult.error;
    const files = new Map((filesResult.data ?? []).map((file) => [file.id, file]));
    const media = await Promise.all((mediaResult.data ?? []).map(async (item) => {
      const file = files.get(item.file_id);
      let previewUrl: string | null = null;
      if (file) {
        const signed = await admin.storage.from(file.bucket).createSignedUrl(file.object_key, 300);
        if (!signed.error && signed.data) previewUrl = signed.data.signedUrl;
      }
      return { ...item, file, previewUrl };
    }));
    const documents = (documentsResult.data ?? []).map((item) => ({ ...item, file: files.get(item.file_id) ?? null }));
    const optionValues = optionValuesResult.data ?? [];
    const options = (optionsResult.data ?? []).map((option) => ({
      ...option,
      values: optionValues.filter((item) => item.option_id === option.id),
    }));
    return NextResponse.json({ data: { product, supplier: supplierResult.data, category: categoryResult.data, variants: variantsResult.data ?? [], options, media, documents } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const parsed = productDetailSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const input = parsed.data;
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("save_product_detail", {
      product_id_input: id, supplier_id_input: input.supplierId, category_id_input: input.categoryId,
      sku_input: input.sku, factory_sku_input: input.factorySku ?? "", name_th_input: input.nameTh,
      name_en_input: input.nameEn ?? "", name_zh_input: input.nameZh ?? "", product_type_input: input.productType,
      country_code_input: input.countryCode, description_th_input: input.descriptionTh ?? "",
      specification_summary_input: input.specificationSummary ?? "", default_lead_time_days_input: input.defaultLeadTimeDays,
      width_mm_input: input.widthMm ?? null, depth_mm_input: input.depthMm ?? null, height_mm_input: input.heightMm ?? null,
      weight_kg_input: input.weightKg ?? null, cbm_input: input.cbm ?? null, material_summary_input: input.materialSummary ?? "",
      finish_summary_input: input.finishSummary ?? "", moq_input: input.moq ?? null,
      source_catalog_page_input: input.sourceCatalogPage ?? "", ordering_note_input: input.orderingNote ?? "",
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "บันทึก Product Detail แล้ว" });
  } catch (error) { return apiError(error); }
}
