import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { updateProjectItemSchema } from "@/lib/projects/schema";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  try {
    await requireAppAccess({ active: true });
    const parsed = updateProjectItemSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { itemId } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("update_project_item_v2", {
      project_item_id_input: itemId,
      area_id_input: parsed.data.areaId,
      variant_id_input: parsed.data.variantId,
      selected_options_input: parsed.data.selectedOptions,
      quantity_input: parsed.data.quantity,
    });
    if (error) throw error;
    return NextResponse.json({ data, message: "แก้ไขรายการสินค้าแล้ว" });
  } catch (error) { return apiError(error); }
}
