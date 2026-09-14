import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { serializeMemberCatalogItem, type MemberCatalogViewRow } from "@/lib/catalog/member-safe";
import { signedMemberProductMedia } from "@/lib/catalog/member-server";
import { imageSearchIdentity, prepareSearchImage, rankProductImages } from "@/lib/catalog/image-search-core";
import { reserveImageSearch } from "@/lib/catalog/image-search-quota";
import { embedSearchImage, imageSearchDatabaseEnabled, imageSearchPreviewEnabled, loadImageSearchGallery, verifyImageSearchModel } from "@/lib/catalog/image-search-server";

export const runtime = "nodejs";
export const maxDuration = 120;
const fields = "id,sku,product_type,name_th,name_en,description_th,specification_summary,default_lead_time_days,country_code,width_mm,depth_mm,height_mm,weight_kg,cbm,material_summary,finish_summary,moq,category_id,category_name,price_id,member_price_before_vat,suggested_resale_amount,freight_estimate_min,freight_estimate_max,currency,published_at,available_sample_count,warranty_summary";
const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!imageSearchPreviewEnabled()) return reply("หน้าทดลองค้นหาด้วยภาพยังไม่เปิดบนระบบนี้", 404);
  try {
    const context = await requireAppAccess({ active: true });
    if (!context.roles.includes("MEMBER")) throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
    const origin = request.headers.get("origin");
    if (origin) {
      const source = URL.canParse(origin) ? new URL(origin) : null;
      const local = source && process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(source.hostname)
        && source.protocol === "http:" && source.host === request.headers.get("host");
      const hosted = origin === process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`);
      if (!local && !hosted) {
        return reply("กรุณาค้นหาผ่านหน้า GISP", 403);
      }
    }
    const bodyLimit = 3 * 1024 * 1024 + 65536;
    if (Number(request.headers.get("content-length")) > bodyLimit) return reply("รูปมีขนาดใหญ่เกินไป กรุณาเลือกผ่านหน้าค้นหาเพื่อย่อภาพก่อนส่ง", 413);
    // Bound the stream even if content-length is omitted or forged.
    const reader = request.body?.getReader();
    if (!reader) return invalidInput();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) { await reader.cancel(); return reply("รูปมีขนาดใหญ่เกินไป กรุณาเลือกผ่านหน้าค้นหาเพื่อย่อภาพก่อนส่ง", 413); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData().catch(() => null);
    const image = form?.get("image");
    const category = z.union([z.uuid(), z.literal("")]).safeParse(form?.get("categoryId") ?? "");
    if (!(image instanceof File) || !category.success) return invalidInput();
    let prepared: Buffer;
    try { prepared = await prepareSearchImage(Buffer.from(await image.arrayBuffer()), image.type); }
    catch { return reply("เปิดรูปไม่ได้ กรุณาใช้ JPEG, PNG หรือ WebP ไม่เกิน 10 MB และ 40 ล้านพิกเซล (ไม่รองรับภาพเคลื่อนไหว)", 400); }
    const databaseMode = imageSearchDatabaseEnabled();
    const client = await createInsForgeServerClient();
    const admin = createInsForgeAdminClient();
    const gallery = databaseMode ? [] : await loadImageSearchGallery();
    let indexedProducts = gallery.length;
    if (databaseMode) {
      const count = await admin.database.from("image_search_jobs").select("product_id", { count: "exact", head: true }).eq("state", "READY");
      if (count.error) throw count.error;
      indexedProducts = count.count ?? 0;
    }
    if (!indexedProducts || !process.env.OPENROUTER_API_KEY) return reply("กำลังเตรียมระบบค้นหาภาพ กรุณาลองใหม่ภายหลัง", 503);
    try { await verifyImageSearchModel(); }
    catch { return reply("กำลังตรวจสอบรุ่นโมเดลค้นหา กรุณาลองใหม่ภายหลัง", 503); }
    if (databaseMode) {
      const reservation = await admin.database.rpc("reserve_image_search_request", { user_input: context.userId });
      if (reservation.error) {
        if (reservation.error.message.includes("IMAGE_SEARCH_QUOTA")) throw new Error("IMAGE_SEARCH_QUOTA");
        throw reservation.error;
      }
    } else await reserveImageSearch(path.join(process.cwd(), "output", "image-search-preview-quota"), context.organizationId ?? context.userId);
    let query: number[];
    try { query = await embedSearchImage(prepared); }
    catch { return reply("บริการค้นหาภาพไม่ตอบกลับ กรุณาลองใหม่อีกครั้ง", 503); }
    let ranked: Array<{ productId: string; mediaId: string; fileId: string }>;
    if (databaseMode) {
      const matched = await client.database.rpc("match_product_images", { query_input: JSON.stringify(query), model_input: imageSearchIdentity, category_input: category.data || null });
      if (matched.error) throw matched.error;
      const matches = (matched.data ?? []) as Array<{ product_id: string; media_id: string }>;
      if (matches.length) {
        const indexed = await admin.database.from("product_image_embeddings").select("product_id,media_id,file_id").in("product_id", matches.map(m => m.product_id)).limit(12);
        if (indexed.error) throw indexed.error;
        ranked = matches.flatMap(m => {
          const row = indexed.data?.find(i => i.product_id === m.product_id && i.media_id === m.media_id);
          return row ? [{ productId: row.product_id, mediaId: row.media_id, fileId: row.file_id }] : [];
        });
      } else ranked = [];
    } else ranked = rankProductImages(query, gallery);
    const accepted: MemberCatalogViewRow[] = [];
    const seen = new Set<string>();
    // Scan past hidden/deleted items, so they neither leak nor displace allowed hits.
    for (let start = 0; start < ranked.length && accepted.length < 12; start += 40) {
      const batch = ranked.slice(start, start + 40);
      let catalogQuery = client.database.from("member_catalog").select(fields).in("id", batch.map(p => p.productId)).limit(100);
      if (category.data) catalogQuery = catalogQuery.eq("category_id", category.data);
      const rows = await catalogQuery;
      if (rows.error) throw rows.error;
      const allowed = new Map((rows.data as MemberCatalogViewRow[] ?? []).map(row => [row.id, row]));
      if (!allowed.size) continue;
      const media = await admin.database.from("product_media").select("id,product_id,file_id")
        .in("id", batch.filter(p => allowed.has(p.productId)).map(p => p.mediaId)).eq("media_type", "IMAGE").limit(40);
      if (media.error) throw media.error;
      for (const candidate of batch) {
        const row = allowed.get(candidate.productId);
        if (row && !seen.has(row.id) && media.data?.some(m => m.id === candidate.mediaId && m.product_id === row.id && m.file_id === candidate.fileId)) {
          seen.add(row.id); accepted.push(row);
          if (accepted.length === 12) break;
        }
      }
    }
    // Recheck publication/price/visibility immediately before signing media.
    if (!accepted.length) return NextResponse.json({ data: { items: [], indexedProducts } }, { headers: { "Cache-Control": "no-store" } });
    const final = await client.database.from("member_catalog").select(fields).in("id", accepted.map(r => r.id)).limit(100);
    if (final.error) throw final.error;
    const current = new Map((final.data as MemberCatalogViewRow[] ?? []).map(r => [r.id, r]));
    const visible = accepted.flatMap(r => current.has(r.id) ? [current.get(r.id)!] : []);
    const media = await signedMemberProductMedia(visible.map(r => r.id));
    const indexedMedia = new Map(ranked.map(item => [item.productId, item.mediaId]));
    return NextResponse.json({ data: { items: visible.map(row => serializeMemberCatalogItem(row, media.get(row.id)?.find(image => image.id === indexedMedia.get(row.id))?.url ?? null)), indexedProducts } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "IMAGE_SEARCH_QUOTA") return reply("ค้นหาถี่เกินไปหรือครบโควตาทดลองแล้ว กรุณาเว้นช่วงก่อนลองใหม่ หรือติดต่อทีม GISP", 429);
    return apiError(error);
  }
}
