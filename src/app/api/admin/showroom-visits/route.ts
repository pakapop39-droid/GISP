import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ active: true, permissions: ["visits.manage"] });
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("get_showroom_visit_queue", {});
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) { return apiError(error); }
}
