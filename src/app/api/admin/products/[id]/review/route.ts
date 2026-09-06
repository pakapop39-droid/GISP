import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { productReviewSchema } from "@/lib/catalog/api-schema";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = productReviewSchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  try {
    await requireAppAccess({ permissions: ["catalog.publish"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("review_catalog_product", { product_id_input: id, decision_input: parsed.data.decision, note_input: parsed.data.note });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: parsed.data.decision === "PASSED" ? "Product ผ่าน Review แล้ว" : "ส่ง Product กลับไปแก้ไขแล้ว" });
  } catch (error) { return apiError(error); }
}
