import { createAdminClient, createClient } from "@insforge/sdk";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { getUatPassword } from "./uat-password.mjs";
const project = JSON.parse(
  readFileSync(new URL("../.insforge/project.json", import.meta.url), "utf8"),
);
if (project.project_id !== "5398a865-c466-4c6e-8bdf-e8f8ec1f56d8")
  throw new Error(
    "Refusing to run outside pdf-excel-roundtrip-v1 backend branch",
  );
const admin = createAdminClient({
  baseUrl: project.oss_host,
  apiKey: process.env.INSFORGE_API_KEY ?? project.api_key,
});
const results = [];
const run = Date.now();
const must = (value, label) => {
  if (value.error) throw new Error(`${label}: ${value.error.message}`);
  return value.data;
};
const pass = (condition, label) => {
  if (!condition) throw new Error(`FAILED: ${label}`);
  results.push(`PASS: ${label}`);
};
const hash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(value, Object.keys(value).sort()))
    .digest("hex");
const email = `pxr-super-${run}@example.com`;
const created = must(
  await admin.auth.signUp({
    email,
    password: getUatPassword(),
    name: "PXR Super",
    autoConfirm: true,
  }),
  "create user",
);
let userId = created?.user?.id;
if (!userId)
  userId = must(
    await admin.database.rpc("operator_find_auth_user_id", {
      email_input: email,
    }),
    "lookup user",
  );
