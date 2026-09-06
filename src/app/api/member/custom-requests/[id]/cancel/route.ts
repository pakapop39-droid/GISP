import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { cancelCustomRequestSchema } from "@/lib/custom-rfq/schema";
import { requireMember } from "@/lib/custom-rfq/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const parsed = cancelCustomRequestSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("cancel_custom_request", { request_id_input: id, reason_input: parsed.data.reason });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "ยกเลิก Custom Request แล้ว" });
  } catch (error) { return apiError(error); }
}
