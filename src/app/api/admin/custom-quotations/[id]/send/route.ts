import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireQuotationAdmin } from "@/lib/custom-quotation/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireQuotationAdmin();
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("send_custom_quotation", { quotation_id_input: id });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "ส่งใบเสนอราคาให้สมาชิกแล้ว" });
  } catch (error) { return apiError(error); }
}
