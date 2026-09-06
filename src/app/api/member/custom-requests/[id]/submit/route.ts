import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireMember } from "@/lib/custom-rfq/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("submit_custom_request_v2", { request_id_input: id });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "ส่ง Custom Request ให้ GISP ตรวจสอบแล้ว" });
  } catch (error) { return apiError(error); }
}
