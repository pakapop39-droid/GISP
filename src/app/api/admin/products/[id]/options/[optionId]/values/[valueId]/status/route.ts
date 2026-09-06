import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> }) {
  const { id, optionId, valueId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (![id, optionId, valueId].every((item) => z.uuid().safeParse(item).success) || !parsed.success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("set_product_option_value_status", {
      option_value_id_input: valueId,
      status_input: parsed.data.status,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: parsed.data.status === "ACTIVE" ? "เปิดใช้ค่า Option แล้ว" : "พักใช้ค่า Option แล้ว" });
  } catch (error) { return apiError(error); }
}
