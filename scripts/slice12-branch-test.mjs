import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
const previewUrl = process.env.SLICE12_PREVIEW_URL?.replace(/\/$/, "");
if (!baseUrl || !apiKey || !anonKey) throw new Error("Slice 12 branch test environment is incomplete");
if (!baseUrl.includes("kit6y4pj-hm4")) throw new Error("Refusing to test outside slice-12-shared-catalog");

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const assert = (condition, label) => { if (!condition) throw new Error(`FAILED: ${label}`); results.push(`PASS: ${label}`); };

async function createUser(prefix) {
  const email = `${prefix}.${runId}@example.com`;
  const created = must(await admin.auth.signUp({ email, password, name: prefix, autoConfirm: true }), `create ${prefix}`);
  let id = created?.user?.id;
  if (!id && created?.accessToken) {
    const temporary = createClient({ baseUrl, accessToken: created.accessToken, isServerMode: true });
    id = must(await temporary.auth.getCurrentUser(), `read ${prefix}`).user?.id;
  }
  if (!id) id = must(await admin.database.rpc("operator_find_auth_user_id", { email_input: email }), `lookup ${prefix}`);
  return { id, email };
}

async function signIn(user) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email: user.email, password }), `sign in ${user.email}`);
  return client;
}

async function onboard(client, suffix) {
  must(await client.database.rpc("save_member_onboarding", {
    contact_name_input: `Slice 12 Member ${suffix}`, contact_phone_input: "0800000000",
    company_name_input: `Slice 12 Company ${suffix} ${runId}`,
    company_legal_name_input: `Slice 12 Company ${suffix} ${runId} Co., Ltd.`,
    tax_id_input: `${suffix === "A" ? "12" : "13"}${String(runId).slice(-11)}`,
    business_type_input: "Interior Design", address_line_input: "Bangkok", district_input: "Pathum Wan",
    province_input: "Bangkok", postal_code_input: "10330", service_areas_input: ["Bangkok"],
    product_interests_input: ["Furniture"], training_interest_input: false, training_note_input: null,
  }), `save onboarding ${suffix}`);
  return must(await client.database.rpc("submit_member_application", {}), `submit member ${suffix}`);
}

