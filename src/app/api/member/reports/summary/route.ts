import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { getMemberDashboard } from "@/modules/reports/repository";

export async function GET() {
  try {
    await requireAppAccess({ active: true });
    const data = await getMemberDashboard();
    return NextResponse.json({ data });
  } catch (error) {
    return apiError(error);
  }
}
