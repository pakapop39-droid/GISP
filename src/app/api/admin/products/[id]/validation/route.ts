import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc("product_validation_result", { product_id_input: id });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error) { return apiError(error); }
}
