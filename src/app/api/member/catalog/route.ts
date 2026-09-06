import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import {
  serializeMemberCatalogItem,
  type MemberCatalogViewRow,
} from "@/lib/catalog/member-safe";
import { signedMemberProductMedia } from "@/lib/catalog/member-server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const querySchema = z.object({
  search: z.string().trim().max(120).default(""),
  categoryId: z.union([z.uuid(), z.literal("")]).default(""),
  sort: z
    .enum(["NEWEST", "PRICE_ASC", "PRICE_DESC", "LEAD_ASC", "NAME"])
    .default("NEWEST"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(12).max(60).default(24),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);

  try {
    const context = await requireAppAccess({ active: true });
    if (!context.roles.includes("MEMBER")) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
    }
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database
      .from("member_catalog")
      .select(
        "id,sku,product_type,name_th,name_en,description_th,specification_summary,default_lead_time_days,country_code,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq,category_id,category_name,price_id,member_price_before_vat,suggested_resale_amount,freight_estimate_min,freight_estimate_max,currency,published_at,available_sample_count,warranty_summary",
      )
      .limit(1000);
    if (error) throw error;
    const rows = (data ?? []) as MemberCatalogViewRow[];
    const term = parsed.data.search.toLocaleLowerCase("th");
    const filtered = rows.filter((row) => {
      if (parsed.data.categoryId && row.category_id !== parsed.data.categoryId) {
        return false;
      }
      if (!term) return true;
      return `${row.sku} ${row.name_th} ${row.name_en ?? ""} ${row.material_summary ?? ""} ${row.category_name ?? ""}`
        .toLocaleLowerCase("th")
        .includes(term);
    });
    filtered.sort((left, right) => {
      if (parsed.data.sort === "PRICE_ASC") {
        return Number(left.member_price_before_vat) - Number(right.member_price_before_vat);
      }
      if (parsed.data.sort === "PRICE_DESC") {
        return Number(right.member_price_before_vat) - Number(left.member_price_before_vat);
      }
      if (parsed.data.sort === "LEAD_ASC") {
        return (left.default_lead_time_days ?? 99999) - (right.default_lead_time_days ?? 99999);
      }
      if (parsed.data.sort === "NAME") {
        return left.name_th.localeCompare(right.name_th, "th");
      }
      return new Date(right.published_at).getTime() - new Date(left.published_at).getTime();
    });
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const pageRows = filtered.slice(start, start + parsed.data.pageSize);
    const media = await signedMemberProductMedia(pageRows.map((row) => row.id));
    const categories = [
      ...new Map(
        rows
          .filter((row) => row.category_id)
          .map((row) => [row.category_id, { id: row.category_id, name: row.category_name }]),
      ).values(),
    ];

    return NextResponse.json({
      data: {
        items: pageRows.map((row) =>
          serializeMemberCatalogItem(row, media.get(row.id)?.[0]?.url ?? null),
        ),
        categories,
        pagination: {
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / parsed.data.pageSize)),
        },
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
