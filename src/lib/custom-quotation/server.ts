import "server-only";

import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import type { QuotationDetail, QuotationRow } from "@/lib/custom-quotation/types";

export const quotationColumns = "id,organization_id,member_profile_id,custom_request_id,quotation_number,version,status,revision_of_id,currency,subtotal,vat_rate,vat_amount,grand_total,lead_time_days,confirmed_specification,confirmed_spec_json,quote_note,valid_until,decision_reason,sent_at,responded_at,accepted_at,rejected_at,expired_at,cancelled_at,superseded_at,created_at,updated_at";
export const quotationItemColumns = "id,quotation_id,line_number,item_name,specification_snapshot,quantity,unit,unit_price,line_subtotal";
export const quotationHistoryColumns = "id,quotation_id,action,from_status,to_status,message,visibility,created_at";

export async function requireQuotationAdmin() {
  return requireAppAccess({ active: true, permissions: ["quotations.manage"] });
}

export async function requireQuotationMember() {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("MEMBER")) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
  }
  return context;
}

type DatabaseResult<T> = { data: T | null; error: { message: string } | null };

function take<T>(result: DatabaseResult<T>, label: string) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

export async function loadAdminQuotationDetail(id: string): Promise<QuotationDetail> {
  await requireQuotationAdmin();
  const admin = createInsForgeAdminClient();
  const quotation = take(await admin.database.from("custom_quotations").select(quotationColumns).eq("id", id).maybeSingle(), "load quotation") as QuotationRow | null;
  if (!quotation) throw new AppAccessError("PERMISSION_DENIED", 404, "ไม่พบใบเสนอราคา");

  const [itemsResult, requestResult, historyResult, costResult] = await Promise.all([
    admin.database.from("custom_quotation_items").select(quotationItemColumns).eq("quotation_id", id).order("line_number").limit(50),
    admin.database.from("custom_requests").select("id,request_number,item_name,project_id,status").eq("id", quotation.custom_request_id).maybeSingle(),
    admin.database.from("custom_quotation_history").select(quotationHistoryColumns).eq("quotation_id", id).order("created_at").limit(200),
    admin.database.from("custom_quotation_costs").select("supplier_id,supplier_cost_total,supplier_currency").eq("quotation_id", id).maybeSingle(),
  ]);
  const items = take(itemsResult, "load quotation items") ?? [];
  const request = take(requestResult, "load quotation request");
  const history = take(historyResult, "load quotation history") ?? [];
  const cost = take(costResult, "load quotation cost");
  const [projectResult, memberResult, candidatesResult] = await Promise.all([
    request ? admin.database.from("projects").select("id,project_number,name,site_address").eq("id", request.project_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    admin.database.from("member_profiles").select("id,company_name,contact_name").eq("id", quotation.member_profile_id).maybeSingle(),
    admin.database.from("custom_request_supplier_candidates").select("supplier_id").eq("custom_request_id", quotation.custom_request_id).eq("candidate_status", "ACTIVE").limit(50),
  ]);
  const candidateLinks = take(candidatesResult, "load quotation candidates") ?? [];
  const supplierIds = [...new Set([
    ...candidateLinks.map((row) => row.supplier_id),
    ...(cost?.supplier_id ? [cost.supplier_id] : []),
  ])];
  const suppliersResult = supplierIds.length
    ? await admin.database.from("suppliers").select("id,code,name").in("id", supplierIds).limit(50)
    : { data: [], error: null };
  const suppliers = take(suppliersResult, "load quotation suppliers") ?? [];
  const supplierMap = new Map(suppliers.map((row) => [row.id, row]));

  return {
    quotation,
    items,
    request,
    project: take(projectResult, "load quotation project"),
    member: take(memberResult, "load quotation member"),
    history,
    cost: cost ? { ...cost, supplier: supplierMap.get(cost.supplier_id) ?? null } : null,
    candidates: candidateLinks.flatMap((row) => {
      const supplier = supplierMap.get(row.supplier_id);
      return supplier ? [supplier] : [];
    }),
  } as QuotationDetail;
}

export async function loadMemberQuotationDetail(id: string): Promise<QuotationDetail> {
  const context = await requireQuotationMember();
  if (!context.memberProfileId) throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่พบข้อมูลสมาชิก");
  const db = await createInsForgeServerClient();
  const quotation = take(await db.database.from("custom_quotations").select(quotationColumns).eq("id", id).eq("member_profile_id", context.memberProfileId).maybeSingle(), "load member quotation") as QuotationRow | null;
  if (!quotation) throw new AppAccessError("PERMISSION_DENIED", 404, "ไม่พบใบเสนอราคา");
  const [itemsResult, requestResult, historyResult] = await Promise.all([
    db.database.from("custom_quotation_items").select(quotationItemColumns).eq("quotation_id", id).order("line_number").limit(50),
    db.database.from("custom_requests").select("id,request_number,item_name,project_id,status").eq("id", quotation.custom_request_id).maybeSingle(),
    db.database.from("custom_quotation_history").select(quotationHistoryColumns).eq("quotation_id", id).eq("visibility", "MEMBER").order("created_at").limit(200),
  ]);
  const request = take(requestResult, "load member quotation request");
  const [projectResult, memberResult] = await Promise.all([
    request ? db.database.from("projects").select("id,project_number,name,site_address").eq("id", request.project_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.database.from("member_profiles").select("id,company_name,contact_name").eq("id", context.memberProfileId).maybeSingle(),
  ]);
  return {
    quotation,
    items: take(itemsResult, "load member quotation items") ?? [],
    request,
    project: take(projectResult, "load member quotation project"),
    member: take(memberResult, "load member quotation profile"),
    history: take(historyResult, "load member quotation history") ?? [],
  } as QuotationDetail;
}
