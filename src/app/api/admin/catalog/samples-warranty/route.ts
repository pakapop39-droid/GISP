import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { sampleWarrantyActionSchema } from "@/lib/catalog/sample-warranty-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const [suppliers, locations, products, samples, warranties] = await Promise.all([
      insforge.database.from("suppliers").select("id,code,name,status,country_code").order("name").limit(500),
      insforge.database.from("supplier_locations").select("id,supplier_id,country_code,city,location_type,public_label,address_line,contact_name,contact_email,contact_phone,status").order("created_at", { ascending: false }).limit(1000),
      insforge.database.from("products").select("id,supplier_id,sku,name_th,product_type,status,qa_status").order("name_th").limit(1000),
      insforge.database.from("material_samples").select("id,sample_code,sample_type,product_id,supplier_location_id,display_name,member_note,shelf_location,availability_status,internal_note,created_at").order("created_at", { ascending: false }).limit(1000),
      insforge.database.from("partner_warranty_versions").select("id,supplier_id,product_id,version_number,title,member_summary,terms_text,duration_months,status,effective_from,effective_until,activated_at,created_at").order("created_at", { ascending: false }).limit(1000),
    ]);
    const error = suppliers.error ?? locations.error ?? products.error ?? samples.error ?? warranties.error;
    if (error) throw error;
    return NextResponse.json({ data: {
      suppliers: suppliers.data ?? [], locations: locations.data ?? [], products: products.data ?? [],
      samples: samples.data ?? [], warranties: warranties.data ?? [],
    } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const parsed = sampleWarrantyActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  try {
    const permission = input.action.includes("WARRANTY") ? "catalog.warranty.manage" : "catalog.sample.manage";
    await requireAppAccess({ permissions: [permission] });
    const insforge = await createInsForgeServerClient();
    let result: { data: unknown; error: unknown };
    let message: string;
    switch (input.action) {
      case "CREATE_LOCATION":
        result = await insforge.database.rpc("create_supplier_sample_location", {
          supplier_id_input: input.supplierId, country_code_input: input.countryCode,
          city_input: input.city, location_type_input: input.locationType,
          public_label_input: input.publicLabel, address_line_input: input.addressLine ?? null,
          contact_name_input: input.contactName ?? null, contact_email_input: input.contactEmail || null,
          contact_phone_input: input.contactPhone ?? null,
        });
        message = "เพิ่มสถานที่เก็บตัวอย่างแล้ว";
        break;
      case "CREATE_SAMPLE":
        result = await insforge.database.rpc("create_material_sample", {
          product_id_input: input.productId, supplier_location_id_input: input.supplierLocationId,
          sample_code_input: input.sampleCode, sample_type_input: input.sampleType,
          display_name_input: input.displayName, member_note_input: input.memberNote ?? null,
          shelf_location_input: input.shelfLocation ?? null, internal_note_input: input.internalNote ?? null,
        });
        message = "เพิ่มตัวอย่างสินค้าแล้ว";
        break;
      case "SET_SAMPLE_STATUS":
        result = await insforge.database.rpc("set_material_sample_status", { sample_id_input: input.sampleId, status_input: input.status });
        message = "อัปเดตสถานะตัวอย่างแล้ว";
        break;
      case "CREATE_WARRANTY":
        result = await insforge.database.rpc("create_partner_warranty_draft", {
          supplier_id_input: input.supplierId, product_id_input: input.productId,
          title_input: input.title, member_summary_input: input.memberSummary,
          terms_text_input: input.termsText, duration_months_input: input.durationMonths,
          effective_from_input: input.effectiveFrom,
        });
        message = "สร้างฉบับร่างเงื่อนไขรับประกันแล้ว";
        break;
      case "ACTIVATE_WARRANTY":
        result = await insforge.database.rpc("activate_partner_warranty_version", { warranty_id_input: input.warrantyId });
        message = "เปิดใช้เงื่อนไขรับประกันแล้ว และเก็บฉบับก่อนหน้าเป็นประวัติ";
        break;
      case "RETIRE_WARRANTY":
        result = await insforge.database.rpc("retire_partner_warranty_version", { warranty_id_input: input.warrantyId });
        message = "ยกเลิกใช้เงื่อนไขรับประกันแล้ว";
        break;
    }
    if (result.error) throw result.error;
    return NextResponse.json({ data: { id: result.data }, message }, { status: input.action.startsWith("CREATE_") ? 201 : 200 });
  } catch (error) {
    return apiError(error);
  }
}