const operator = await createUser("slice12-admin");
let internalOrganization = must(await admin.database.from("organizations").select("id").eq("code", "GISP").maybeSingle(), "load GISP organization");
if (!internalOrganization) internalOrganization = must(await admin.database.from("organizations").insert([{ code: "GISP", name: "Global Interior Supply Platform", status: "ACTIVE", approved_at: new Date().toISOString() }]).select("id").single(), "create GISP organization");
must(await admin.database.from("users").insert([{ id: operator.id, primary_organization_id: internalOrganization.id, full_name: "Slice 12 Admin", status: "ACTIVE" }]), "create admin profile");
let superRole = must(await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").maybeSingle(), "load super admin role");
if (!superRole) superRole = must(await admin.database.from("roles").insert([{ code: "SUPER_ADMIN", name: "Super Admin", description: "Slice 12 branch test operator" }]).select("id").single(), "create super admin role");
let memberRole = must(await admin.database.from("roles").select("id").eq("code", "MEMBER").maybeSingle(), "load member role");
if (!memberRole) memberRole = must(await admin.database.from("roles").insert([{ code: "MEMBER", name: "Member", description: "Approved member" }]).select("id").single(), "create member role");
let approvePermission = must(await admin.database.from("permissions").select("id").eq("code", "members.approve").maybeSingle(), "load member approval permission");
if (!approvePermission) approvePermission = must(await admin.database.from("permissions").insert([{ code: "members.approve", name: "Approve members" }]).select("id").single(), "create member approval permission");
must(await admin.database.from("role_permissions").upsert([{ role_id: superRole.id, permission_id: approvePermission.id }], { onConflict: "role_id,permission_id" }), "grant member approval permission");
must(await admin.database.from("user_roles").insert([{ user_id: operator.id, role_id: superRole.id, organization_id: null, assigned_by: operator.id }]), "assign super admin");
const operatorClient = await signIn(operator);

const memberA = await createUser("slice12-member-a");
const memberB = await createUser("slice12-member-b");
const memberAClient = await signIn(memberA);
const memberBClient = await signIn(memberB);
const applicationA = await onboard(memberAClient, "A");
const applicationB = await onboard(memberBClient, "B");
must(await operatorClient.database.rpc("approve_member_application", { application_id_input: applicationA, review_note_input: "Slice 12 test" }), "approve member A");
must(await operatorClient.database.rpc("approve_member_application", { application_id_input: applicationB, review_note_input: "Slice 12 test" }), "approve member B");
const profiles = must(await admin.database.from("member_profiles").select("id,user_id,organization_id"), "load member profiles");
const profileA = profiles.find((row) => row.user_id === memberA.id);
if (!profileA) throw new Error("Member A profile missing");

let country = must(await admin.database.from("countries").select("code").eq("code", "CN").maybeSingle(), "load country");
if (!country) country = must(await admin.database.from("countries").insert([{ code: "CN", name_th: "ประเทศจีน", name_en: "China", status: "ACTIVE" }]).select("code").single(), "create country");
const supplier = must(await admin.database.from("suppliers").insert([{ code: `S12-SUP-${runId}`, name: "Slice 12 Supplier", country_code: country.code, status: "ACTIVE" }]).select("id").single(), "create supplier");
const category = must(await admin.database.from("categories").insert([{ code: `S12-CAT-${runId}`, name_th: "หมวดทดสอบ Shared Catalog", status: "ACTIVE" }]).select("id").single(), "create category");
const product = must(await admin.database.from("products").insert([{
  supplier_id: supplier.id, category_id: category.id, sku: `S12-P-${runId}`, product_type: "STANDARD",
  name_th: "สินค้า Snapshot รุ่นแรก", description_th: "ข้อมูลสำหรับลูกค้า", specification_summary: "ไม้สีธรรมชาติ",
  default_lead_time_days: 30, country_code: "CN", factory_cost: 100, factory_currency: "CNY",
  internal_note: "SECRET INTERNAL", status: "PUBLISHED", qa_status: "PASSED", published_at: new Date().toISOString(),
  reviewed_by: operator.id, reviewed_at: new Date().toISOString(), created_by: operator.id,
}]).select("id").single(), "create published product");
const productPrice = must(await admin.database.from("product_prices").insert([{ product_id: product.id, price_type: "MEMBER", amount: 10000, currency: "THB", status: "ACTIVE", valid_from: new Date(Date.now() - 60000).toISOString(), created_by: operator.id }]).select("id").single(), "create member price");
const tinyPng = new File([
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
], `slice12-${runId}.png`, { type: "image/png" });
const imageKey = `shared-catalog-test/${profileA.id}/${product.id}/${runId}.png`;
const storedImage = must(await admin.storage.from("gisp-member-private").upload(imageKey, tinyPng), "upload private catalog image");
const imageFile = must(await admin.database.from("file_metadata").insert([{
  organization_id: profileA.organization_id, member_profile_id: profileA.id,
  bucket: "gisp-member-private", object_key: storedImage.key ?? imageKey, url: storedImage.url ?? null,
  original_name: tinyPng.name, mime_type: tinyPng.type, size_bytes: tinyPng.size,
  visibility: "MEMBER_PRIVATE", entity_type: "PRODUCT_MEDIA", entity_id: product.id, uploaded_by: operator.id,
}]).select("id").single(), "save private catalog image metadata");
must(await admin.database.from("product_media").insert([{ product_id: product.id, file_id: imageFile.id, media_type: "IMAGE", is_primary: true, sort_order: 0 }]), "attach private catalog image");
const crossMemberSign = await memberBClient.storage.from("gisp-member-private").createSignedUrl(storedImage.key ?? imageKey, 300);
assert(Boolean(crossMemberSign.error), "another member cannot sign a private catalog image directly");

const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
const catalogId = must(await memberAClient.database.rpc("create_customer_browse_catalog_draft", {
  title_input: "ชุดรับรองแขก", introduction_input: "คัดเลือกสำหรับโครงการนี้", brand_name_input: "Member A Design",
  contact_name_input: "Member A", contact_phone_input: "0800000000", contact_email_input: "member-a@example.com",
  line_url_input: "https://line.me/ti/p/example", scope_type_input: "CURATED", source_id_input: null, expires_at_input: expiresAt,
}), "create shared catalog");
must(await memberAClient.database.rpc("set_shared_catalog_item", { catalog_id_input: catalogId, product_id_input: product.id, customer_price_input: null, sort_order_input: 0 }), "add catalog item");
const version1 = must(await memberAClient.database.rpc("publish_shared_catalog", { catalog_id_input: catalogId }), "publish V1");
const snapshot1 = must(await admin.database.from("shared_catalog_version_items").select("name_th,customer_price").eq("version_id", version1).single(), "load V1 snapshot");
assert(snapshot1.name_th === "สินค้า Snapshot รุ่นแรก" && snapshot1.customer_price === null, "publish creates a no-price customer snapshot");
const initiallyPublished = must(await admin.database.from("shared_catalogs").select("share_token").eq("id", catalogId).single(), "load initial public token");
if (previewUrl) {
  const response = await fetch(`${previewUrl}/api/public/catalogs/${initiallyPublished.share_token}`);
  const payload = await response.json();
  assert(response.status === 200 && response.headers.get("cache-control")?.includes("no-store"), "published public API is available without caching");
  assert(!Object.hasOwn(payload.data?.items?.[0] ?? {}, "customerPrice") && !Object.hasOwn(payload.data?.items?.[0] ?? {}, "currency"), "public API contains no customer price or currency");
  const signedImageUrl = payload.data?.items?.[0]?.imageUrl;
  const signedImage = signedImageUrl ? await fetch(signedImageUrl) : null;
  assert(typeof signedImageUrl === "string" && signedImage?.status === 200, "validated public link receives a working short-lived signed image URL");
  const serialized = JSON.stringify(payload).toLowerCase();
  for (const secret of ["price", "currency", "member_price", "supplier", "factory_cost", "formula", "internal_note", "secret internal", "site_address", "end_customer"]) assert(!serialized.includes(secret), `public API excludes ${secret}`);
  const itemId = payload.data?.items?.[0]?.id;
  const itemResponse = await fetch(`${previewUrl}/api/public/catalogs/${initiallyPublished.share_token}/items/${itemId}`);
  const itemPayload = await itemResponse.json();
  const itemSerialized = JSON.stringify(itemPayload).toLowerCase();
  assert(itemResponse.status === 200 && itemPayload.data?.id === itemId, "public item detail validates the link and returns the selected item");
  for (const secret of ["price", "currency", "member_price", "supplier", "factory_cost", "formula", "internal_note"])
    assert(!itemSerialized.includes(secret), `public item detail excludes ${secret}`);
  const missingItem = await fetch(`${previewUrl}/api/public/catalogs/${initiallyPublished.share_token}/items/${"0".repeat(8)}-${"0".repeat(4)}-${"0".repeat(4)}-${"0".repeat(4)}-${"0".repeat(12)}`);
  assert(missingItem.status === 404, "public item detail rejects an item outside the published catalog");
  const page = await fetch(`${previewUrl}/catalog/share/${initiallyPublished.share_token}`);
  const html = await page.text();
  assert(page.status === 200 && html.includes("noindex") && html.includes("ชุดรับรองแขก"), "public page renders snapshot with noindex");
}

must(await admin.database.from("products").update({ name_th: "สินค้า Snapshot รุ่นใหม่", internal_note: "NEW SECRET" }).eq("id", product.id), "change source product");
must(await admin.database.from("product_prices").update({ amount: 22000 }).eq("product_id", product.id).eq("status", "ACTIVE"), "change source member price");
const unchanged = must(await admin.database.from("shared_catalog_version_items").select("name_th,customer_price").eq("version_id", version1).single(), "reload V1 snapshot");
assert(unchanged.name_th === "สินค้า Snapshot รุ่นแรก" && unchanged.customer_price === null, "published no-price snapshot is stable after source changes");

const project = must(await admin.database.from("projects").insert([{
  organization_id: profileA.organization_id, member_profile_id: profileA.id,
  project_number: `PRJ-S121-${runId}`, name: "โครงการลับสำหรับทดสอบ",
  site_address: "SECRET SITE ADDRESS", status: "ACTIVE", created_by: memberA.id,
}]).select("id").single(), "create member project");
const area = must(await admin.database.from("project_areas").insert([{
  project_id: project.id, organization_id: profileA.organization_id, name: "ห้องรับแขก", sort_order: 0,
}]).select("id").single(), "create project area");
must(await admin.database.from("project_items").insert([{
  project_id: project.id, organization_id: profileA.organization_id, area_id: area.id,
  product_id: product.id, item_type: "STANDARD", item_name: "Project secret item",
  specification_snapshot: "สเปกสำหรับลูกค้า", selected_options: [{ optionId: "x", valueId: "y", label: "สีธรรมชาติ" }],
  quantity: 99, unit: "EA", current_price_id: productPrice.id, current_unit_price: 22000,
  status: "DRAFT", created_by: memberA.id,
}]), "create project item");

async function createScopedCatalog(scopeType, sourceId, title) {
  const id = must(await memberAClient.database.rpc("create_customer_browse_catalog_draft", {
    title_input: title, introduction_input: "เลือกสินค้าแล้วติดต่อ Member", brand_name_input: "Member A Design",
    contact_name_input: "Member A", contact_phone_input: "0800000000", contact_email_input: "member-a@example.com",
    line_url_input: "https://line.me/ti/p/example", scope_type_input: scopeType,
    source_id_input: sourceId, expires_at_input: expiresAt,
  }), `create ${scopeType} catalog`);
  const versionId = must(await memberAClient.database.rpc("publish_shared_catalog", { catalog_id_input: id }), `publish ${scopeType} catalog`);
  return { id, versionId };
}

const productCatalog = await createScopedCatalog("PRODUCT", product.id, "สินค้ารายชิ้น");
const projectCatalog = await createScopedCatalog("PROJECT", project.id, "สินค้าในโครงการ");
const fullCatalog = await createScopedCatalog("FULL_CATALOG", null, "สินค้าทั้งหมด");
const scopedVersions = must(await admin.database.from("shared_catalog_versions").select("id,scope_type").in("id", [productCatalog.versionId, projectCatalog.versionId, fullCatalog.versionId]), "load scoped versions");
assert(new Set(scopedVersions.map((row) => row.scope_type)).size === 3, "product, project and full catalog publish separate scope snapshots");
const projectSnapshot = must(await admin.database.from("shared_catalog_version_items").select("project_area_name,selected_options,customer_price").eq("version_id", projectCatalog.versionId).single(), "load project snapshot");
assert(projectSnapshot.project_area_name === "ห้องรับแขก" && projectSnapshot.selected_options?.[0]?.label === "สีธรรมชาติ" && projectSnapshot.customer_price === null, "project snapshot contains only public area/options and no price");
const fullSnapshotItems = must(await admin.database.from("shared_catalog_version_items").select("id").eq("version_id", fullCatalog.versionId), "load full catalog snapshot rows");
assert(fullSnapshotItems.length === 0, "full catalog keeps products live instead of copying hundreds of snapshot rows");
const crossProjectLink = await memberBClient.database.rpc("create_customer_browse_catalog_draft", {
  title_input: "Cross member project", introduction_input: "", brand_name_input: "Member B",
  contact_name_input: "Member B", contact_phone_input: "081", contact_email_input: "",
  line_url_input: "", scope_type_input: "PROJECT", source_id_input: project.id, expires_at_input: expiresAt,
});
assert(Boolean(crossProjectLink.error), "another member cannot create a link from member A project");

if (previewUrl) {
  const scopedCatalogs = must(await admin.database.from("shared_catalogs").select("id,share_token").in("id", [productCatalog.id, projectCatalog.id, fullCatalog.id]), "load scoped tokens");
  for (const scoped of scopedCatalogs) {
    const response = await fetch(`${previewUrl}/api/public/catalogs/${scoped.share_token}?search=Snapshot&page=1&pageSize=12`);
    const payload = await response.json();
    const serialized = JSON.stringify(payload).toLowerCase();
    assert(response.status === 200, `public ${scoped.id} link opens`);
    for (const secret of ["price", "currency", "secret site", "quantity", "supplier", "factory_cost", "internal_note"])
      assert(!serialized.includes(secret), `public ${scoped.id} excludes ${secret}`);
  }
}

const ownRead = must(await memberAClient.database.from("shared_catalogs").select("id").eq("id", catalogId), "member A catalog read");
const crossRead = must(await memberBClient.database.from("shared_catalogs").select("id").eq("id", catalogId), "member B catalog read");
assert(ownRead.length === 1 && crossRead.length === 0, "RLS isolates catalogs between member profiles");
const crossEdit = await memberBClient.database.rpc("save_shared_catalog", { catalog_id_input: catalogId, title_input: "Cross edit", introduction_input: "", brand_name_input: "B", contact_name_input: "B", contact_phone_input: "080", contact_email_input: "", line_url_input: "", price_mode_input: "HIDDEN", expires_at_input: expiresAt });
assert(Boolean(crossEdit.error), "member B cannot edit member A catalog");
const directStatus = await memberAClient.database.from("shared_catalogs").update({ status: "REVOKED" }).eq("id", catalogId);
assert(Boolean(directStatus.error), "client cannot mutate controlled catalog status directly");
const forbidden = JSON.stringify(snapshot1);
for (const secret of ["member_price", "supplier", "factory_cost", "formula", "internal_note", "SECRET INTERNAL"]) assert(!forbidden.toLowerCase().includes(secret.toLowerCase()), `snapshot excludes ${secret}`);

const beforeRotate = must(await admin.database.from("shared_catalogs").select("share_token").eq("id", catalogId).single(), "token before rotate");
const rotated = must(await memberAClient.database.rpc("rotate_shared_catalog_link", { catalog_id_input: catalogId }), "rotate link");
assert(rotated !== beforeRotate.share_token && /^[a-f0-9]{48}$/.test(rotated), "rotated token is new and unpredictable");
if (previewUrl) {
  const [oldLink, newLink, invalidLink] = await Promise.all([
    fetch(`${previewUrl}/api/public/catalogs/${beforeRotate.share_token}`),
    fetch(`${previewUrl}/api/public/catalogs/${rotated}`),
    fetch(`${previewUrl}/api/public/catalogs/${"0".repeat(48)}`),
  ]);
  assert(oldLink.status === 404 && newLink.status === 200 && invalidLink.status === 404, "rotated and invalid public tokens are rejected");
  must(await admin.database.from("shared_catalogs").update({ expires_at: new Date(Date.now() - 60000).toISOString() }).eq("id", catalogId), "expire catalog for public test");
  const expiredLink = await fetch(`${previewUrl}/api/public/catalogs/${rotated}`);
  assert(expiredLink.status === 404, "expired public catalog is rejected");
  must(await admin.database.from("shared_catalogs").update({ expires_at: expiresAt }).eq("id", catalogId), "restore catalog expiry");
}
must(await memberAClient.database.rpc("revoke_shared_catalog", { catalog_id_input: catalogId }), "revoke catalog");
const revoked = must(await admin.database.from("shared_catalogs").select("status").eq("id", catalogId).single(), "load revoked status");
assert(revoked.status === "REVOKED", "revoke disables the catalog");
if (previewUrl) {
  const revokedLink = await fetch(`${previewUrl}/api/public/catalogs/${rotated}`);
  assert(revokedLink.status === 404, "revoked public catalog is rejected");
}
const tamperHistory = await memberAClient.database.from("shared_catalog_events").update({ detail: "tampered" }).eq("catalog_id", catalogId);
assert(Boolean(tamperHistory.error), "catalog events are append-only");

must(await memberAClient.database.rpc("publish_shared_catalog", { catalog_id_input: catalogId }), "republish UAT catalog");
const uatCatalog = must(await admin.database.from("shared_catalogs").select("share_token").eq("id", catalogId).single(), "load UAT catalog token");

for (const line of results) console.log(line);
console.log(`Slice 12.1 branch integration complete: ${results.length} assertions`);
console.log(JSON.stringify({ memberEmail: memberA.email, catalogId, publicUrl: previewUrl ? `${previewUrl}/catalog/share/${uatCatalog.share_token}` : null }, null, 2));
