import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST() {
  try {
    await requireAppAccess({ active: false });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("submit_member_application", {});
    if (error) throw error;
    return NextResponse.json({ data, message: "ส่งคำขอใหม่แล้ว" });
  } catch (error) {
    return apiError(error);
  }
}

