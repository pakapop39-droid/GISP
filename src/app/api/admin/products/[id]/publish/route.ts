import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null) as { confirmed?: boolean } | null;
  if (!z.uuid().safeParse(id).success || body?.confirmed !== true) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.publish"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("publish_product", { product_id_input: id });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "Publish Product แล้ว" });
  } catch (error) { return apiError(error); }
}
