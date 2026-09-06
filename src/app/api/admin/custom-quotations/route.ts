import { NextResponse, type NextRequest } from "next/server";
import { apiError, invalidInput } from "@/lib/api/response";
import { createQuotationSchema, quotationRpcInput } from "@/lib/custom-quotation/schema";
import { quotationColumns, requireQuotationAdmin } from "@/lib/custom-quotation/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export async function GET(request: NextRequest) {
  try {
    await requireQuotationAdmin();
    const admin = createInsForgeAdminClient();
    let query = admin.database.from("custom_quotations").select(quotationColumns).order("updated_at", { ascending: false }).limit(200);
    const status = request.nextUrl.searchParams.get("status");
    const requestId = request.nextUrl.searchParams.get("requestId");
    if (status) query = query.eq("status", status);
    if (requestId) query = query.eq("custom_request_id", requestId);
    const quotations = await query;
    if (quotations.error) throw quotations.error;
    const rows = quotations.data ?? [];
    const requestIds = [...new Set(rows.map((row) => row.custom_request_id))];
    const memberIds = [...new Set(rows.map((row) => row.member_profile_id))];
    const requests = requestIds.length
      ? await admin.database.from("custom_requests").select("id,request_number,item_name,project_id").in("id", requestIds).limit(200)
      : { data: [], error: null };
    if (requests.error) throw requests.error;
    const projectIds = [...new Set((requests.data ?? []).map((row) => row.project_id))];
    const [projects, members] = await Promise.all([
      projectIds.length ? admin.database.from("projects").select("id,project_number,name").in("id", projectIds).limit(200) : Promise.resolve({ data: [], error: null }),
      memberIds.length ? admin.database.from("member_profiles").select("id,company_name").in("id", memberIds).limit(200) : Promise.resolve({ data: [], error: null }),
    ]);
    if (projects.error) throw projects.error;
    if (members.error) throw members.error;
    const requestMap = new Map((requests.data ?? []).map((row) => [row.id, row]));
    const projectMap = new Map((projects.data ?? []).map((row) => [row.id, row]));
    const memberMap = new Map((members.data ?? []).map((row) => [row.id, row]));
    return NextResponse.json({ data: rows.map((row) => {
      const customRequest = requestMap.get(row.custom_request_id);
      return {
        ...row,
        request: customRequest ? { request_number: customRequest.request_number, item_name: customRequest.item_name } : null,
        project: customRequest ? projectMap.get(customRequest.project_id) ?? null : null,
        member: memberMap.get(row.member_profile_id) ?? null,
      };
    }) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireQuotationAdmin();
    const parsed = createQuotationSchema.safeParse(await request.json());
    if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);
    const db = await createInsForgeServerClient();
    const { data, error } = await db.database.rpc("create_custom_quotation", {
      custom_request_id_input: parsed.data.custom_request_id,
      ...quotationRpcInput(parsed.data),
    });
    if (error) throw error;
    return NextResponse.json({ data: { id: data }, message: "สร้างใบเสนอราคาร่างแล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
