import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { customRequestInputSchema } from "@/lib/custom-rfq/schema";
import { customRequestRpcInput, requireMember } from "@/lib/custom-rfq/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("get_member_custom_request_detail", { request_id_input: id });
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "ไม่พบ Custom Request" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const parsed = customRequestInputSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("save_custom_request_details", { request_id_input: id, ...customRequestRpcInput(parsed.data) });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "บันทึกข้อมูล Custom Request แล้ว" });
  } catch (error) { return apiError(error); }
}
