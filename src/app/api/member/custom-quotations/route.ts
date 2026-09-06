import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api/response";
import { quotationColumns, requireQuotationMember } from "@/lib/custom-quotation/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(request: NextRequest) {
  try {
    const context = await requireQuotationMember();
    if (!context.memberProfileId) return NextResponse.json({ data: [] });
    const db = await createInsForgeServerClient();
    let query = db.database.from("custom_quotations").select(quotationColumns)
      .eq("member_profile_id", context.memberProfileId).order("updated_at", { ascending: false }).limit(100);
    const status = request.nextUrl.searchParams.get("status");
    const requestId = request.nextUrl.searchParams.get("requestId");
    if (status) query = query.eq("status", status);
    if (requestId) query = query.eq("custom_request_id", requestId);
    const quotations = await query;
    if (quotations.error) throw quotations.error;
    const rows = quotations.data ?? [];
    const requestIds = [...new Set(rows.map((row) => row.custom_request_id))];
    const requests = requestIds.length
      ? await db.database.from("custom_requests").select("id,request_number,item_name,project_id").in("id", requestIds).limit(100)
      : { data: [], error: null };
    if (requests.error) throw requests.error;
    const projectIds = [...new Set((requests.data ?? []).map((row) => row.project_id))];
    const projects = projectIds.length
      ? await db.database.from("projects").select("id,project_number,name").in("id", projectIds).limit(100)
      : { data: [], error: null };
    if (projects.error) throw projects.error;
    const requestMap = new Map((requests.data ?? []).map((row) => [row.id, row]));
    const projectMap = new Map((projects.data ?? []).map((row) => [row.id, row]));
    return NextResponse.json({ data: rows.map((row) => {
      const customRequest = requestMap.get(row.custom_request_id);
      return {
        ...row,
        request: customRequest ? { request_number: customRequest.request_number, item_name: customRequest.item_name } : null,
        project: customRequest ? projectMap.get(customRequest.project_id) ?? null : null,
        member: { id: context.memberProfileId, company_name: context.companyName ?? "สมาชิก GISP" },
      };
    }) });
  } catch (error) { return apiError(error); }
}
