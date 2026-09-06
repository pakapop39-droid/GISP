import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import {
  serializeMemberCatalogItem,
  type MemberCatalogViewRow,
} from "@/lib/catalog/member-safe";
import { serializeMemberCatalogExtras } from "@/lib/catalog/sample-warranty";
import {
  signedMemberDocuments,
  signedMemberProductMedia,
} from "@/lib/catalog/member-server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    const context = await requireAppAccess({ active: true });
    if (!context.roles.includes("MEMBER")) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
    }
    const insforge = await createInsForgeServerClient();
    const result = await insforge.database
      .from("member_catalog")
      .select(
        "id,sku,product_type,name_th,name_en,description_th,specification_summary,default_lead_time_days,country_code,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq,category_id,category_name,price_id,member_price_before_vat,suggested_resale_amount,freight_estimate_min,freight_estimate_max,currency,published_at,available_sample_count,warranty_summary",
      )
      .eq("id", id)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "ไม่พบสินค้านี้ หรือสินค้ายังไม่พร้อมแสดงแก่สมาชิก" },
        { status: 404 },
      );
    }

    const admin = createInsForgeAdminClient();
    const [variantResult, optionResult, extrasResult, media, documents] = await Promise.all([
      admin.database
        .from("product_variants")
        .select(
          "id,sku,name,specification_summary,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq",
        )
        .eq("product_id", id)
        .eq("status", "ACTIVE")
        .order("sku")
        .limit(200),
      admin.database
        .from("product_options")
        .select("id,name,is_required,sort_order")
        .eq("product_id", id)
        .order("sort_order")
        .limit(100),
      insforge.database.rpc("get_member_product_catalog_extras", {
        product_id_input: id,
      }),
      signedMemberProductMedia([id]),
      signedMemberDocuments(id),
    ]);
    if (variantResult.error || optionResult.error || extrasResult.error) {
      throw variantResult.error ?? optionResult.error ?? extrasResult.error;
    }
    const options = optionResult.data ?? [];
    const optionIds = options.map((option) => option.id);
    const valueResult = optionIds.length
      ? await admin.database
          .from("product_option_values")
          .select("id,option_id,label,member_price_delta,sort_order")
          .in("option_id", optionIds)
          .eq("status", "ACTIVE")
          .order("sort_order")
          .limit(1000)
      : { data: [], error: null };
    if (valueResult.error) throw valueResult.error;
    const values = valueResult.data ?? [];
    const images = media.get(id) ?? [];
    const item = serializeMemberCatalogItem(
      result.data as MemberCatalogViewRow,
      images[0]?.url ?? null,
    );
    const extras = serializeMemberCatalogExtras(extrasResult.data);

    return NextResponse.json({
      data: {
        ...item,
        images,
        variants: variantResult.data ?? [],
        options: options.map((option) => ({
          id: option.id,
          name: option.name,
          isRequired: option.is_required,
          values: values
            .filter((value) => value.option_id === option.id)
            .map((value) => ({
              id: value.id,
              label: value.label,
              memberPriceDelta: Number(value.member_price_delta),
            })),
        })),
        documents,
        samples: extras.samples,
        warranty: extras.warranty,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
