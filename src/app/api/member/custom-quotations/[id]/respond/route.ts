import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { quotationResponseSchema } from "@/lib/custom-quotation/schema";
import { requireQuotationMember } from "@/lib/custom-quotation/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireQuotationMember();
    const parsed = quotationResponseSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("respond_custom_quotation", {
      quotation_id_input: id,
      response_input: parsed.data.response,
      reason_input: parsed.data.reason ?? "",
    });
    if (error) throw error;
    const result = data as { status?: string } | null;
    return NextResponse.json({
      data: result,
      message: result?.status === "EXPIRED"
        ? "ใบเสนอราคาหมดอายุแล้ว กรุณารอ Revision ใหม่"
        : parsed.data.response === "ACCEPTED"
          ? "ยอมรับใบเสนอราคาและสร้างรายการในโครงการแล้ว"
          : "ส่งเหตุผลปฏิเสธใบเสนอราคาแล้ว",
    });
  } catch (error) { return apiError(error); }
}
