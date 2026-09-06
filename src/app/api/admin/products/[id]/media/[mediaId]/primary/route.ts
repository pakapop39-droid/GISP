import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const { id, mediaId } = await params;
  const body = await request.json().catch(() => null) as { confirmed?: boolean } | null;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(mediaId).success || body?.confirmed !== true) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("set_product_primary_media", { product_id_input: id, media_id_input: mediaId });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "ตั้งเป็นรูปหลักแล้ว" });
  } catch (error) { return apiError(error); }
}
