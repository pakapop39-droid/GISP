import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({
  company_name: z.string().trim().min(2).max(180), company_legal_name: z.string().trim().max(220).default(""),
  tax_id: z.string().trim().max(30).default(""), address: z.string().trim().max(500).default(""),
  company_email: z.union([z.literal(""), z.email()]), vat_rate: z.number().min(0).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/), timezone: z.string().min(3).max(80), confirmed: z.literal(true),
});

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["settings.read"] });
    const admin = createInsForgeAdminClient();
    const { data, error } = await admin.database.from("company_settings").select("*").eq("singleton", true).single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["settings.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("update_company_settings", {
      company_name_input: parsed.data.company_name, company_legal_name_input: parsed.data.company_legal_name,
      tax_id_input: parsed.data.tax_id, address_input: parsed.data.address, company_email_input: parsed.data.company_email,
      vat_rate_input: parsed.data.vat_rate, currency_input: parsed.data.currency, timezone_input: parsed.data.timezone,
    });
    if (error) throw error;
    return NextResponse.json({ data, message: "บันทึก Company Settings แล้ว" });
  } catch (error) { return apiError(error); }
}

