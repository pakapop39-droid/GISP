import { createHash } from "node:crypto";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

const acceptedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const maxBytes = 10 * 1024 * 1024;

function hasExpectedSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "application/pdf") return bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  if (mimeType === "image/jpeg") return bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  return false;
}

/** The pointer, tenant, Member and actual stored bytes must all agree. */
export async function loadBoundCustomerPaymentEvidence(transferId: string, allowedOrganizationId: string) {
  const admin = createInsForgeAdminClient();
  const transfer = await admin.database.from("payment_transfers")
    .select("id,organization_id,payment_schedule_id,evidence_file_id")
    .eq("id", transferId).maybeSingle();
  if (transfer.error) throw transfer.error;
  if (!transfer.data?.evidence_file_id || !transfer.data.payment_schedule_id) return null;
  if (transfer.data.organization_id !== allowedOrganizationId) return null;

  const schedule = await admin.database.from("payment_schedules")
    .select("id,organization_id,order_id")
    .eq("id", transfer.data.payment_schedule_id).maybeSingle();
  if (schedule.error) throw schedule.error;
  if (!schedule.data?.order_id || schedule.data.organization_id !== transfer.data.organization_id) return null;

  const order = await admin.database.from("customer_orders")
    .select("id,organization_id,member_profile_id")
    .eq("id", schedule.data.order_id).maybeSingle();
  if (order.error) throw order.error;
  if (!order.data?.member_profile_id || order.data.organization_id !== transfer.data.organization_id) return null;

  const file = await admin.database.from("file_metadata")
    .select("id,organization_id,member_profile_id,entity_type,entity_id,visibility,bucket,object_key,mime_type,size_bytes")
    .eq("id", transfer.data.evidence_file_id).maybeSingle();
  if (file.error) throw file.error;
  if (!file.data ||
      file.data.organization_id !== transfer.data.organization_id ||
      file.data.member_profile_id !== order.data.member_profile_id ||
      file.data.entity_type !== "CUSTOMER_PAYMENT_EVIDENCE" ||
      file.data.entity_id !== transferId ||
      file.data.visibility !== "MEMBER_PRIVATE" ||
      file.data.bucket !== "gisp-member-private" ||
      !file.data.object_key ||
      !acceptedMimeTypes.has(file.data.mime_type ?? "") ||
      !file.data.size_bytes || file.data.size_bytes > maxBytes) return null;

  const downloaded = await admin.storage.from(file.data.bucket).download(file.data.object_key);
  if (downloaded.error || !downloaded.data) return null;
  const blob = downloaded.data as Blob;
  if (blob.size !== Number(file.data.size_bytes) || blob.size > maxBytes) return null;
  const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (!hasExpectedSignature(bytes, file.data.mime_type)) return null;
  const sha256 = createHash("sha256").update(new Uint8Array(await blob.arrayBuffer())).digest("hex");
  return { blob, mimeType: file.data.mime_type, fileId: file.data.id as string, sha256, byteSize: blob.size };
}
