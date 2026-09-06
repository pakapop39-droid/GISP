import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { supplierCandidatesSchema } from "@/lib/custom-rfq/schema";
import { requireRfqAdmin } from "@/lib/custom-rfq/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRfqAdmin();
    const parsed = supplierCandidatesSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const { id } = await params;
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("admin_set_custom_request_candidates", {
      request_id_input: id, supplier_ids_input: parsed.data.supplierIds,
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "บันทึก Supplier Candidate แล้ว" });
  } catch (error) { return apiError(error); }
}
