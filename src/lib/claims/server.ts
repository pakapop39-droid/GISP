import "server-only";

import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import type { ClaimDetail, ClaimRow, EligibleDeliveryItem } from "@/lib/claims/types";

type DbResult<T> = { data: T | null; error: { message: string } | null };

function take<T>(result: DbResult<T>, label: string): T | null {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const claimColumns = "id,organization_id,member_profile_id,delivery_item_id,order_item_id,claim_number,issue_type,subject,description,claimed_quantity,severity,discovered_at,packaging_condition,temporary_action,status,suggested_responsibility,confirmed_responsibility,responsibility_confirmed_at,warranty_snapshot,assigned_to,target_resolution_at,information_request,resolution_type,resolution_details,resolution_executed_at,member_response,member_response_note,member_responded_at,member_confirmed_at,rejection_reason,closed_at,created_at,updated_at";

export async function requireClaimsMember() {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("MEMBER") || !context.memberProfileId) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
  }
  return context;
}

export async function requireClaimsAdmin() {
  const context = await requireAppAccess({ active: true });
  if (!context.permissions.includes("claims.manage")) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์จัดการ Claim");
  }
  return context;
}

async function attachClaimReferences(rows: Array<Record<string, unknown>>, adminMode: boolean) {
  const admin = createInsForgeAdminClient();
  const itemIds = [...new Set(rows.map((row) => String(row.order_item_id)))];
  const memberIds = adminMode ? [...new Set(rows.map((row) => String(row.member_profile_id)))] : [];
  const itemsResult = itemIds.length
    ? await admin.database.from("order_items").select("id,order_id,item_name_snapshot").in("id", itemIds).limit(500)
    : { data: [], error: null };
  const items = take(itemsResult, "load claim order items") ?? [];
  const orderIds = [...new Set(items.map((item) => item.order_id))];
  const [ordersResult, membersResult] = await Promise.all([
    orderIds.length ? admin.database.from("customer_orders").select("id,order_number").in("id", orderIds).limit(500) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? admin.database.from("member_profiles").select("id,company_name").in("id", memberIds).limit(500) : Promise.resolve({ data: [], error: null }),
  ]);
  const orders = take(ordersResult, "load claim orders") ?? [];
  const members = take(membersResult, "load claim members") ?? [];
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const memberMap = new Map(members.map((member) => [member.id, member]));
  return rows.map((row) => {
    const item = itemMap.get(String(row.order_item_id));
    const order = item ? orderMap.get(item.order_id) : undefined;
    return {
      ...row,
      item_name: item?.item_name_snapshot ?? "รายการสินค้า",
      order_number: order?.order_number ?? "—",
      ...(adminMode ? { company_name: memberMap.get(String(row.member_profile_id))?.company_name ?? "—" } : {}),
    };
  }) as unknown as ClaimRow[];
}

export async function loadMemberClaims() {
  const context = await requireClaimsMember();
  const admin = createInsForgeAdminClient();
  const result = await admin.database.from("claims").select(claimColumns)
    .eq("member_profile_id", context.memberProfileId).order("created_at", { ascending: false }).limit(200);
  return attachClaimReferences((take(result, "load member claims") ?? []) as Array<Record<string, unknown>>, false);
}

export async function loadAdminClaims() {
  await requireClaimsAdmin();
  const admin = createInsForgeAdminClient();
  const result = await admin.database.from("claims").select(claimColumns)
    .order("created_at", { ascending: false }).limit(500);
  return attachClaimReferences((take(result, "load admin claims") ?? []) as Array<Record<string, unknown>>, true);
}

