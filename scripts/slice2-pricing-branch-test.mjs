import { createAdminClient, createClient } from "@insforge/sdk";
import { readFileSync } from "node:fs";
import { getUatPassword } from "./uat-password.mjs";

const project = JSON.parse(readFileSync(new URL("../.insforge/project.json", import.meta.url), "utf8"));
const baseUrl = project.oss_host;
const apiKey = process.env.INSFORGE_API_KEY ?? project.api_key;
const anonKey = process.env.SLICE2_INSFORGE_ANON_KEY ?? project.api_key;
if (!baseUrl || !apiKey || !anonKey) {
  throw new Error("Slice 2 branch test environment is incomplete");
}

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAILED: ${label}`);
  results.push(`PASS: ${label}`);
};
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

async function createUser(prefix) {
  const email = `${prefix}.${runId}@example.com`;
  const created = must(
    await admin.auth.signUp({ email, password, name: prefix, autoConfirm: true }),
    `create ${prefix}`,
  );
  let id = created?.user?.id;
  if (!id && created?.accessToken) {
    const temporary = createClient({
      baseUrl,
      accessToken: created.accessToken,
      isServerMode: true,
    });
    id = must(await temporary.auth.getCurrentUser(), `read ${prefix}`).user?.id;
  }
  if (!id) {
    id = must(
      await admin.database.rpc("operator_find_auth_user_id", { email_input: email }),
      `lookup ${prefix}`,
    );
  }
  return { id, email };
}

async function signIn(user) {
  const client = createClient({ baseUrl, anonKey });
  must(
    await client.auth.signInWithPassword({ email: user.email, password }),
    `sign in ${user.email}`,
  );
  return client;
}

const owner = await createUser("slice2-owner");
let internalOrganization = must(
  await admin.database
    .from("organizations")
    .select("id")
    .eq("code", "GISP")
    .maybeSingle(),
  "load internal organization",
);
if (!internalOrganization) {
  internalOrganization = must(
    await admin.database
      .from("organizations")
      .insert([
        {
          code: "GISP",
          name: "Global Interior Supply Platform",
          status: "ACTIVE",
          approved_at: new Date().toISOString(),
        },
      ])
      .select("id"),
    "create internal organization",
  )[0];
}
must(
  await admin.database.from("users").insert([
    {
      id: owner.id,
      primary_organization_id: internalOrganization.id,
      full_name: "Slice 2 Test Owner",
      status: "ACTIVE",
    },
  ]),
  "create Slice 2 owner profile",
);
const superRole = must(
  await admin.database
    .from("roles")
    .select("id")
    .eq("code", "SUPER_ADMIN")
    .single(),
  "load Super Admin role",
);
must(
  await admin.database.from("user_roles").insert([
    {
      user_id: owner.id,
      role_id: superRole.id,
      organization_id: null,
      assigned_by: owner.id,
    },
  ]),
  "assign Slice 2 Super Admin",
);
const ownerClient = await signIn(owner);

const member = await createUser("slice2-member");
const memberClient = await signIn(member);
must(
  await memberClient.database.rpc("save_member_onboarding", {
    contact_name_input: "Slice 2 Member",
    contact_phone_input: "0800000000",
    company_name_input: `Slice 2 Member ${runId}`,
    company_legal_name_input: `Slice 2 Member ${runId} Co., Ltd.`,
    tax_id_input: `02${String(runId).slice(-11)}`,
    business_type_input: "Interior Design",
    address_line_input: "Bangkok",
    district_input: "Pathum Wan",
    province_input: "Bangkok",
    postal_code_input: "10330",
    service_areas_input: ["Bangkok"],
    product_interests_input: ["Furniture"],
    training_interest_input: false,
    training_note_input: null,
  }),
  "save Slice 2 member onboarding",
);
const applicationId = must(
  await memberClient.database.rpc("submit_member_application", {}),
  "submit Slice 2 member application",
);
const memberApplication = must(
  await admin.database
    .from("member_applications")
    .select("id,user_id,organization_id")
    .eq("id", applicationId)
    .single(),
  "load Slice 2 member application",
);
must(
  await admin.database
    .from("member_applications")
    .update({ status: "APPROVED", reviewed_at: new Date().toISOString() })
    .eq("id", applicationId),
  "mark Slice 2 test application approved",
);
must(
  await admin.database
    .from("organizations")
    .update({ status: "ACTIVE", approved_at: new Date().toISOString() })
    .eq("id", memberApplication.organization_id),
  "activate Slice 2 test organization",
);
must(
  await admin.database
    .from("users")
    .update({ status: "ACTIVE" })
    .eq("id", memberApplication.user_id),
  "activate Slice 2 test member",
);

const supplierId = must(
  await ownerClient.database.rpc("create_catalog_supplier", {
    code_input: `S2-${runId}`,
    name_input: "Slice 2 Test Supplier",
    legal_name_input: "Slice 2 Test Supplier Co., Ltd.",
    country_code_input: "CN",
    default_currency_input: "CNY",
    contact_name_input: "Pricing Test",
    contact_email_input: "",
    contact_phone_input: "",
    website_url_input: "",
    default_lead_time_days_input: 45,
  }),
  "create supplier through trusted catalog action",
);
must(
  await ownerClient.database.rpc("activate_catalog_supplier", { supplier_id_input: supplierId }),
  "activate supplier through trusted action",
);
let category = must(
  await admin.database.from("categories").select("id").eq("status", "ACTIVE").limit(1),
  "load active category",
)[0];
if (!category) {
  category = must(
    await admin.database.from("categories").insert([{ code: `S2-${runId}`, name_th: "หมวดทดสอบ Slice 2", status: "ACTIVE" }]).select("id"),
    "create active test category",
  )[0];
}
const productId = must(
  await ownerClient.database.rpc("create_catalog_product_draft", {
    supplier_id_input: supplierId,
    category_id_input: category.id,
    sku_input: `S2-${runId}`,
    factory_sku_input: `FAC-${runId}`,
    name_th_input: "เก้าอี้ทดสอบ Pricing",
    name_en_input: "Pricing Test Chair",
    product_type_input: "STANDARD",
    country_code_input: "CN",
    default_lead_time_days_input: 45,
  }),
  "create product draft without a price",
);
const product = must(
  await admin.database.from("products").select("id,sku,status").eq("id", productId).single(),
  "load trusted product draft",
);
const prematurePrices = must(
  await admin.database.from("product_prices").select("id").eq("product_id", productId),
  "check product draft price boundary",
);
assert(
  product.status === "DRAFT" && prematurePrices.length === 0,
  "product draft is created without a premature member price",
);

must(
  await ownerClient.database.rpc("save_product_detail", {
    product_id_input: product.id, supplier_id_input: supplierId, category_id_input: category.id,
    sku_input: product.sku, factory_sku_input: `FAC-${runId}`, name_th_input: "เก้าอี้ทดสอบ Pricing",
    name_en_input: "Pricing Test Chair", name_zh_input: "", product_type_input: "STANDARD", country_code_input: "CN",
    description_th_input: "เก้าอี้สำหรับทดสอบ Product lifecycle", specification_summary_input: "โครงไม้ บุผ้า",
    default_lead_time_days_input: 45, width_mm_input: 600, depth_mm_input: 650, height_mm_input: 820,
    weight_kg_input: 12, cbm_input: 0.32, material_summary_input: "ไม้โอ๊กและผ้า", finish_summary_input: "Natural",
    moq_input: 1, source_catalog_page_input: "12", ordering_note_input: "ทดสอบ Slice 2",
  }),
  "save complete product detail",
);
const variantId = must(
  await ownerClient.database.rpc("save_product_variant", {
    variant_id_input: null, product_id_input: product.id, sku_input: `${product.sku}-NAT`, factory_sku_input: `FAC-${runId}-NAT`,
    name_input: "Natural Oak", specification_summary_input: "Natural oak / beige fabric", width_mm_input: 600,
    depth_mm_input: 650, height_mm_input: 820, weight_kg_input: 12, cbm_input: 0.32,
    material_summary_input: "Oak", finish_summary_input: "Natural", moq_input: 1,
  }),
  "create active product variant",
);
must(
  await ownerClient.database.rpc("save_product_source_detail", {
    product_id_input: product.id,
    supplier_product_code_input: `CN01-${runId}`,
    source_row_number_input: 2,
    source_specification_raw_input: "ขนาด 600×650×820; สี BK6699",
  }),
  "save supplier source identity",
);
const optionId = must(
  await ownerClient.database.rpc("save_product_option", {
    option_id_input: null,
    product_id_input: product.id,
    name_input: "สี/วัสดุ",
    is_required_input: false,
  }),
  "create product option",
);
const optionValueId = must(
  await ownerClient.database.rpc("save_product_option_value", {
    option_value_id_input: null,
    option_id_input: optionId,
    label_input: "BK6699",
    member_price_delta_input: 0,
    factory_cost_delta_input: 0,
  }),
  "create product option value",
);
const sourceAndOption = must(
  await admin.database.from("products").select("supplier_product_code,source_row_number").eq("id", product.id).single(),
  "read supplier source identity",
);
const optionValues = must(
  await admin.database.from("product_option_values").select("label,status").eq("id", optionValueId),
  "read product option value",
);
assert(
  sourceAndOption.supplier_product_code === `CN01-${runId}` && sourceAndOption.source_row_number === 2 && optionValues[0]?.label === "BK6699",
  "supplier source identity and Product Option values are preserved",
);
const tinyPng = new File([
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
], `slice2-${runId}.png`, { type: "image/png" });
const objectKey = `catalog/products/${product.id}/image/branch-${runId}.png`;
const storedImage = must(
  await admin.storage.from("gisp-confidential").upload(objectKey, tinyPng),
  "upload private product image",
);
const fileId = must(
  await admin.database.from("file_metadata").insert([{
    bucket: "gisp-confidential", object_key: storedImage.key ?? objectKey, url: storedImage.url ?? null,
    original_name: tinyPng.name, mime_type: tinyPng.type, size_bytes: tinyPng.size, visibility: "CONFIDENTIAL",
    entity_type: "PRODUCT_MEDIA", entity_id: product.id, uploaded_by: owner.id,
  }]).select("id"),
  "save product image metadata",
)[0].id;
must(
  await ownerClient.database.rpc("attach_product_file", {
    product_id_input: product.id, file_id_input: fileId, file_kind_input: "IMAGE", document_type_input: "OTHER",
    source_page_input: "", is_primary_input: true, is_member_visible_input: false,
  }),
  "attach primary product image",
);

must(
  await ownerClient.database.rpc("create_product_cost_version", {
    product_id_input: product.id,
    variant_id_input: null,
    factory_cost_input: 100,
    currency_input: "THB",
    exchange_rate_to_thb_input: 1,
    effective_from_input: new Date(Date.now() - 1000).toISOString(),
  }),
  "create active factory cost",
);

const formulaId = must(
  await ownerClient.database.rpc("save_price_formula_draft", {
    formula_version_id_input: null,
    scope_type_input: "GLOBAL",
    supplier_id_input: null,
    product_id_input: null,
    name_input: `Approved template ${runId}`,
    effective_from_input: new Date(Date.now() - 1000).toISOString(),
    effective_until_input: null,
    suggested_resale_markup_percent_input: 25,
    freight_estimate_min_percent_input: 15,
    freight_estimate_max_percent_input: 20,
    components_input: [
      {
        component_code: "PLATFORM",
        component_name: "Platform Cost",
        calculation_type: "PERCENTAGE",
        calculation_basis: "FACTORY_COST_THB",
        component_value: 5,
        included_in_member_price: true,
        is_enabled: true,
        sort_order: 10,
      },
      {
        component_code: "MARKETING",
        component_name: "Marketing and Training",
        calculation_type: "PERCENTAGE",
        calculation_basis: "FACTORY_COST_THB",
        component_value: 10,
        included_in_member_price: true,
        is_enabled: true,
        sort_order: 20,
      },
      {
        component_code: "SOURCING",
        component_name: "Product Sourcing",
        calculation_type: "PERCENTAGE",
        calculation_basis: "FACTORY_COST_THB",
        component_value: 10,
        included_in_member_price: true,
        is_enabled: true,
        sort_order: 30,
      },
    ],
  }),
  "save global pricing formula",
);

const preview = must(
  await ownerClient.database.rpc("preview_product_price", {
    product_id_input: product.id,
    variant_id_input: null,
    formula_version_id_input: formulaId,
  }),
  "preview approved pricing example",
);
assert(
  Number(preview.memberPrice) === 125 &&
    Number(preview.suggestedResalePrice) === 156.25 &&
    Number(preview.freightEstimateMin) === 15 &&
    Number(preview.freightEstimateMax) === 20,
  "database pricing gives 100 → 125 → 156.25 and freight 15–20",
);

must(
  await ownerClient.database.rpc("activate_price_formula", {
    formula_version_id_input: formulaId,
  }),
  "activate pricing formula",
);
const priceId = must(
  await ownerClient.database.rpc("activate_calculated_product_price", {
    product_id_input: product.id,
    variant_id_input: null,
  }),
  "activate calculated member price",
);
const validation = must(
  await ownerClient.database.rpc("product_validation_result", { product_id_input: product.id }),
  "validate complete product",
);
assert(validation.blockingCount === 0 && validation.readyForReview === true, "complete Product Detail, Variant, image, cost and price are ready for Review");
must(await ownerClient.database.rpc("submit_product_for_review", { product_id_input: product.id }), "submit product for review");
must(await ownerClient.database.rpc("review_catalog_product", { product_id_input: product.id, decision_input: "PASSED", note_input: "Branch test passed" }), "pass product review");
must(
  await ownerClient.database.rpc("publish_product", { product_id_input: product.id }),
  "publish reviewed product",
);

const memberCatalog = must(
  await memberClient.database
    .from("member_catalog")
    .select(
      "id,sku,member_price_before_vat,suggested_resale_amount,freight_estimate_min,freight_estimate_max",
    )
    .eq("id", product.id),
  "member-safe catalog read",
);
assert(
  memberCatalog.length === 1 &&
    Number(memberCatalog[0].member_price_before_vat) === 125,
  "active member sees the calculated member price",
);
assert(
  !Object.keys(memberCatalog[0]).some((key) =>
    /factory|cost|formula|margin|supplier|internal/i.test(key),
  ),
  "member catalog response excludes cost, formula, margin and supplier identity",
);

const memberFormulaRows = must(
  await memberClient.database
    .from("price_formula_versions")
    .select("id")
    .limit(10),
  "member direct formula read",
);
const memberCostRows = must(
  await memberClient.database
    .from("product_cost_versions")
    .select("id")
    .limit(10),
  "member direct cost read",
);
assert(
  memberFormulaRows.length === 0 && memberCostRows.length === 0,
  "RLS blocks member direct formula and factory-cost reads",
);

const deniedPreview = await memberClient.database.rpc("preview_product_price", {
  product_id_input: product.id,
  variant_id_input: null,
  formula_version_id_input: formulaId,
});
assert(Boolean(deniedPreview.error), "member cannot call confidential pricing preview");

const directFormulaUpdate = await ownerClient.database
  .from("price_formula_versions")
  .update({ name: "Direct tamper" })
  .eq("id", formulaId);
const directPriceUpdate = await ownerClient.database
  .from("product_prices")
  .update({ amount: 1 })
  .eq("id", priceId);
const directProductUpdate = await ownerClient.database.from("products").update({ status: "DRAFT" }).eq("id", product.id);
const directVariantUpdate = await ownerClient.database.from("product_variants").update({ status: "INACTIVE" }).eq("id", variantId);
const directOptionUpdate = await ownerClient.database.from("product_options").update({ name: "Direct tamper" }).eq("id", optionId);
const directOptionValueUpdate = await ownerClient.database.from("product_option_values").update({ label: "Direct tamper" }).eq("id", optionValueId);
assert(
  Boolean(directFormulaUpdate.error) && Boolean(directPriceUpdate.error) && Boolean(directProductUpdate.error) && Boolean(directVariantUpdate.error) && Boolean(directOptionUpdate.error) && Boolean(directOptionValueUpdate.error),
  "direct formula, price, Product, Variant and Option updates are blocked",
);

const audit = must(
  await admin.database
    .from("audit_events")
    .select("entity_type,entity_id,action")
    .in("entity_id", [formulaId, priceId, product.id, variantId, optionId, optionValueId])
    .limit(50),
  "read pricing audit evidence",
);
assert(
  audit.some((row) => row.action === "ACTIVATED") &&
    audit.some((row) => row.action === "CALCULATED_PRICE_ACTIVATED") &&
    audit.some((row) => row.action === "SUBMITTED_FOR_REVIEW") &&
    audit.some((row) => row.action === "PUBLISHED") &&
    audit.some((row) => row.entity_id === optionId && row.action === "CREATED") &&
    audit.some((row) => row.entity_id === optionValueId && row.action === "CREATED"),
  "pricing, Option, Review and Publish transitions append audit events",
);

for (const line of results) console.log(line);
console.log(`Slice 2 pricing branch integration complete: ${results.length} assertions`);
