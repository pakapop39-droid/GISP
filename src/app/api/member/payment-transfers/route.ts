import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { isOrderOperationSliceVisible } from "@/lib/release-stage";

const schema = z.object({
  payment_schedule_id: z.uuid(),
  amount: z.coerce.number().positive(),
  transferred_at: z.iso.datetime(),
  evidence_file_id: z.uuid(),
});

export async function POST(request: NextRequest) {
  if (!isOrderOperationSliceVisible(8)) {
    const input = schema.safeParse(await request.clone().json().catch(() => null));
    if (input.success) {
      try {
        await requireAppAccess({ active: true });
        const client = await createInsForgeServerClient();
        const schedule = await client.database.from("payment_schedules")
          .select("schedule_type").eq("id", input.data.payment_schedule_id).maybeSingle();
        if (schedule.error) throw schedule.error;
        if (schedule.data?.schedule_type === "FREIGHT") {
          return NextResponse.json({ code: "RELEASE_NOT_ENABLED", message: "งวดค่าขนส่งยังไม่เปิดใช้งาน" }, { status: 404 });
        }
      } catch (error) { return apiError(error); }
    }
  }
  return runRpcRoute(
    request,
    schema,
    "submit_payment_transfer",
    (input) => ({
      payment_schedule_id_input: input.payment_schedule_id,
      amount_input: input.amount,
      transferred_at_input: input.transferred_at,
      evidence_file_id_input: input.evidence_file_id,
    }),
    "ส่งหลักฐานการโอนเพื่อรอ Finance ตรวจแล้ว",
    201,
  );
}
