import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireQuotationAdmin } from "@/lib/custom-quotation/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET() {
  try {
    await requireQuotationAdmin();
    const admin = createInsForgeAdminClient();
    const requests = await admin.database.from("custom_requests")
      .select("id,request_number,item_name,specification,quantity,unit,member_profile_id,project_id")
      .eq("status", "READY_FOR_QUOTE").order("updated_at", { ascending: false }).limit(100);
    if (requests.error) throw requests.error;
    const rows = requests.data ?? [];
    const requestIds = rows.map((row) => row.id);
    const [candidates, members, projects] = await Promise.all([
      requestIds.length ? admin.database.from("custom_request_supplier_candidates").select("custom_request_id,supplier_id").in("custom_request_id", requestIds).eq("candidate_status", "ACTIVE").limit(300) : Promise.resolve({ data: [], error: null }),
      rows.length ? admin.database.from("member_profiles").select("id,company_name").in("id", [...new Set(rows.map((row) => row.member_profile_id))]).limit(100) : Promise.resolve({ data: [], error: null }),
      rows.length ? admin.database.from("projects").select("id,project_number,name").in("id", [...new Set(rows.map((row) => row.project_id))]).limit(100) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [candidates, members, projects]) if (result.error) throw result.error;
    const supplierIds = [...new Set((candidates.data ?? []).map((row) => row.supplier_id))];
    const suppliers = supplierIds.length
      ? await admin.database.from("suppliers").select("id,code,name").in("id", supplierIds).eq("status", "ACTIVE").limit(300)
      : { data: [], error: null };
    if (suppliers.error) throw suppliers.error;
    const memberMap = new Map((members.data ?? []).map((row) => [row.id, row]));
    const projectMap = new Map((projects.data ?? []).map((row) => [row.id, row]));
    const supplierMap = new Map((suppliers.data ?? []).map((row) => [row.id, row]));
    const candidateMap = new Map<string, Array<{ id: string; code: string; name: string }>>();
    for (const link of candidates.data ?? []) {
      const supplier = supplierMap.get(link.supplier_id);
      if (!supplier) continue;
      candidateMap.set(link.custom_request_id, [...(candidateMap.get(link.custom_request_id) ?? []), supplier]);
    }
    return NextResponse.json({ data: rows.map((row) => ({
      ...row,
      member: memberMap.get(row.member_profile_id) ?? null,
      project: projectMap.get(row.project_id) ?? null,
      candidates: candidateMap.get(row.id) ?? [],
    })) });
  } catch (error) { return apiError(error); }
}
