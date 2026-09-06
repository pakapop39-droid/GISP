import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { confirmedActionSchema } from "@/lib/pricing/api-schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = confirmedActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.uuid().safeParse(id).success || !parsed.success) return invalidInput();

  try {
    await requireAppAccess({ permissions: ["catalog.formula.manage"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("activate_price_formula", {
      formula_version_id_input: id,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "เปิดใช้สูตรราคาแล้ว" });
  } catch (error) {
    return apiError(error);
  }
}
