import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { sharedCatalogItemSchema, sharedCatalogRemoveItemSchema } from "@/lib/shared-catalog/schema";
import { requireMember } from "@/lib/shared-catalog/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const parsed = sharedCatalogItemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("set_shared_catalog_item", {
      catalog_id_input: id, product_id_input: parsed.data.productId,
      customer_price_input: null, sort_order_input: parsed.data.sortOrder,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "เพิ่มสินค้าใน Catalog แล้ว" });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMember();
    const parsed = sharedCatalogRemoveItemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { error } = await db.database.rpc("remove_shared_catalog_item", { catalog_id_input: id, product_id_input: parsed.data.productId });
    if (error) throw error;
    return NextResponse.json({ message: "นำสินค้าออกแล้ว" });
  } catch (error) { return apiError(error); }
}
