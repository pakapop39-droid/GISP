import "server-only";

import { createInsForgeAdminClient } from "@/lib/insforge/admin";

type FileRecord = {
  id: string;
  bucket: string;
  object_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
};

// Large UUID filters can exceed the gateway's response-header limit even when
// PostgREST successfully reads the rows. Keep each metadata lookup bounded.
async function memberFileRecords(
  admin: ReturnType<typeof createInsForgeAdminClient>,
  fileIds: string[],
) {
  const ids = [...new Set(fileIds)];
  const files = new Map<string, FileRecord>();
  for (let start = 0; start < ids.length; start += 40) {
    const { data, error } = await admin.database
      .from("file_metadata")
      .select("id,bucket,object_key,original_name,mime_type,size_bytes")
      .in("id", ids.slice(start, start + 40))
      .limit(40);
    if (error) throw error;
    for (const file of (data ?? []) as FileRecord[]) files.set(file.id, file);
  }
  return files;
}

export async function signedMemberProductMedia(productIds: string[]) {
  const result = new Map<string, Array<{ id: string; url: string }>>();
  if (!productIds.length) return result;
  const admin = createInsForgeAdminClient();
  const mediaResult = await admin.database
    .from("product_media")
    .select("id,product_id,file_id,is_primary,sort_order")
    .in("product_id", productIds)
    .eq("media_type", "IMAGE")
    .order("sort_order")
    .limit(5000);
  if (mediaResult.error) throw mediaResult.error;
  const fileIds = [...new Set((mediaResult.data ?? []).map((item) => item.file_id))];
  if (!fileIds.length) return result;
  const files = await memberFileRecords(admin, fileIds);
  await Promise.all(
    (mediaResult.data ?? []).map(async (media) => {
      const file = files.get(media.file_id);
      if (!file) return;
      const signed = await admin.storage
        .from(file.bucket)
        .createSignedUrl(file.object_key, 300);
      if (signed.error || !signed.data) return;
      const items = result.get(media.product_id) ?? [];
      items.push({ id: media.id, url: signed.data.signedUrl });
      result.set(media.product_id, items);
    }),
  );
  return result;
}

export async function signedMemberDocuments(productId: string) {
  const admin = createInsForgeAdminClient();
  const documentResult = await admin.database
    .from("product_documents")
    .select("id,file_id,document_type,source_page")
    .eq("product_id", productId)
    .eq("is_member_visible", true)
    .limit(50);
  if (documentResult.error) throw documentResult.error;
  const fileIds = (documentResult.data ?? []).map((item) => item.file_id);
  if (!fileIds.length) return [];
  const files = await memberFileRecords(admin, fileIds);
  return Promise.all(
    (documentResult.data ?? []).map(async (document) => {
      const file = files.get(document.file_id);
      if (!file) return null;
      const signed = await admin.storage
        .from(file.bucket)
        .createSignedUrl(file.object_key, 300);
      if (signed.error || !signed.data) return null;
      return {
        id: document.id,
        type: document.document_type,
        sourcePage: document.source_page,
        name: file.original_name,
        mimeType: file.mime_type,
        sizeBytes: file.size_bytes,
        downloadUrl: signed.data.signedUrl,
        expiresInSeconds: 300,
      };
    }),
  ).then((items) => items.filter((item) => item !== null));
}
