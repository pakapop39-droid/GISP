import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productOptionSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = productOptionSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("save_product_option", {
      option_id_input: parsed.data.optionId,
      product_id_input: id,
      name_input: parsed.data.name,
      is_required_input: parsed.data.isRequired,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: parsed.data.optionId ? "แก้ไข Option แล้ว" : "เพิ่ม Option แล้ว" }, { status: parsed.data.optionId ? 200 : 201 });
  } catch (error) { return apiError(error); }
}
