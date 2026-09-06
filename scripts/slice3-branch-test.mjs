import { createAdminClient, createClient } from "@insforge/sdk";
import { getUatPassword } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey)
  throw new Error("Slice 3 branch test environment is incomplete");

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
    await admin.auth.signUp({
      email,
      password,
      name: prefix,
      autoConfirm: true,
    }),
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
  if (!id)
    id = must(
      await admin.database.rpc("operator_find_auth_user_id", {
        email_input: email,
      }),
      `lookup ${prefix}`,
    );
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

async function onboard(client, suffix) {
  must(
    await client.database.rpc("save_member_onboarding", {
      contact_name_input: `Slice 3 Member ${suffix}`,
      contact_phone_input: "0800000000",
      company_name_input: `Slice 3 Member ${suffix} ${runId}`,
      company_legal_name_input: `Slice 3 Member ${suffix} ${runId} Co., Ltd.`,
      tax_id_input: `${suffix === "A" ? "03" : "13"}${String(runId).slice(-11)}`,
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
    `save onboarding ${suffix}`,
  );
  return must(
    await client.database.rpc("submit_member_application", {}),
    `submit application ${suffix}`,
  );
}

const operator = await createUser("slice3-admin");
let internalOrganization = must(
  await admin.database
    .from("organizations")
    .select("id")
    .eq("code", "GISP")
    .maybeSingle(),
  "load GISP organization",
);
if (!internalOrganization)
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
    "create GISP organization",
  )[0];
must(
  await admin.database.from("users").insert([
    {
      id: operator.id,
      primary_organization_id: internalOrganization.id,
      full_name: "Slice 3 Visit Admin",
      status: "ACTIVE",
    },
  ]),
  "create visit admin profile",
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
      user_id: operator.id,
      role_id: superRole.id,
      organization_id: null,
      assigned_by: operator.id,
    },
  ]),
  "assign Super Admin role",
);
const operatorClient = await signIn(operator);

const memberA = await createUser("slice3-member-a");
const memberB = await createUser("slice3-member-b");
const memberAClient = await signIn(memberA);
const memberBClient = await signIn(memberB);
const applicationA = await onboard(memberAClient, "A");
const applicationB = await onboard(memberBClient, "B");
must(
  await operatorClient.database.rpc("approve_member_application", {
    application_id_input: applicationA,
    review_note_input: "Slice 3 integration approval",
  }),
  "approve member A",
);
must(
  await operatorClient.database.rpc("approve_member_application", {
    application_id_input: applicationB,
    review_note_input: "Slice 3 integration approval",
  }),
  "approve member B",
);

