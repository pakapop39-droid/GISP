import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { quotationRpcInput, updateQuotationSchema } from "@/lib/custom-quotation/schema";
import { loadAdminQuotationDetail, requireQuotationAdmin } from "@/lib/custom-quotation/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ data: await loadAdminQuotationDetail(id) });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireQuotationAdmin();
    const parsed = updateQuotationSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("update_custom_quotation_draft", {
      quotation_id_input: id,
      ...quotationRpcInput({ ...parsed.data, custom_request_id: id }),
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "บันทึกใบเสนอราคาร่างแล้ว" });
  } catch (error) { return apiError(error); }
}