const organization = must(
  await admin.database
    .from("organizations")
    .select("id")
    .eq("code", "GISP")
    .single(),
  "organization",
);
must(
  await admin.database.from("users").insert([
    {
      id: userId,
      primary_organization_id: organization.id,
      full_name: "PXR Runtime Test",
      status: "ACTIVE",
    },
  ]),
  "profile",
);
const role = must(
  await admin.database
    .from("roles")
    .select("id")
    .eq("code", "SUPER_ADMIN")
    .single(),
  "role",
);
must(
  await admin.database.from("user_roles").insert([
    {
      user_id: userId,
      role_id: role.id,
      organization_id: null,
      assigned_by: userId,
    },
  ]),
  "role grant",
);
const client = createClient({
  baseUrl: project.oss_host,
  anonKey: project.api_key,
});
must(
  await client.auth.signInWithPassword({ email, password: getUatPassword() }),
  "sign in",
);
async function roleClient(label, roleCode = null) {
  const accountEmail = `pxr-${label}-${run}@example.com`;
  const createdAccount = must(
    await admin.auth.signUp({
      email: accountEmail,
      password: getUatPassword(),
      name: `PXR ${label}`,
      autoConfirm: true,
    }),
    `create ${label}`,
  );
  let id = createdAccount?.user?.id;
  if (!id)
    id = must(
      await admin.database.rpc("operator_find_auth_user_id", {
        email_input: accountEmail,
      }),
      `lookup ${label}`,
    );
  must(
    await admin.database.from("users").insert([
      {
        id,
        primary_organization_id: organization.id,
        full_name: `PXR ${label}`,
        status: "ACTIVE",
      },
    ]),
    `${label} profile`,
  );
  if (roleCode) {
    const targetRole = must(
      await admin.database
        .from("roles")
        .select("id")
        .eq("code", roleCode)
        .single(),
      `${label} role`,
    );
    must(
      await admin.database.from("user_roles").insert([
        {
          user_id: id,
          role_id: targetRole.id,
          organization_id: null,
          assigned_by: userId,
        },
      ]),
      `${label} role grant`,
    );
  }
  const scoped = createClient({
    baseUrl: project.oss_host,
    anonKey: project.api_key,
  });
  must(
    await scoped.auth.signInWithPassword({
      email: accountEmail,
      password: getUatPassword(),
    }),
    `${label} sign in`,
  );
  return scoped;
}
const supplier = must(
  await admin.database
    .from("suppliers")
    .insert([
      {
        code: `PXR-${run}`,
        name: "PXR Synthetic Supplier",
        country_code: "CN",
        default_currency: "CNY",
        status: "ACTIVE",
      },
    ])
    .select("id")
    .single(),
  "supplier",
);
const category = must(
  await admin.database
    .from("categories")
    .insert([
      { code: `PXR-${run}`, name_th: "หมวดทดสอบ Round-trip", status: "ACTIVE" },
    ])
    .select("id")
    .single(),
  "category",
);
const fileId = randomUUID();
must(
  await admin.database.from("file_metadata").insert([
    {
      id: fileId,
      bucket: "gisp-confidential",
      object_key: `pxr-test/${run}.pdf`,
      original_name: "synthetic.pdf",
      mime_type: "application/pdf",
      size_bytes: 1,
      visibility: "CONFIDENTIAL",
      entity_type: "CATALOG_IMPORT",
      entity_id: null,
      uploaded_by: userId,
    },
  ]),
  "file metadata",
);
const jobId = randomUUID();
must(
  await admin.database.from("catalog_import_jobs").insert([
    {
      id: jobId,
      source_file_id: fileId,
      source_type: "PDF",
      status: "READY_FOR_REVIEW",
      supplier_id: supplier.id,
      page_count: 1,
      processed_pages: 1,
      file_sha256: String(run).padStart(64, "0").slice(-64),
      security_status: "VERIFIED",
      security_verified_at: new Date().toISOString(),
      total_rows: 1,
      valid_rows: 1,
      invalid_rows: 0,
      created_by: userId,
    },
  ]),
  "job",
);
const importRow = must(
  await admin.database
    .from("catalog_import_rows")
    .insert([
      {
        import_job_id: jobId,
        row_number: 1,
        source_data: {},
        validation_status: "VALID",
        source_page_number: 1,
        sku: `PXR-${run}`,
        name_th_draft: "เก้าอี้ทดสอบ",
        product_type: "STANDARD",
        category_id: category.id,
        country_code: "CN",
        review_status: "NOT_REVIEWED",
      },
    ])
    .select("*")
    .single(),
  "import row",
);
const baseline = {
  sku: importRow.sku,
  factory_sku: null,
  name_th: importRow.name_th_draft,
  name_en: null,
  name_zh: null,
  product_type: "STANDARD",
  category_id: category.id,
  country_code: "CN",
  lead_time_days: null,
  width_mm: null,
  depth_mm: null,
  height_mm: null,
  weight_kg: null,
  cbm: null,
  material_summary: null,
  finish_summary: null,
  moq: null,
  description_th: null,
  specification_summary: null,
};
const batchId = randomUUID();
must(
  await admin.database.from("catalog_import_enrichment_batches").insert([
    {
      id: batchId,
      import_job_id: jobId,
      workbook_id: batchId,
      status: "READY_FOR_REVIEW",
      total_rows: 1,
      ready_detail_rows: 1,
      created_by: userId,
    },
  ]),
  "detail batch",
);
const detailRow = must(
  await admin.database
    .from("catalog_import_enrichment_rows")
    .insert([
      {
        batch_id: batchId,
        row_key: randomUUID(),
        import_row_id: importRow.id,
        row_number: 1,
        baseline_detail: baseline,
        baseline_detail_hash: hash(baseline),
        proposed_detail: { description_th: "แก้จาก Excel" },
        detail_diff: { description_th: "แก้จาก Excel" },
        detail_status: "READY",
        cost_status: "UNCHANGED",
      },
    ])
    .select("id")
    .single(),
  "detail stage",
);
must(
  await admin.database.from("file_metadata").insert([
    {
      bucket: "gisp-confidential",
      object_key: `pxr-test/${run}.xlsx`,
      original_name: "synthetic.xlsx",
      mime_type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size_bytes: 100,
      visibility: "CONFIDENTIAL",
      entity_type: "CATALOG_ENRICHMENT_EXPORT",
      entity_id: batchId,
      uploaded_by: userId,
    },
  ]),
  "valid enrichment file metadata",
);
const unsafeMetadata = await admin.database.from("file_metadata").insert([
  {
    bucket: "gisp-confidential",
    object_key: `pxr-test/${run}-bad.xlsx`,
    original_name: "synthetic.xlsx",
    mime_type: "image/png",
    size_bytes: 100,
    visibility: "CONFIDENTIAL",
    entity_type: "CATALOG_ENRICHMENT_UPLOAD",
    entity_id: batchId,
    uploaded_by: userId,
  },
]);
pass(
  Boolean(unsafeMetadata.error),
  "storage guard rejects non-XLSX enrichment metadata",
);
const denied = await client.database
  .from("catalog_import_enrichment_rows")
  .update({ detail_status: "CANCELLED" })
  .eq("id", detailRow.id);
