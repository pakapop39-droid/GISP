import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({ status: z.enum(["ACTIVE", "INACTIVE"]) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const { id, variantId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(variantId).success || !parsed.success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("set_product_variant_status", { variant_id_input: variantId, status_input: parsed.data.status });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: parsed.data.status === "ACTIVE" ? "เปิดใช้ Variant แล้ว" : "พักใช้ Variant แล้ว" });
  } catch (error) { return apiError(error); }
}
