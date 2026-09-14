import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { finishLibraryActionSchema } from "@/lib/catalog/finish-schema";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const [suppliers, collections, finishes, products, productOptions, optionValues, mappings] = await Promise.all([
      insforge.database.from("suppliers").select("id,code,name,status").in("status", ["PROSPECT", "ACTIVE"]).order("name").limit(500),
      insforge.database.from("finish_collections").select("id,supplier_id,code,name_th,name_zh,material_category,source_document,source_version,status,created_at,updated_at").order("code").limit(1000),
      insforge.database.from("finishes").select("id,collection_id,code,name_th,name_zh,material,color_hex,swatch_file_id,source_document,source_page,metadata,status,created_at,updated_at").order("code").limit(5000),
      insforge.database.from("products").select("id,supplier_id,sku,name_th,status").in("status", ["DRAFT", "REVIEW"]).order("sku").limit(5000),
      insforge.database.from("product_options").select("id,product_id,name,status,sort_order").eq("status", "ACTIVE").order("sort_order").limit(5000),
      insforge.database.from("product_option_values").select("id,option_id,label,status,sort_order").eq("status", "ACTIVE").order("sort_order").limit(10000),
      insforge.database.from("product_option_finish_mappings").select("option_value_id,finish_id,created_at").limit(10000),
    ]);
    const error = suppliers.error ?? collections.error ?? finishes.error ?? products.error
      ?? productOptions.error ?? optionValues.error ?? mappings.error;
    if (error) throw error;

    const fileIds = (finishes.data ?? []).flatMap((finish) => finish.swatch_file_id ? [finish.swatch_file_id] : []);
    const admin = createInsForgeAdminClient();
    const fileResult = fileIds.length
      ? await admin.database.from("file_metadata").select("id,bucket,object_key").in("id", fileIds).limit(5000)
      : { data: [], error: null };
    if (fileResult.error) throw fileResult.error;
    const fileById = new Map((fileResult.data ?? []).map((file) => [file.id, file]));
    const previewByFileId = new Map<string, string>();
    await Promise.all([...fileById.values()].map(async (file) => {
      const signed = await admin.storage.from(file.bucket).createSignedUrl(file.object_key, 300);
      if (!signed.error && signed.data) previewByFileId.set(file.id, signed.data.signedUrl);
    }));

    const productById = new Map((products.data ?? []).map((product) => [product.id, product]));
    const optionById = new Map((productOptions.data ?? []).map((option) => [option.id, option]));
    const mappingByValueId = new Map((mappings.data ?? []).map((mapping) => [mapping.option_value_id, mapping.finish_id]));
    const optionTargets = (optionValues.data ?? []).flatMap((value) => {
      const option = optionById.get(value.option_id);
      const product = option ? productById.get(option.product_id) : null;
      return option && product ? [{
        optionValueId: value.id,
        supplierId: product.supplier_id,
        productId: product.id,
        productSku: product.sku,
        productName: product.name_th,
        productStatus: product.status,
        optionName: option.name,
        valueLabel: value.label,
        finishId: mappingByValueId.get(value.id) ?? null,
      }] : [];
    });

    return NextResponse.json({ data: {
      suppliers: suppliers.data ?? [],
      collections: collections.data ?? [],
      finishes: (finishes.data ?? []).map((finish) => ({
        ...finish,
        swatchPreviewUrl: finish.swatch_file_id ? previewByFileId.get(finish.swatch_file_id) ?? null : null,
      })),
      optionTargets,
    } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const parsed = finishLibraryActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const input = parsed.data;
    let result: { data: unknown; error: unknown };
    let message = "บันทึกแล้ว";
    switch (input.action) {
      case "CREATE_COLLECTION":
      case "UPDATE_COLLECTION":
        result = await insforge.database.rpc("save_finish_collection", {
          collection_id_input: input.action === "UPDATE_COLLECTION" ? input.collectionId : null,
          supplier_id_input: input.supplierId,
          code_input: input.code,
          name_th_input: input.nameTh,
          name_zh_input: input.nameZh ?? "",
          material_category_input: input.materialCategory ?? "",
          source_document_input: input.sourceDocument,
          source_version_input: input.sourceVersion ?? "",
        });
        message = input.action === "CREATE_COLLECTION" ? "สร้าง Collection สีเป็น Draft แล้ว" : "แก้ไข Collection สีแล้ว";
        break;
      case "SET_COLLECTION_STATUS":
        result = await insforge.database.rpc("set_finish_collection_status", {
          collection_id_input: input.collectionId,
          status_input: input.status,
        });
        message = input.status === "ACTIVE" ? "เปิดใช้ Collection สีแล้ว" : "พักใช้ Collection สีแล้ว";
        break;
      case "CREATE_FINISH":
      case "UPDATE_FINISH":
        result = await insforge.database.rpc("save_finish", {
          finish_id_input: input.action === "UPDATE_FINISH" ? input.finishId : null,
          collection_id_input: input.collectionId,
          code_input: input.code,
          name_th_input: input.nameTh,
          name_zh_input: input.nameZh ?? "",
          material_input: input.material ?? "",
          color_hex_input: input.colorHex ?? "",
          source_document_input: input.sourceDocument,
          source_page_input: input.sourcePage,
          metadata_input: input.metadata,
        });
        message = input.action === "CREATE_FINISH" ? "สร้างสีเป็น Draft แล้ว กรุณาอัปโหลดรูปก่อนเปิดใช้" : "แก้ไขข้อมูลสีแล้ว";
        break;
      case "SET_FINISH_STATUS":
        result = await insforge.database.rpc("set_finish_status", {
          finish_id_input: input.finishId,
          status_input: input.status,
        });
        message = input.status === "ACTIVE" ? "เปิดใช้สีแล้ว" : "พักใช้สีแล้ว";
        break;
      case "MAP_FINISH":
        result = await insforge.database.rpc("map_finish_to_product_option_value", {
          option_value_id_input: input.optionValueId,
          finish_id_input: input.finishId,
        });
        message = input.finishId ? "ผูกสีกับค่า Option แล้ว" : "ยกเลิกการผูกสีแล้ว";
        break;
    }
    if (result.error) throw result.error;
    return NextResponse.json({ data: { id: result.data }, message }, {
      status: input.action.startsWith("CREATE_") ? 201 : 200,
    });
  } catch (error) {
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    if (message.includes("DUPLICATE_FINISH_COLLECTION_CODE") || message.includes("DUPLICATE_FINISH_CODE")) {
      return NextResponse.json({ code: "DUPLICATE_FINISH_CODE", message: "รหัส Collection หรือรหัสสีนี้มีอยู่แล้ว" }, { status: 409 });
    }
    if (message.includes("FINISH_NOT_READY")) {
      return NextResponse.json({ code: "FINISH_NOT_READY", message: "ต้องเปิดใช้ Collection และอัปโหลดรูปสวอตช์ก่อนเปิดใช้สี" }, { status: 409 });
    }
    if (message.includes("FINISH_NOT_AVAILABLE")) {
      return NextResponse.json({ code: "FINISH_NOT_AVAILABLE", message: "สีนี้ยังไม่พร้อมใช้หรือเป็นของ Supplier คนละราย" }, { status: 409 });
    }
    return apiError(error);
  }
}