// Seed a unique product for every run. Reusing a copied catalog row makes this
// regression test depend on member-price validity in the parent snapshot.
let product = null;
if (!product) {
  const supplier = must(
    await admin.database
      .from("suppliers")
      .insert([
        {
          code: `S3-${runId}`,
          name: "Slice 3 UAT Supplier",
          legal_name: "Slice 3 UAT Supplier Co., Ltd.",
          country_code: "TH",
          default_currency: "THB",
          contact_name: "Showroom Coordinator",
          contact_email: "showroom@example.com",
          contact_phone: "020000003",
          status: "ACTIVE",
        },
      ])
      .select("id")
      .single(),
    "seed UAT supplier",
  );
  const category = must(
    await admin.database
      .from("categories")
      .insert([
        {
          code: `S3-${runId}`,
          name_th: "เฟอร์นิเจอร์ UAT",
          name_en: "UAT Furniture",
          status: "ACTIVE",
          sort_order: 1,
        },
      ])
      .select("id")
      .single(),
    "seed UAT category",
  );
  product = must(
    await admin.database
      .from("products")
      .insert([
        {
          supplier_id: supplier.id,
          category_id: category.id,
          sku: `S3-UAT-${runId}`,
          product_type: "STANDARD",
          name_th: "โซฟา Slice 3 UAT",
          name_en: "Slice 3 UAT Sofa",
          description_th: "สินค้าจำลองสำหรับทดสอบ Project",
          specification_summary: "โซฟา 3 ที่นั่ง ผ้าสีธรรมชาติ",
          default_lead_time_days: 30,
          factory_cost: 15000,
          factory_currency: "THB",
          status: "PUBLISHED",
          qa_status: "PASSED",
          reviewed_by: operator.id,
          reviewed_at: new Date().toISOString(),
          review_note: "Slice 3 UAT seed passed automated review",
          published_at: new Date().toISOString(),
          created_by: operator.id,
        },
      ])
      .select("id,sku,name_th")
      .single(),
    "seed UAT product",
  );
  const variant = must(
    await admin.database
      .from("product_variants")
      .insert([
        {
          product_id: product.id,
          sku: `${product.sku}-NAT`,
          name: "สีธรรมชาติ",
          specification_summary: "ผ้าสีธรรมชาติ",
          status: "ACTIVE",
        },
      ])
      .select("id")
      .single(),
    "seed UAT variant",
  );
  const option = must(
    await admin.database
      .from("product_options")
      .insert([
        {
          product_id: product.id,
          name: "สีผ้า",
          is_required: true,
          sort_order: 1,
          status: "ACTIVE",
        },
      ])
      .select("id")
      .single(),
    "seed UAT option",
  );
  must(
    await admin.database.from("product_option_values").insert([
      {
        option_id: option.id,
        label: "สีธรรมชาติ",
        member_price_delta: 0,
        factory_cost_delta: 0,
        status: "ACTIVE",
        sort_order: 1,
      },
    ]),
    "seed UAT option value",
  );
  must(
    await admin.database.from("product_prices").insert(
      [null, variant.id].map((priceVariantId) => ({
        product_id: product.id,
        variant_id: priceVariantId,
        price_type: "MEMBER",
        amount: 31500,
        currency: "THB",
        // Keep the seed active even when the local and backend clocks differ by
        // a few seconds during an immediate catalog assertion.
        valid_from: new Date(Date.now() - 60_000).toISOString(),
        status: "ACTIVE",
        created_by: operator.id,
        suggested_resale_amount: 42000,
        freight_estimate_min: 2500,
        freight_estimate_max: 3500,
      })),
    ),
    "seed product-level and variant UAT prices",
  );
}
const visibleCatalogRows = must(
  await memberAClient.database
    .from("member_catalog")
    .select("id,price_id")
    .eq("id", product.id),
  "verify the UAT product is visible in Member Catalog",
);
assert(
  visibleCatalogRows.length > 0,
  "UAT product appears in Member Catalog before project testing",
);
const variantRows = must(
  await admin.database
    .from("product_variants")
    .select("id")
    .eq("product_id", product.id)
    .eq("status", "ACTIVE")
    .limit(1),
  "load active variant",
);
const optionRows = must(
  await admin.database
    .from("product_options")
    .select("id,name,is_required")
    .eq("product_id", product.id)
    .eq("status", "ACTIVE")
    .order("sort_order"),
  "load active options",
);
const selectedOptions = [];
for (const option of optionRows) {
  const values = must(
    await admin.database
      .from("product_option_values")
      .select("id,label")
      .eq("option_id", option.id)
      .eq("status", "ACTIVE")
      .order("sort_order")
      .limit(1),
    `load value for ${option.name}`,
  );
  if (values[0])
    selectedOptions.push({
      optionId: option.id,
      valueId: values[0].id,
      label: values[0].label,
    });
}

const projectA = must(
  await memberAClient.database.rpc("create_project_v2", {
    name_input: `Slice 3 Project A ${runId}`,
    project_type_input: "RESIDENTIAL",
    end_customer_name_input: "Slice 3 End Customer",
    end_customer_phone_input: "0890000000",
    end_customer_email_input: "customer@example.com",
    site_address_input: "Bangkok test site",
    expected_need_date_input: new Date(Date.now() + 60 * 86400000)
      .toISOString()
      .slice(0, 10),
    note_input: "Integration project",
  }),
  "create project A",
);
const projectB = must(
  await memberBClient.database.rpc("create_project_v2", {
    name_input: `Slice 3 Project B ${runId}`,
    project_type_input: "COMMERCIAL",
    end_customer_name_input: "Other Customer",
    end_customer_phone_input: "",
    end_customer_email_input: "",
    site_address_input: "Bangkok other site",
    expected_need_date_input: null,
    note_input: "",
  }),
  "create project B",
);
const areaId = must(
  await memberAClient.database.rpc("create_project_area", {
    project_id_input: projectA,
    name_input: "Living Room",
    note_input: "Ground floor",
  }),
  "create project area",
);
const itemId = must(
  await memberAClient.database.rpc("add_standard_project_item_v2", {
    project_id_input: projectA,
    area_id_input: areaId,
    product_id_input: product.id,
    variant_id_input: variantRows[0]?.id ?? null,
    selected_options_input: selectedOptions,
    quantity_input: 1,
  }),
  "add catalog item to project",
);
assert(Boolean(itemId), "member adds a published standard product without RFQ");