pass(Boolean(denied.error), "authenticated browser DML is denied");
const details = must(
  await client.database.rpc("apply_catalog_enrichment_details", {
    batch_id_input: batchId,
    row_ids_input: [detailRow.id],
    idempotency_key_input: `detail-${run}`,
  }),
  "apply details",
);
pass(details.applied === 1, "trusted detail RPC applies one READY row");
const changed = must(
  await admin.database
    .from("catalog_import_rows")
    .select("description_th,review_status")
    .eq("id", importRow.id)
    .single(),
  "read changed candidate",
);
pass(
  changed.description_th === "แก้จาก Excel" &&
    changed.review_status === "NOT_REVIEWED",
  "candidate detail changes and review resets",
);
const member = await roleClient("member");
const purchasing = await roleClient("purchasing", "PURCHASING");
const productAdmin = await roleClient("product-admin", "PRODUCT_ADMIN");
const memberRows = must(
  await member.database
    .from("catalog_import_enrichment_batches")
    .select("id")
    .eq("id", batchId),
  "member read",
);
const purchasingRows = must(
  await purchasing.database
    .from("catalog_import_enrichment_batches")
    .select("id")
    .eq("id", batchId),
  "purchasing read",
);
const adminRows = must(
  await productAdmin.database
    .from("catalog_import_enrichment_batches")
    .select("id")
    .eq("id", batchId),
  "product admin read",
);
pass(
  memberRows.length === 0 &&
    purchasingRows.length === 0 &&
    adminRows.length === 1,
  `permission matrix Member=${memberRows.length} Purchasing=${purchasingRows.length} ProductAdmin=${adminRows.length}`,
);
const deniedMemberRpc = await member.database.rpc(
  "apply_catalog_enrichment_details",
  {
    batch_id_input: batchId,
    row_ids_input: [detailRow.id],
    idempotency_key_input: `denied-${run}`,
  },
);
pass(Boolean(deniedMemberRpc.error), "Member cannot execute trusted apply RPC");
const product = must(
  await admin.database
    .from("products")
    .insert([
      {
        supplier_id: supplier.id,
        category_id: category.id,
        sku: `PXR-DRAFT-${run}`,
        product_type: "STANDARD",
        name_th: "Product Draft ทดสอบ",
        country_code: "CN",
        status: "DRAFT",
        qa_status: "NOT_REVIEWED",
        created_by: userId,
      },
    ])
    .select("id,status")
    .single(),
  "test draft",
);
must(
  await admin.database
    .from("catalog_import_rows")
    .update({
      product_id: product.id,
      validation_status: "IMPORTED",
      imported_product_snapshot: { id: product.id },
      imported_at: new Date().toISOString(),
    })
    .eq("id", importRow.id),
  "link draft",
);
const unrelatedProduct = must(
  await admin.database
    .from("products")
    .insert([
      {
        supplier_id: supplier.id,
        category_id: category.id,
        sku: `PXR-UNRELATED-${run}`,
        product_type: "STANDARD",
        name_th: "Product Draft ที่ไม่เกี่ยวข้อง",
        country_code: "CN",
        status: "DRAFT",
        qa_status: "NOT_REVIEWED",
        created_by: userId,
      },
    ])
    .select("id")
    .single(),
  "unrelated draft",
);
const forgedProductLink = await admin.database
  .from("catalog_import_enrichment_rows")
  .insert([
    {
      batch_id: batchId,
      row_key: randomUUID(),
      import_row_id: importRow.id,
      product_id: unrelatedProduct.id,
      row_number: 2,
      baseline_detail: baseline,
      baseline_detail_hash: hash(baseline),
      detail_status: "UNCHANGED",
      cost_status: "UNCHANGED",
    },
  ]);
