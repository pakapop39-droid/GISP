import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { cancelShowroomVisitSchema } from "@/lib/projects/schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  try {
    await requireAppAccess({ active: true });
    const parsed = cancelShowroomVisitSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { visitId } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("cancel_showroom_visit", { visit_id_input: visitId, reason_input: parsed.data.reason });
    if (error) throw error;
    return NextResponse.json({ data, message: "ยกเลิกคำขอเข้าชมแล้ว" });
  } catch (error) { return apiError(error); }
}
