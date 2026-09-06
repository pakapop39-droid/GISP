import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const [countries, categories] = await Promise.all([
      insforge.database.from("countries").select("code,name_th,name_en").eq("status", "ACTIVE").order("sort_order").limit(100),
      insforge.database.from("categories").select("id,code,name_th,name_en,parent_id").eq("status", "ACTIVE").order("sort_order").limit(500),
    ]);
    if (countries.error) throw countries.error;
    if (categories.error) throw categories.error;
    return NextResponse.json({ data: { countries: countries.data ?? [], categories: categories.data ?? [] } });
  } catch (error) {
    return apiError(error);
  }
}
