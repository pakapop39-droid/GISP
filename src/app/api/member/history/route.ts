import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET() {
  try {
    await requireAppAccess({ active: false, allowSuspendedHistory: true });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("get_member_history", {});
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

