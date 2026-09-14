import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { imageSearchDatabaseEnabled } from "@/lib/catalog/image-search-server";

export async function GET() {
  try {
    await requireAppAccess({ active: true, permissions: ["catalog.manage"] });
    if (!imageSearchDatabaseEnabled()) return NextResponse.json({ message: "Disabled" }, { status: 404 });
    const admin = createInsForgeAdminClient();
    const states = ["PENDING", "PROCESSING", "READY", "FAILED"];
    const counts = await Promise.all(states.map(async state => {
      const result = await admin.database.from("image_search_jobs").select("product_id", { count: "exact", head: true }).eq("state", state);
      if (result.error) throw result.error;
      return [state, result.count ?? 0];
    }));
    const failures = await admin.database.from("image_search_jobs").select("product_id,attempts,error_code,updated_at").eq("state", "FAILED").order("updated_at", { ascending: false }).limit(20);
    const budget = await admin.database.from("image_search_budget").select("enabled,used_requests,request_limit,account_daily_limit").single();
    if (failures.error) throw failures.error;
    if (budget.error) throw budget.error;
    return NextResponse.json({ data: { counts: Object.fromEntries(counts), failures: failures.data, budget: budget.data } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireAppAccess({ active: true, permissions: ["catalog.manage"] });
    if (!imageSearchDatabaseEnabled()) return NextResponse.json({ message: "Disabled" }, { status: 404 });
    const input = z.object({ productId: z.uuid() }).safeParse(await request.json().catch(() => null));
    if (!input.success) return invalidInput();
    const result = await createInsForgeAdminClient().database.rpc("queue_product_image_search", { product_input: input.data.productId, force_input: true });
    if (result.error) throw result.error;
    return NextResponse.json({ data: { queued: true } });
  } catch (error) { return apiError(error); }
}
