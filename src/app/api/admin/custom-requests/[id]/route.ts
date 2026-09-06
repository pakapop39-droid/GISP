import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { adminCustomRequestActionSchema } from "@/lib/custom-rfq/schema";
import { requireRfqAdmin } from "@/lib/custom-rfq/server";
import { getAdminCustomRequestActionFeedback } from "@/lib/custom-rfq/workflow";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRfqAdmin();
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("get_admin_custom_request_detail", { request_id_input: id });
    if (error) throw error;
    if (!data) return NextResponse.json({ message: "ไม่พบ Custom Request" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRfqAdmin();
    const parsed = adminCustomRequestActionSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("admin_review_custom_request", {
      request_id_input: id,
      action_input: parsed.data.action,
      message_input: parsed.data.message,
      assigned_to_input: parsed.data.assignedTo,
      due_at_input: parsed.data.dueAt,
    });
    if (error) throw error;
    return NextResponse.json({
      data: { id: data },
      message: getAdminCustomRequestActionFeedback(parsed.data.action),
    });
  } catch (error) { return apiError(error); }
}
