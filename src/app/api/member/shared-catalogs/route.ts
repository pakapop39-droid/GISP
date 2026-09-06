import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { sharedCatalogInputSchema } from "@/lib/shared-catalog/schema";
import { requireMember, sharedCatalogColumns } from "@/lib/shared-catalog/server";

export async function GET() {
  try {
    await requireMember();
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.from("shared_catalogs").select(sharedCatalogColumns).order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireMember();
    const raw = await request.json().catch(() => null);
    const parsed = sharedCatalogInputSchema.safeParse(raw);
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const expiresAt = raw && Object.prototype.hasOwnProperty.call(raw, "expiresAt")
      ? parsed.data.expiresAt
      : new Date(Date.now() + 30 * 86400000).toISOString();
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("create_customer_browse_catalog_draft", {
      title_input: parsed.data.title, introduction_input: parsed.data.introduction,
      brand_name_input: parsed.data.brandName, contact_name_input: parsed.data.contactName,
      contact_phone_input: parsed.data.contactPhone, contact_email_input: parsed.data.contactEmail,
      line_url_input: parsed.data.lineUrl, scope_type_input: parsed.data.scopeType,
      source_id_input: parsed.data.sourceId, expires_at_input: expiresAt,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "สร้างลิงก์ Catalog ร่างแล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