export async function loadEligibleDeliveryItems(): Promise<EligibleDeliveryItem[]> {
  const context = await requireClaimsMember();
  const admin = createInsForgeAdminClient();
  const ordersResult = await admin.database.from("customer_orders").select("id,order_number")
    .eq("member_profile_id", context.memberProfileId).limit(300);
  const orders = take(ordersResult, "load member orders for claim") ?? [];
  const orderIds = orders.map((order) => order.id);
  if (!orderIds.length) return [];
  const itemsResult = await admin.database.from("order_items").select("id,order_id,item_name_snapshot").in("order_id", orderIds).limit(1000);
  const items = take(itemsResult, "load delivered order items") ?? [];
  const itemIds = items.map((item) => item.id);
  if (!itemIds.length) return [];
  const deliveryItemsResult = await admin.database.from("delivery_items")
    .select("id,delivery_id,order_item_id,quantity_delivered").in("order_item_id", itemIds).limit(1000);
  const deliveryItems = take(deliveryItemsResult, "load eligible delivery items") ?? [];
  const deliveryIds = [...new Set(deliveryItems.map((item) => item.delivery_id))];
  const deliveriesResult = deliveryIds.length
    ? await admin.database.from("deliveries").select("id,status,delivered_at").in("id", deliveryIds).limit(1000)
    : { data: [], error: null };
  const deliveries = take(deliveriesResult, "load eligible deliveries") ?? [];
  const deliveryMap = new Map(deliveries.map((delivery) => [delivery.id, delivery]));
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  return deliveryItems.flatMap((deliveryItem) => {
    const delivery = deliveryMap.get(deliveryItem.delivery_id);
    if (!delivery || !["DELIVERED", "DELIVERED_WITH_ISSUE"].includes(delivery.status)) return [];
    const item = itemMap.get(deliveryItem.order_item_id);
    if (!item) return [];
    return [{
      delivery_item_id: deliveryItem.id,
      order_item_id: item.id,
      item_name: item.item_name_snapshot,
      order_number: orderMap.get(item.order_id)?.order_number ?? "—",
      quantity_delivered: Number(deliveryItem.quantity_delivered),
      delivered_at: delivery.delivered_at,
    }];
  });
}

export async function loadClaimDetail(id: string, mode: "member" | "admin"): Promise<ClaimDetail> {
  const context = mode === "member" ? await requireClaimsMember() : await requireClaimsAdmin();
  const admin = createInsForgeAdminClient();
  let query = admin.database.from("claims").select(claimColumns).eq("id", id);
  if (mode === "member") query = query.eq("member_profile_id", context.memberProfileId ?? "");
  const rawClaim = take(await query.maybeSingle(), "load claim");
  if (!rawClaim) throw new AppAccessError("PERMISSION_DENIED", 404, "ไม่พบ Claim");
  const [claim] = await attachClaimReferences([rawClaim as Record<string, unknown>], mode === "admin");
  const [evidenceResult, eventsResult, costsResult] = await Promise.all([
    admin.database.from("claim_evidence").select("id,claim_id,file_id,evidence_type,note,is_member_visible,created_at").eq("claim_id", id).order("created_at").limit(300),
    admin.database.from("claim_events").select("id,action,note,is_member_visible,created_at").eq("claim_id", id).order("created_at").limit(500),
    mode === "admin" ? admin.database.from("claim_internal_costs").select("id,cost_type,amount,currency,internal_note,created_at").eq("claim_id", id).order("created_at").limit(100) : Promise.resolve({ data: [], error: null }),
  ]);
  const evidenceRows = (take(evidenceResult, "load claim evidence") ?? []).filter((row) => mode === "admin" || row.is_member_visible);
  const fileIds = evidenceRows.map((row) => row.file_id);
  const filesResult = fileIds.length
    ? await admin.database.from("file_metadata").select("id,original_name,mime_type").in("id", fileIds).limit(300)
    : { data: [], error: null };
  const files = take(filesResult, "load claim files") ?? [];
  const fileMap = new Map(files.map((file) => [file.id, file]));
  return {
    claim,
    evidence: evidenceRows.map((row) => ({ ...row, file: fileMap.get(row.file_id) ?? null })),
    events: (take(eventsResult, "load claim timeline") ?? []).filter((row) => mode === "admin" || row.is_member_visible),
    ...(mode === "admin" ? { internalCosts: take(costsResult, "load claim internal costs") ?? [] } : {}),
  } as unknown as ClaimDetail;
}
