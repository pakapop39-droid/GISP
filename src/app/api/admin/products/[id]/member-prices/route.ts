import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({
  variantId: z.union([z.uuid(), z.null()]).default(null),
  confirmed: z.literal(true),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc(
      "activate_calculated_product_price",
      { product_id_input: id, variant_id_input: parsed.data.variantId },
    );
    if (error) throw error;
    return NextResponse.json(
      { data: { id: data }, message: "คำนวณและเปิดใช้ราคาสมาชิกแล้ว" },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