must(
  await memberAClient.database.rpc("update_project_item_v2", {
    project_item_id_input: itemId,
    area_id_input: areaId,
    variant_id_input: variantRows[0]?.id ?? null,
    selected_options_input: selectedOptions,
    quantity_input: 2,
  }),
  "edit project item",
);
const editedItem = must(
  await memberAClient.database
    .from("project_items")
    .select(
      "quantity,status,suggested_resale_amount,freight_estimate_min,freight_estimate_max,lead_time_days_snapshot",
    )
    .eq("id", itemId)
    .single(),
  "read edited item",
);
assert(
  Number(editedItem.quantity) === 2 && editedItem.status === "READY_TO_ORDER",
  "quantity/options edit recalculates READY_TO_ORDER",
);
assert(
  editedItem.suggested_resale_amount !== null &&
    editedItem.lead_time_days_snapshot !== null,
  "schedule snapshots resale and lead time",
);

const crossProject = must(
  await memberBClient.database.from("projects").select("id").eq("id", projectA),
  "member B project read",
);
assert(crossProject.length === 0, "RLS hides member A project from member B");
const crossEdit = await memberBClient.database.rpc("update_project_item_v2", {
  project_item_id_input: itemId,
  area_id_input: null,
  variant_id_input: null,
  selected_options_input: [],
  quantity_input: 99,
});
assert(Boolean(crossEdit.error), "member B cannot edit member A project item");

let schedule = must(
  await memberAClient.database.rpc("get_member_project_schedule", {
    project_id_input: projectA,
  }),
  "load schedule before visit",
);
assert(
  schedule.length === 1 && schedule[0].supplier_name === null,
  "schedule hides Supplier before completed visit",
);
assert(
  Number(schedule[0].member_price) > 0 && schedule[0].suggested_resale !== null,
  "schedule contains member price and suggested resale",
);

const foreignVisit = await memberAClient.database.rpc(
  "request_showroom_visit",
  {
    project_id_input: projectB,
    product_id_input: product.id,
    preferred_at_input: new Date(Date.now() + 7 * 86400000).toISOString(),
    attendee_count_input: 1,
    note_input: "cross tenant",
  },
);
assert(
  Boolean(foreignVisit.error),
  "member cannot request a visit for another member project",
);
const visitId = must(
  await memberAClient.database.rpc("request_showroom_visit", {
    project_id_input: projectA,
    product_id_input: product.id,
    preferred_at_input: new Date(Date.now() + 7 * 86400000).toISOString(),
    attendee_count_input: 2,
    note_input: "Inspect finish",
  }),
  "request showroom visit",
);
const safeVisits = must(
  await memberAClient.database.rpc("get_member_showroom_visits", {
    project_id_input: projectA,
  }),
  "load member visits",
);
assert(
  safeVisits.length === 1 && !Object.hasOwn(safeVisits[0], "supplier_id"),
  "member visit projection never exposes Supplier ID",
);
const directVisitRead = await memberAClient.database
  .from("showroom_visit_requests")
  .select("id,supplier_id")
  .eq("id", visitId);
assert(
  Boolean(directVisitRead.error),
  "direct member read of visit base table is denied",
);
const directGrantRead = await memberAClient.database
  .from("supplier_disclosure_grants")
  .select("id,supplier_id");
assert(
  Boolean(directGrantRead.error),
  "direct member read of disclosure base table is denied",
);
const prematureComplete = await operatorClient.database.rpc(
  "review_showroom_visit",
  {
    visit_id_input: visitId,
    action_input: "COMPLETE",
    note_input: "skip approval",
  },
);
assert(
  Boolean(prematureComplete.error),
  "visit cannot skip SUBMITTED to COMPLETED",
);
const memberReview = await memberBClient.database.rpc("review_showroom_visit", {
  visit_id_input: visitId,
  action_input: "APPROVE",
  note_input: "unauthorized",
});
assert(Boolean(memberReview.error), "member cannot review showroom visits");

