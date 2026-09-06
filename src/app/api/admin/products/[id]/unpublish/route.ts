import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const schema = z.object({ note: z.string().trim().min(3).max(2000), confirmed: z.literal(true) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.publish"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("unpublish_product", { product_id_input: id, note_input: parsed.data.note });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "ถอนการ Publish แล้ว" });
  } catch (error) { return apiError(error); }
}
