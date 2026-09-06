import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { supplierDraftSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database
      .from("suppliers")
      .select("id,code,name,legal_name,country_code,default_currency,contact_name,contact_email,contact_phone,website_url,default_lead_time_days,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const parsed = supplierDraftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("create_catalog_supplier", {
      code_input: parsed.data.code,
      name_input: parsed.data.name,
      legal_name_input: parsed.data.legalName ?? "",
      country_code_input: parsed.data.countryCode,
      default_currency_input: parsed.data.defaultCurrency,
      contact_name_input: parsed.data.contactName ?? "",
      contact_email_input: parsed.data.contactEmail ?? "",
      contact_phone_input: parsed.data.contactPhone ?? "",
      website_url_input: parsed.data.websiteUrl ?? "",
      default_lead_time_days_input: parsed.data.defaultLeadTimeDays ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "สร้าง Supplier แล้ว" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
