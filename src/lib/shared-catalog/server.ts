import "server-only";

import { AppAccessError, requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import {
  serializePublicCatalogItem,
  type PublicCatalogVersionItem,
} from "./public-safe";
import type { SharedCatalogRow, SharedCatalogScope } from "./types";

type BrowseQuery = {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
};

type SafeLiveProductRow = {
  id: string;
  sku: string;
  product_type: string;
  name_th: string;
  name_en: string | null;
  description_th: string | null;
  specification_summary: string | null;
  default_lead_time_days: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  material_summary: string | null;
  finish_summary: string | null;
  category_name: string | null;
  published_at: string;
};

type ViewHeader = {
  title: string;
  introduction: string | null;
  brand_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  line_url: string | null;
  logo_file_id: string | null;
  scope_type: SharedCatalogScope;
  published_at: string | null;
  expires_at: string | null;
};

function chunkIds(ids: string[], size = 50) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export type SharedCatalogView = {
  title: string;
  introduction: string | null;
  scopeType: SharedCatalogScope;
  brand: {
    name: string;
    logoUrl: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
    lineUrl: string | null;
  };
  publishedAt: string | null;
  expiresAt: string | null;
  categories: Array<{ name: string; count: number }>;
  notices: string[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  items: ReturnType<typeof serializePublicCatalogItem>[];
};

export const sharedCatalogColumns =
  "id,title,introduction,brand_name,contact_name,contact_phone,contact_email,line_url,logo_file_id,price_mode,scope_type,source_product_id,source_project_id,status,share_token,expires_at,current_version_id,published_at,created_at,updated_at";

export async function requireMember() {
  const context = await requireAppAccess({ active: true });
  if (!context.roles.includes("MEMBER")) {
    throw new AppAccessError("PERMISSION_DENIED", 403, "หน้านี้สำหรับสมาชิก");
  }
  return context;
}

async function signedFiles(fileIds: string[]) {
  const result = new Map<string, string>();
  const ids = [...new Set(fileIds)];
  if (!ids.length) return result;
  const admin = createInsForgeAdminClient();
  const files = await admin.database
    .from("file_metadata")
    .select("id,bucket,object_key")
    .in("id", ids)
    .limit(100);
  if (files.error) throw files.error;
  await Promise.all((files.data ?? []).map(async (file) => {
    const signed = await admin.storage.from(file.bucket).createSignedUrl(file.object_key, 300);
    if (!signed.error && signed.data) result.set(file.id, signed.data.signedUrl);
  }));
  return result;
}

async function primaryImageFiles(productIds: string[]) {
  const result = new Map<string, string>();
  if (!productIds.length) return result;
  const admin = createInsForgeAdminClient();
  const media = await admin.database
    .from("product_media")
    .select("product_id,file_id,is_primary,sort_order,created_at")
    .in("product_id", [...new Set(productIds)])
    .eq("media_type", "IMAGE")
    .order("is_primary", { ascending: false })
    .order("sort_order")
    .order("created_at")
    .limit(1000);
  if (media.error) throw media.error;
  for (const item of media.data ?? []) {
    if (!result.has(item.product_id)) result.set(item.product_id, item.file_id);
  }
  return result;
}

async function loadEligibleProductRows(productIds?: string[]) {
  const admin = createInsForgeAdminClient();
  const requestedIds = productIds ? [...new Set(productIds)] : null;
  if (requestedIds && !requestedIds.length) return [];

  const selectProducts = () => admin.database
    .from("products")
    .select(
      "id,sku,product_type,name_th,name_en,description_th,specification_summary,default_lead_time_days,width_mm,depth_mm,height_mm,material_summary,finish_summary,category_id,published_at",
    )
    .eq("status", "PUBLISHED")
    .eq("qa_status", "PASSED")
    .eq("product_type", "STANDARD")
    .order("id");
  const productRows = [];
  if (requestedIds) {
    for (const batch of chunkIds(requestedIds)) {
      const result = await selectProducts().in("id", batch).limit(50);
      if (result.error) throw result.error;
      productRows.push(...(result.data ?? []));
    }
  } else {
    const pageSize = 150;
    for (let offset = 0; ; offset += pageSize) {
      const result = await selectProducts().range(offset, offset + pageSize - 1);
      if (result.error) throw result.error;
      const rows = result.data ?? [];
      productRows.push(...rows);
      if (rows.length < pageSize) break;
    }
  }

  const ids = productRows.map((row) => row.id);
  if (!ids.length) return [];
  const categoryIds = [...new Set(productRows.map((row) => row.category_id).filter(Boolean))] as string[];
  const priceResults = [];
  for (const batch of chunkIds(ids)) {
    const result = await admin.database.from("product_prices")
      .select("product_id,valid_from,valid_until")
      .in("product_id", batch)
      .is("variant_id", null)
      .eq("price_type", "MEMBER")
      .eq("status", "ACTIVE")
      .limit(200);
    if (result.error) throw result.error;
    priceResults.push(result);
  }
  const categoryResults = [];
  for (const batch of chunkIds(categoryIds)) {
    const result = await admin.database.from("categories")
      .select("id,name_th")
      .in("id", batch)
      .limit(100);
    if (result.error) throw result.error;
    categoryResults.push(result);
  }
  const prices = priceResults.flatMap((result) => result.data ?? []);
  const categories = categoryResults.flatMap((result) => result.data ?? []);
  const now = Date.now();
  const priced = new Set(prices.filter((price) =>
    new Date(price.valid_from).getTime() <= now &&
    (!price.valid_until || new Date(price.valid_until).getTime() > now))
    .map((price) => price.product_id));
  const categoryNames = new Map(categories.map((category) => [category.id, category.name_th]));
  return productRows.filter((row) => priced.has(row.id)).map((row) => ({
    ...row,
    category_name: row.category_id ? categoryNames.get(row.category_id) ?? null : null,
  })) as SafeLiveProductRow[];
}

function liveRowToSource(row: SafeLiveProductRow): PublicCatalogVersionItem {
  return {
    id: row.id,
    product_id: row.id,
    image_file_id: null,
    sku: row.sku,
    product_type: row.product_type,
    name_th: row.name_th,
    name_en: row.name_en,
    description_th: row.description_th,
    specification_summary: row.specification_summary,
    category_name: row.category_name,
    lead_time_days: row.default_lead_time_days,
    width_mm: row.width_mm,
    depth_mm: row.depth_mm,
    height_mm: row.height_mm,
    material_summary: row.material_summary,
    finish_summary: row.finish_summary,
    sort_order: 0,
    selected_options: [],
  };
}

async function availableSnapshotProductIds(productIds: string[]) {
  return new Set((await loadEligibleProductRows(productIds)).map((product) => product.id));
}

function normalizeQuery(query: BrowseQuery) {
  const rawPage = Number.isFinite(query.page) ? Number(query.page) : 1;
  const rawPageSize = Number.isFinite(query.pageSize) ? Number(query.pageSize) : 24;
  return {
    search: (query.search ?? "").trim().toLocaleLowerCase("th").slice(0, 120),
    category: (query.category ?? "").trim().slice(0, 160),
    page: Math.max(1, Math.trunc(rawPage)),
    pageSize: Math.min(60, Math.max(12, Math.trunc(rawPageSize))),
  };
}

async function buildView(
  header: ViewHeader,
  sourceRows: PublicCatalogVersionItem[],
  availableIds: Set<string>,
  queryInput: BrowseQuery = {},
): Promise<SharedCatalogView> {
  const query = normalizeQuery(queryInput);
  const categoryCounts = new Map<string, number>();
  for (const row of sourceRows) {
    const name = row.category_name?.trim();
    if (name) categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }
  const filtered = sourceRows.filter((row) => {
    if (query.category && row.category_name !== query.category) return false;
    if (!query.search) return true;
    return [
      row.sku, row.name_th, row.name_en, row.description_th,
      row.specification_summary, row.material_summary, row.finish_summary,
      row.category_name, row.project_area_name,
    ].filter(Boolean).join(" ").toLocaleLowerCase("th").includes(query.search);
  });
  filtered.sort((left, right) =>
    left.sort_order - right.sort_order || left.name_th.localeCompare(right.name_th, "th"));
  const pageSize = header.scope_type === "PRODUCT" ? 12 : query.pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(query.page, totalPages);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const missingImageProductIds = pageRows
    .filter((row) => !row.image_file_id)
    .map((row) => row.product_id);
  const primaryImages = await primaryImageFiles(missingImageProductIds);
  const itemRows = pageRows.map((row) => ({
    ...row,
    image_file_id: row.image_file_id ?? primaryImages.get(row.product_id) ?? null,
  }));
  const fileIds = [
    header.logo_file_id,
    ...itemRows.map((item) => item.image_file_id),
  ].filter((id): id is string => Boolean(id));
  const urls = await signedFiles(fileIds);
  return {
    title: header.title,
    introduction: header.introduction,
    scopeType: header.scope_type,
    brand: {
      name: header.brand_name,
      logoUrl: header.logo_file_id ? urls.get(header.logo_file_id) ?? null : null,
      contactName: header.contact_name,
      contactPhone: header.contact_phone,
      contactEmail: header.contact_email,
      lineUrl: header.line_url,
    },
    publishedAt: header.published_at,
    expiresAt: header.expires_at,
    categories: [...categoryCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => left.name.localeCompare(right.name, "th")),
    notices: header.scope_type === "PROJECT"
      ? ["แสดงเฉพาะสินค้ามาตรฐานที่พร้อมขาย รายการ Custom หรือรายการที่ยังไม่พร้อมจะไม่แสดง"]
      : header.scope_type === "FULL_CATALOG"
        ? ["รายการสินค้าและหมวดจะอัปเดตตามสินค้าที่พร้อมขายในระบบ"]
        : [],
    pagination: { page, pageSize, total: filtered.length, totalPages },
    items: itemRows.map((item) =>
      serializePublicCatalogItem(
        item,
        item.image_file_id ? urls.get(item.image_file_id) ?? null : null,
        availableIds.has(item.product_id),
      )),
  };
}

export async function loadMemberSharedCatalog(catalogId: string, memberProfileId: string) {
  const admin = createInsForgeAdminClient();
  const catalogResult = await admin.database
    .from("shared_catalogs")
    .select(sharedCatalogColumns)
    .eq("id", catalogId)
    .eq("member_profile_id", memberProfileId)
    .maybeSingle();
  if (catalogResult.error) throw catalogResult.error;
  if (!catalogResult.data) return null;
  const itemsResult = await admin.database
    .from("shared_catalog_items")
    .select("id,catalog_id,product_id,sort_order")
    .eq("catalog_id", catalogId)
    .order("sort_order")
    .limit(500);
  if (itemsResult.error) throw itemsResult.error;
  const productIds = (itemsResult.data ?? []).map((item) => item.product_id);
  const products = new Map((await loadEligibleProductRows(productIds)).map((product) => [
    product.id,
    {
      id: product.id,
      sku: product.sku,
      name_th: product.name_th,
      name_en: product.name_en,
      product_type: product.product_type,
      category_name: product.category_name,
      status: "PUBLISHED",
      published_at: product.published_at,
    },
  ]));
  return {
    catalog: catalogResult.data as SharedCatalogRow,
    items: (itemsResult.data ?? []).map((item) => ({
      ...item,
      product: products.get(item.product_id) ?? null,
    })),
  };
}

async function draftRows(catalog: SharedCatalogRow, draftItems: Array<{ id: string; product_id: string; sort_order: number }>) {
  if (catalog.scope_type === "FULL_CATALOG") {
    return (await loadEligibleProductRows()).map(liveRowToSource);
  }
  if (catalog.scope_type === "PRODUCT") {
    return (await loadEligibleProductRows(catalog.source_product_id ? [catalog.source_product_id] : []))
      .map(liveRowToSource);
  }
  if (catalog.scope_type === "CURATED") {
    const products = new Map((await loadEligibleProductRows(draftItems.map((item) => item.product_id)))
      .map((row) => [row.id, row]));
    return draftItems.flatMap((item) => {
      const row = products.get(item.product_id);
      return row ? [{ ...liveRowToSource(row), id: item.id, sort_order: item.sort_order }] : [];
    });
  }

  const admin = createInsForgeAdminClient();
  const projectItems = await admin.database
    .from("project_items")
    .select("id,product_id,area_id,item_type,status,specification_snapshot,selected_options,lead_time_days_snapshot,created_at")
    .eq("project_id", catalog.source_project_id ?? "")
    .eq("item_type", "STANDARD")
    .order("created_at")
    .limit(500);
  if (projectItems.error) throw projectItems.error;
  const usableItems = (projectItems.data ?? []).filter((item) =>
    item.product_id && item.status !== "CANCELLED");
  const [products, areas] = await Promise.all([
    loadEligibleProductRows(usableItems.map((item) => item.product_id)),
    admin.database
      .from("project_areas")
      .select("id,name,sort_order")
      .eq("project_id", catalog.source_project_id ?? "")
      .order("sort_order")
      .limit(200),
  ]);
  if (areas.error) throw areas.error;
  const productsById = new Map(products.map((row) => [row.id, row]));
  const areasById = new Map((areas.data ?? []).map((area) => [area.id, area.name]));
  return usableItems.flatMap((item, index) => {
    const row = productsById.get(item.product_id);
    if (!row) return [];
    return [{
      ...liveRowToSource(row),
      id: item.id,
      specification_summary: item.specification_snapshot ?? row.specification_summary,
      lead_time_days: item.lead_time_days_snapshot ?? row.default_lead_time_days,
      project_area_name: item.area_id ? areasById.get(item.area_id) ?? null : null,
      selected_options: Array.isArray(item.selected_options) ? item.selected_options : [],
      sort_order: index,
    }];
  });
}

export async function loadMemberSharedCatalogPreview(
  catalogId: string,
  memberProfileId: string,
  query: BrowseQuery = {},
): Promise<SharedCatalogView | null> {
  const draft = await loadMemberSharedCatalog(catalogId, memberProfileId);
  if (!draft) return null;
  const rows = await draftRows(draft.catalog, draft.items);
  const header: ViewHeader = {
    title: draft.catalog.title,
    introduction: draft.catalog.introduction,
    brand_name: draft.catalog.brand_name,
    contact_name: draft.catalog.contact_name,
    contact_phone: draft.catalog.contact_phone,
    contact_email: draft.catalog.contact_email,
    line_url: draft.catalog.line_url,
    logo_file_id: draft.catalog.logo_file_id,
    scope_type: draft.catalog.scope_type,
    published_at: null,
    expires_at: draft.catalog.expires_at,
  };
  return buildView(header, rows, new Set(rows.map((row) => row.product_id)), query);
}

export async function loadPublicSharedCatalog(
  token: string,
  query: BrowseQuery = {},
): Promise<SharedCatalogView | null> {
  const published = await loadPublicCatalogHeader(token);
  if (!published) return null;
  const { admin, header } = published;
  if (header.scope_type === "FULL_CATALOG") {
    const rows = (await loadEligibleProductRows()).map(liveRowToSource);
    return buildView(header, rows, new Set(rows.map((row) => row.product_id)), query);
  }
  const itemsResult = await admin.database
    .from("shared_catalog_version_items")
    .select("id,product_id,image_file_id,sku,product_type,name_th,name_en,description_th,specification_summary,category_name,lead_time_days,width_mm,depth_mm,height_mm,material_summary,finish_summary,sort_order,project_area_name,selected_options")
    .eq("version_id", header.id)
    .order("sort_order")
    .limit(1000);
  if (itemsResult.error) throw itemsResult.error;
  const rows = (itemsResult.data ?? []) as PublicCatalogVersionItem[];
  return buildView(
    header,
    rows,
    await availableSnapshotProductIds(rows.map((item) => item.product_id)),
    query,
  );
}

async function loadPublicCatalogHeader(token: string) {
  const admin = createInsForgeAdminClient();
  const catalogResult = await admin.database
    .from("shared_catalogs")
    .select("id,status,share_token,expires_at,current_version_id")
    .eq("share_token", token)
    .maybeSingle();
  if (catalogResult.error) throw catalogResult.error;
  const catalog = catalogResult.data;
  if (!catalog || catalog.status !== "PUBLISHED" || !catalog.current_version_id) return null;
  if (catalog.expires_at && new Date(catalog.expires_at).getTime() <= Date.now()) return null;
  const versionResult = await admin.database
    .from("shared_catalog_versions")
    .select("id,title,introduction,brand_name,contact_name,contact_phone,contact_email,line_url,logo_file_id,scope_type,expires_at,published_at")
    .eq("id", catalog.current_version_id)
    .eq("catalog_id", catalog.id)
    .maybeSingle();
  if (versionResult.error) throw versionResult.error;
  if (!versionResult.data) return null;
  const header = versionResult.data as ViewHeader & { id: string };
  return { admin, header };
}

export async function loadPublicSharedCatalogItem(token: string, itemId: string) {
  const published = await loadPublicCatalogHeader(token);
  if (!published) return null;
  const { admin, header } = published;
  if (header.scope_type === "FULL_CATALOG") {
    const rows = (await loadEligibleProductRows([itemId])).map(liveRowToSource);
    if (!rows.length) return null;
    const view = await buildView(header, rows, new Set([itemId]), { pageSize: 12 });
    return view.items[0] ?? null;
  }
  const itemsResult = await admin.database
    .from("shared_catalog_version_items")
    .select("id,product_id,image_file_id,sku,product_type,name_th,name_en,description_th,specification_summary,category_name,lead_time_days,width_mm,depth_mm,height_mm,material_summary,finish_summary,sort_order,project_area_name,selected_options")
    .eq("version_id", header.id)
    .eq("id", itemId)
    .maybeSingle();
  if (itemsResult.error) throw itemsResult.error;
  if (!itemsResult.data) return null;
  const row = itemsResult.data as PublicCatalogVersionItem;
  const view = await buildView(
    header,
    [row],
    await availableSnapshotProductIds([row.product_id]),
    { pageSize: 12 },
  );
  return view.items[0] ?? null;
}
