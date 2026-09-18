import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export const qcReopenSchema = z.object({
  order_item_id: z.uuid(),
  reason: z.string().trim().min(3).max(1200),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "รูปแบบ JSON ไม่ถูกต้อง" }, { status: 400 });
  }
  const parsed = qcReopenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({
      message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง",
      fields: parsed.error.flatten().fieldErrors,
    }, { status: 400 });
  }
  try {
    await requireAppAccess({ active: true });
    const insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ message: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
    }
    const { data, error } = await insforge.database.rpc("reopen_qc_inspection", {
      order_item_id_input: parsed.data.order_item_id,
      reason_input: parsed.data.reason,
    });
    if (error) return apiError(error);
    // A repeated request is intentionally silent beyond the same success response;
    // the RPC owns idempotency and this route must not enqueue duplicate notices.
    return NextResponse.json({
      data,
      message: "เปิดตรวจ QC ใหม่แล้ว — ระหว่างรอตรวจ Dispatch Gate ถูกปิด",
    });
  } catch (error) {
    return apiError(error);
  }
}
