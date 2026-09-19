import { NextResponse } from "next/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { hasTargetOrganizationPermission } from "@/lib/orders/organization-access";

export function productionMediaReferencesMatch(input: { supplierOrderOrganizationId: string; customerOrderOrganizationId: string; hasMatchingProductionUpdate: boolean; fileOrganizationId: string }) {
  return input.customerOrderOrganizationId === input.supplierOrderOrganizationId && input.hasMatchingProductionUpdate && input.fileOrganizationId === input.supplierOrderOrganizationId;
}

export async function GET(_request: Request, { params }: { params: Promise<{ supplierOrderId: string; fileId: string }> }) {
  try {
    await requireAppAccess({ active: true });
    const { supplierOrderId, fileId } = await params;
    const admin = createInsForgeAdminClient();
    const supplierOrder = await admin.database.from("supplier_orders").select("id,organization_id,customer_order_id").eq("id", supplierOrderId).maybeSingle();
    if (supplierOrder.error) throw supplierOrder.error;
    if (!supplierOrder.data || !await hasTargetOrganizationPermission("shipments.manage", supplierOrder.data.organization_id)) {
      return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบไฟล์ Timeline ที่มีสิทธิ์ดู" }, { status: 404 });
    }
    const customerOrder = supplierOrder.data ? await admin.database.from("customer_orders").select("id,organization_id").eq("id", supplierOrder.data.customer_order_id).maybeSingle() : { data: null, error: null };
    if (customerOrder.error) throw customerOrder.error;
    const links = await admin.database.from("production_update_files")
      .select("production_update_id,file_id").eq("file_id", fileId).limit(100);
    if (links.error) throw links.error;
    const linkedUpdateIds = [...new Set((links.data ?? []).map((link) => link.production_update_id))];
    const matchingUpdates = linkedUpdateIds.length
      ? await admin.database.from("production_updates").select("id,supplier_order_id")
        .in("id", linkedUpdateIds).eq("supplier_order_id", supplierOrderId).limit(1)
      : { data: [], error: null };
    if (matchingUpdates.error) throw matchingUpdates.error;
    const file = await admin.database.from("file_metadata").select("id,organization_id,bucket,object_key").eq("id", fileId).maybeSingle();
    if (file.error) throw file.error;
    if (!customerOrder.data || !file.data || !productionMediaReferencesMatch({ supplierOrderOrganizationId: supplierOrder.data.organization_id, customerOrderOrganizationId: customerOrder.data.organization_id, hasMatchingProductionUpdate: (matchingUpdates.data ?? []).length > 0, fileOrganizationId: file.data.organization_id })) return NextResponse.json({ code: "NOT_FOUND", message: "ไม่พบไฟล์ Timeline ที่มีสิทธิ์ดู" }, { status: 404 });
    const signed = await admin.storage.from(file.data.bucket).createSignedUrl(file.data.object_key, 300);
    if (signed.error || !signed.data) throw signed.error ?? new Error("SIGNED_URL_FAILED");
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) { return apiError(error); }
}
