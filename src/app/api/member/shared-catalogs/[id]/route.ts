import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { sharedCatalogInputSchema } from "@/lib/shared-catalog/schema";
import { loadMemberSharedCatalog, requireMember } from "@/lib/shared-catalog/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireMember();
    const { id } = await params;
    const data = await loadMemberSharedCatalog(id, context.memberProfileId ?? "");
    if (!data) return NextResponse.json({ message: "ไม่พบ Catalog" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const parsed = sharedCatalogInputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { error } = await db.database.rpc("save_shared_catalog", {
      catalog_id_input: id, title_input: parsed.data.title, introduction_input: parsed.data.introduction,
      brand_name_input: parsed.data.brandName, contact_name_input: parsed.data.contactName,
      contact_phone_input: parsed.data.contactPhone, contact_email_input: parsed.data.contactEmail,
      line_url_input: parsed.data.lineUrl, price_mode_input: "HIDDEN", expires_at_input: parsed.data.expiresAt,
    });
    if (error) throw error;
    return NextResponse.json({ message: "บันทึก Catalog แล้ว" });
  } catch (error) { return apiError(error); }
}