pass(
  Boolean(forgedProductLink.error),
  "immutable PDF snapshot blocks a forged Product linkage",
);
const costBatch = randomUUID();
must(
  await admin.database.from("catalog_import_enrichment_batches").insert([
    {
      id: costBatch,
      import_job_id: jobId,
      workbook_id: costBatch,
      status: "READY_FOR_REVIEW",
      total_rows: 1,
      created_by: userId,
    },
  ]),
  "cost batch",
);
const costRow = must(
  await admin.database
    .from("catalog_import_enrichment_rows")
    .insert([
      {
        batch_id: costBatch,
        row_key: randomUUID(),
        import_row_id: importRow.id,
        row_number: 1,
        baseline_detail: baseline,
        baseline_detail_hash: hash(baseline),
        baseline_cost: null,
        proposed_cost: {
          factory_cost: 100,
          currency: "CNY",
          exchange_rate_to_thb: 5,
          effective_from: null,
        },
        cost_diff: {
          factory_cost: 100,
          currency: "CNY",
          exchange_rate_to_thb: 5,
        },
        detail_status: "UNCHANGED",
        cost_status: "WAITING_FOR_DRAFT",
      },
    ])
    .select("id")
    .single(),
  "cost stage",
);
const refreshed = must(
  await client.database.rpc("refresh_catalog_enrichment_targets", {
    batch_id_input: costBatch,
  }),
  "refresh draft target",
);
pass(
  refreshed.refreshed === 1,
  "WAITING_FOR_DRAFT becomes READY after Product Draft exists",
);
const costResult = must(
  await client.database.rpc("apply_catalog_enrichment_costs", {
    batch_id_input: costBatch,
    row_ids_input: [costRow.id],
    idempotency_key_input: `cost-${run}`,
  }),
  "apply cost",
);
const again = must(
  await client.database.rpc("apply_catalog_enrichment_costs", {
    batch_id_input: costBatch,
    row_ids_input: [costRow.id],
    idempotency_key_input: `cost-${run}`,
  }),
  "repeat cost idempotently",
);
pass(
  costResult.applied === 1 &&
    JSON.stringify(costResult) === JSON.stringify(again),
  "cost apply is idempotent",
);
const firstCost = must(
  await admin.database
    .from("product_cost_versions")
    .select(
      "id,status,factory_cost,currency,exchange_rate_to_thb,effective_from",
    )
    .eq("product_id", product.id)
    .eq("status", "ACTIVE")
    .single(),
  "first active cost",
);
pass(
  Number(firstCost.factory_cost) === 100,
  "creates one ACTIVE factory Cost Version",
);
const secondBatch = randomUUID();
must(
  await admin.database.from("catalog_import_enrichment_batches").insert([
    {
      id: secondBatch,
      import_job_id: jobId,
      workbook_id: secondBatch,
      status: "READY_FOR_REVIEW",
      total_rows: 1,
      ready_cost_rows: 1,
      created_by: userId,
    },
  ]),
  "replacement cost batch",
);
const secondRow = must(
  await admin.database
    .from("catalog_import_enrichment_rows")
    .insert([
      {
        batch_id: secondBatch,
        row_key: randomUUID(),
        import_row_id: importRow.id,
        product_id: product.id,
        row_number: 1,
        baseline_detail: baseline,
        baseline_detail_hash: hash(baseline),
        baseline_cost: {
          factory_cost: Number(firstCost.factory_cost),
          currency: String(firstCost.currency).trim(),
          exchange_rate_to_thb: Number(firstCost.exchange_rate_to_thb),
          effective_from: firstCost.effective_from,
          status: "ACTIVE",
        },
        proposed_cost: {
          factory_cost: 120,
          currency: "CNY",
          exchange_rate_to_thb: 5,
          effective_from: null,
        },
        cost_diff: { factory_cost: 120 },
        detail_status: "UNCHANGED",
        cost_status: "READY",
      },
    ])
    .select("id")
    .single(),
  "replacement cost row",
);
must(
  await client.database.rpc("apply_catalog_enrichment_costs", {
    batch_id_input: secondBatch,
    row_ids_input: [secondRow.id],
    idempotency_key_input: `replacement-${run}`,
  }),
  "replace cost",
);
const versions = must(
  await admin.database
    .from("product_cost_versions")
    .select("id,status,factory_cost")
    .eq("product_id", product.id),
  "cost version history",
);
pass(
  versions.length === 2 &&
    versions.some(
      (row) => row.status === "RETIRED" && Number(row.factory_cost) === 100,
    ) &&
    versions.some(
      (row) => row.status === "ACTIVE" && Number(row.factory_cost) === 120,
    ),
  "new Cost Version retires the prior ACTIVE version",
);
const prices = must(
  await admin.database
    .from("product_prices")
    .select("id")
    .eq("product_id", product.id),
  "member price check",
);
pass(prices.length === 0, "does not activate Member Price");
const unchangedProduct = must(
  await admin.database
    .from("products")
    .select("status,qa_status")
    .eq("id", product.id)
    .single(),
  "product state",
);
pass(
  unchangedProduct.status === "DRAFT" &&
    unchangedProduct.qa_status === "NOT_REVIEWED",
  "Product remains Draft / Not Reviewed",
);
must(
  await admin.database
    .from("catalog_import_jobs")
    .update({
      status: "CANCELLED",
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", jobId),
  "cancel test job",
);
const blockedLifecycle = await admin.database
  .from("catalog_import_enrichment_batches")
  .insert([
    {
      import_job_id: jobId,
      workbook_id: randomUUID(),
      status: "EXPORTED",
      total_rows: 0,
      created_by: userId,
    },
  ]);
pass(
  Boolean(blockedLifecycle.error),
  "lifecycle trigger blocks enrichment after PDF job cancellation",
);
for (const line of results) console.log(line);
console.log(
  `PDF Excel Round-trip branch integration complete: ${results.length} assertions`,
);