must(
  await operatorClient.database.rpc("review_showroom_visit", {
    visit_id_input: visitId,
    action_input: "APPROVE",
    note_input: "Meet at GISP showroom, 10:00",
  }),
  "approve showroom visit",
);
let memberVisits = must(
  await memberAClient.database.rpc("get_member_showroom_visits", {
    project_id_input: projectA,
  }),
  "read approved visit",
);
assert(
  memberVisits[0].status === "APPROVED" &&
    memberVisits[0].visit_instruction.includes("GISP"),
  "member sees approved visit instructions",
);
must(
  await operatorClient.database.rpc("review_showroom_visit", {
    visit_id_input: visitId,
    action_input: "COMPLETE",
    note_input: "Visit completed",
  }),
  "complete showroom visit",
);

let disclosures = must(
  await memberAClient.database.rpc("get_member_project_disclosures", {
    project_id_input: projectA,
  }),
  "load active disclosure",
);
assert(
  disclosures.length === 1 &&
    disclosures[0].status === "ACTIVE" &&
    disclosures[0].supplier_name,
  "completed visit reveals Supplier identity to exact member profile",
);
const otherDisclosure = must(
  await memberBClient.database.rpc("get_member_project_disclosures", {
    project_id_input: projectB,
  }),
  "load other member disclosures",
);
assert(
  otherDisclosure.length === 0,
  "Supplier grant does not leak to another member profile",
);
schedule = must(
  await memberAClient.database.rpc("get_member_project_schedule", {
    project_id_input: projectA,
  }),
  "load disclosed schedule",
);
assert(
  schedule[0].supplier_name && Object.hasOwn(schedule[0], "supplier_contact"),
  "Product Schedule includes the disclosed Supplier fields",
);

must(
  await operatorClient.database.rpc("revoke_supplier_disclosure", {
    grant_id_input: disclosures[0].id,
    reason_input: "UAT verifies Super Admin revocation",
  }),
  "revoke Supplier disclosure",
);
disclosures = must(
  await memberAClient.database.rpc("get_member_project_disclosures", {
    project_id_input: projectA,
  }),
  "load revoked disclosure",
);
assert(
  disclosures[0].status === "REVOKED" &&
    disclosures[0].supplier_name === null &&
    disclosures[0].revoke_reason,
  "revocation redacts identity and retains reason",
);
schedule = must(
  await memberAClient.database.rpc("get_member_project_schedule", {
    project_id_input: projectA,
  }),
  "load schedule after revocation",
);
assert(
  schedule[0].supplier_name === null,
  "revocation removes Supplier from Product Schedule",
);

const cancellableVisit = must(
  await memberAClient.database.rpc("request_showroom_visit", {
    project_id_input: projectA,
    product_id_input: product.id,
    preferred_at_input: new Date(Date.now() + 8 * 86400000).toISOString(),
    attendee_count_input: 1,
    note_input: "Cancel flow",
  }),
  "create cancellable visit",
);
must(
  await memberAClient.database.rpc("cancel_showroom_visit", {
    visit_id_input: cancellableVisit,
    reason_input: "Project schedule changed",
  }),
  "cancel showroom visit",
);
memberVisits = must(
  await memberAClient.database.rpc("get_member_showroom_visits", {
    project_id_input: projectA,
  }),
  "read cancelled visit",
);
assert(
  memberVisits.some(
    (row) => row.id === cancellableVisit && row.status === "CANCELLED",
  ),
  "member can cancel before completion",
);

const auditRows = must(
  await admin.database
    .from("audit_events")
    .select("action,entity_type")
    .in("entity_type", ["showroom_visit", "supplier_disclosure"])
    .order("created_at", { ascending: false })
    .limit(20),
  "load Slice 3 audit trail",
);
assert(
  auditRows.some((row) => row.action === "GRANTED") &&
    auditRows.some((row) => row.action === "REVOKED"),
  "grant and revoke actions are audited",
);

for (const line of results) console.log(line);
console.log(
  `Slice 3 branch integration complete: ${results.length} assertions`,
);
console.log(`Browser member: ${memberA.email}`);
console.log(`Browser admin: ${operator.email}`);
console.log(`Browser password: ${password}`);
