import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const idSchema = z.uuid();
const allowedTypes = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
  ["video/mp4", "mp4"], ["application/pdf", "pdf"],
]);
const maxBytes = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const context = await requireAppAccess({ active: true });
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    const entityId = String(form.get("entityId") ?? "");
    const permission = kind === "PRODUCTION_MEDIA" ? "production.manage"
      : kind === "DELIVERY_EVIDENCE" ? "deliveries.manage" : "qc.manage";
    if (!context.permissions.includes(permission)) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่มีสิทธิ์อัปโหลดหลักฐานส่วนนี้");
    }
    if (!(file instanceof File) || !idSchema.safeParse(entityId).success
      || !["PRODUCTION_MEDIA", "QC_EVIDENCE", "DELIVERY_EVIDENCE"].includes(kind)
      || file.size <= 0 || file.size > maxBytes || !allowedTypes.has(file.type)) {
      return NextResponse.json({ code: "INVALID_FILE", message: "รองรับ JPG, PNG, WebP, MP4, PDF ขนาดไม่เกิน 25 MB" }, { status: 400 });
    }
    const admin = createInsForgeAdminClient();
    let organizationId: string | undefined;
    let memberProfileId: string | undefined;
    if (kind === "PRODUCTION_MEDIA") {
      const row = await admin.database.from("supplier_orders").select("id,organization_id,customer_order_id").eq("id", entityId).maybeSingle();
      if (row.error) throw row.error;
      if (row.data) {
        organizationId = row.data.organization_id;
        const order = await admin.database.from("customer_orders").select("member_profile_id").eq("id", row.data.customer_order_id).maybeSingle();
        if (order.error) throw order.error;
        memberProfileId = order.data?.member_profile_id;
      }
    } else if (kind === "QC_EVIDENCE") {
      const item = await admin.database.from("order_items").select("id,organization_id,order_id").eq("id", entityId).maybeSingle();
      if (item.error) throw item.error;
      if (item.data) {
        organizationId = item.data.organization_id;
        const order = await admin.database.from("customer_orders").select("member_profile_id").eq("id", item.data.order_id).maybeSingle();
        if (order.error) throw order.error;
        memberProfileId = order.data?.member_profile_id;
      }
    } else {
      const delivery = await admin.database.from("deliveries")
        .select("id,organization_id,customer_order_id").eq("id", entityId).maybeSingle();
      if (delivery.error) throw delivery.error;
      if (delivery.data) {
        organizationId = delivery.data.organization_id;
        const order = await admin.database.from("customer_orders").select("member_profile_id")
          .eq("id", delivery.data.customer_order_id).maybeSingle();
        if (order.error) throw order.error;
        memberProfileId = order.data?.member_profile_id;
      }
    }
    if (!organizationId || !memberProfileId || (context.organizationId && organizationId !== context.organizationId)) {
      throw new AppAccessError("PERMISSION_DENIED", 403, "ไม่พบรายการที่อัปโหลดหลักฐาน");
    }
    const extension = allowedTypes.get(file.type)!;
    const key = `operations/${kind.toLowerCase()}/${entityId}/${randomUUID()}.${extension}`;
    const uploaded = await admin.storage.from("gisp-member-private").upload(key, file);
    if (uploaded.error || !uploaded.data) throw uploaded.error ?? new Error("UPLOAD_FAILED");
    const storageData = uploaded.data as unknown as { url?: string; key?: string };
    const objectKey = storageData.key ?? key;
    const inserted = await admin.database.from("file_metadata").insert([{
      organization_id: organizationId, member_profile_id: memberProfileId,
      bucket: "gisp-member-private", object_key: objectKey, url: storageData.url ?? null,
      original_name: file.name, mime_type: file.type, size_bytes: file.size,
      visibility: "MEMBER_PRIVATE", entity_type: kind, entity_id: entityId,
      uploaded_by: context.userId,
    }]).select("id,original_name,mime_type,size_bytes").single();
    if (inserted.error || !inserted.data) {
      await admin.storage.from("gisp-member-private").remove(objectKey);
      throw inserted.error ?? new Error("FILE_METADATA_FAILED");
    }
    return NextResponse.json({ data: inserted.data, message: "อัปโหลดหลักฐานแล้ว" }, { status: 201 });
  } catch (error) { return apiError(error); }
}
