import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { pricePreviewSchema } from "@/lib/pricing/api-schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = pricePreviewSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.uuid().safeParse(id).success || !parsed.success) {
    return invalidInput(parsed.success ? undefined : parsed.error.flatten().fieldErrors);
  }

  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("preview_product_price", {
      product_id_input: parsed.data.productId,
      variant_id_input: parsed.data.variantId,
      formula_version_id_input: id,
    });
    if (error) throw error;
    return NextResponse.json({ data, message: "คำนวณตัวอย่างราคาแล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
