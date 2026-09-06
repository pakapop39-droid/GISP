import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return invalidInput();
  try {
    await requireAppAccess({ permissions: ["catalog.read"] });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database
      .from("product_prices")
      .select(
        "id,product_id,variant_id,amount,currency,valid_from,valid_until,status,suggested_resale_amount,freight_estimate_min,freight_estimate_max,formula_version_id,calculated_at,created_at",
      )
      .eq("product_id", id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    return apiError(error);
  }
}
