import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { quotationAdminActionSchema } from "@/lib/custom-quotation/schema";
import { requireQuotationAdmin } from "@/lib/custom-quotation/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireQuotationAdmin();
    const parsed = quotationAdminActionSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("admin_transition_custom_quotation", {
      quotation_id_input: id,
      action_input: parsed.data.action,
      reason_input: parsed.data.reason ?? "",
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: parsed.data.action === "CANCEL" ? "ยกเลิกใบเสนอราคาแล้ว" : "อัปเดตใบเสนอราคาเป็นหมดอายุแล้ว" });
  } catch (error) { return apiError(error); }
}
