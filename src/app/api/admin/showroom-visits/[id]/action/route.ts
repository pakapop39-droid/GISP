import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { reviewShowroomVisitSchema } from "@/lib/projects/schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAppAccess({ active: true, permissions: ["visits.manage"] });
    const parsed = reviewShowroomVisitSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("review_showroom_visit", {
      visit_id_input: id, action_input: parsed.data.action, note_input: parsed.data.note,
    });
    if (error) throw error;
    return NextResponse.json({ data, message: parsed.data.action === "COMPLETE" ? "ปิดการเยี่ยมชมและเปิดเผย Supplier แล้ว" : "อัปเดตคำขอแล้ว" });
  } catch (error) { return apiError(error); }
}
