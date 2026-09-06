import { createAdminClient, createClient } from "@insforge/sdk";
import {
  getUatPassword,
  UAT_ADMIN_EMAIL,
  UAT_MEMBER_EMAIL,
} from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) {
  throw new Error("Slice 10 branch test environment is incomplete");
}
if (!baseUrl.includes("kit6y4pj-xjz")) {
  throw new Error("Refusing to test outside Slice 10 backend branch");
}

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const forbiddenKeys = new Set([
  "factory_cost",
  "total_factory_cost",
  "paid_factory_amount",
  "supplier_cost",
  "internal_note",
  "claim_internal_costs",
  "evidence_file_id",
  "recipient_phone",
  "contact_phone",
  "shipping_address_snapshot",
  "delivery_address_snapshot",
]);

const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAILED: ${label}`);
  results.push(`PASS: ${label}`);
};
async function signIn(email) {
  const client = createClient({ baseUrl, anonKey });
  must(
    await client.auth.signInWithPassword({ email, password }),
    `sign in ${email}`,
  );
  return client;
}
function payloadHasForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(payloadHasForbiddenKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => forbiddenKeys.has(key) || payloadHasForbiddenKey(child),
  );
}

const operator = await signIn(UAT_ADMIN_EMAIL);
const member = await signIn(UAT_MEMBER_EMAIL);

async function createCrossMemberOrder() {
  const email = `slice10-cross-${runId}@example.com`;
  const created = must(
    await admin.auth.signUp({
      email,
      password,
      name: "Slice 10 Cross Member",
      autoConfirm: true,
    }),
    "create cross member",
  );
  let userId = created?.user?.id;
  if (!userId && created?.accessToken) {
    const temporary = createClient({
      baseUrl,
      accessToken: created.accessToken,
      isServerMode: true,
    });
    userId = must(await temporary.auth.getCurrentUser(), "read cross member").user?.id;
  }
  if (!userId) {
    userId = must(
      await admin.database.rpc("operator_find_auth_user_id", {
        email_input: email,
      }),
      "lookup cross member",
    );
  }
  const client = await signIn(email);
  must(
    await client.database.rpc("save_member_onboarding", {
      contact_name_input: "Slice 10 Cross Member",
      contact_phone_input: "0800000000",
      company_name_input: `Slice 10 Cross Company ${runId}`,
      company_legal_name_input: `Slice 10 Cross Company ${runId} Limited`,
      tax_id_input: `77${String(runId).slice(-11)}`,
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
    "save cross member onboarding",
  );
  const applicationId = must(
    await client.database.rpc("submit_member_application", {}),
    "submit cross member",
  );
  must(
    await operator.database.rpc("approve_member_application", {
      application_id_input: applicationId,
      review_note_input: "Slice 10 cross-member isolation",
    }),
    "approve cross member",
  );
  const profile = must(
    await admin.database
      .from("member_profiles")
      .select("id,organization_id")
      .eq("user_id", userId)
      .single(),
    "load cross profile",
  );
  const project = must(
    await admin.database
      .from("projects")
      .insert([
        {
          organization_id: profile.organization_id,
          member_profile_id: profile.id,
          project_number: `PRJ-S10-X-${runId}`,
          name: `Slice 10 Isolation ${runId}`,
          site_address: "Hidden cross-member project",
          status: "ACTIVE",
          created_by: userId,
        },
      ])
      .select("id")
      .single(),
    "create cross project",
  );
  const orderNumber = `ORD-S10-X-${runId}`;
  must(
    await admin.database.from("customer_orders").insert([
      {
        organization_id: profile.organization_id,
        member_profile_id: profile.id,
        project_id: project.id,
        order_number: orderNumber,
        status: "PENDING_DEPOSIT",
        currency: "THB",
        subtotal: 10000,
        vat_rate_snapshot: 7,
        vat_amount: 700,
        grand_total: 10700,
        deposit_amount: 5350,
        balance_amount: 5350,
        shipping_address_snapshot: { note: "must not leak" },
        created_by: userId,
      },
    ]),
    "create cross order",
  );
  return orderNumber;
}

const crossOrderNumber = await createCrossMemberOrder();
const memberDashboard = must(
  await member.database.rpc("get_member_dashboard", {}),
  "member dashboard",
);
assert(
  typeof memberDashboard.metrics?.active_orders === "number",
  "member dashboard returns live metrics",
);
assert(
  Array.isArray(memberDashboard.actions),
  "member dashboard returns an action queue",
);

const deniedOperations = await member.database.rpc(
  "get_admin_operations_dashboard",
  {},
);
assert(Boolean(deniedOperations.error), "member cannot read operations dashboard");
const deniedExecutive = await member.database.rpc("get_executive_dashboard", {
  date_from_input: "2026-01-01",
  date_to_input: "2026-12-31",
});
assert(Boolean(deniedExecutive.error), "member cannot read executive dashboard");

const operations = must(
  await operator.database.rpc("get_admin_operations_dashboard", {}),
  "admin operations dashboard",
);
assert(
  operations.permissions?.reports === true,
  "operations dashboard reflects fixed-report permission",
);
assert(
  Array.isArray(operations.actions),
  "operations dashboard uses real linked actions",
);
const executive = must(
  await operator.database.rpc("get_executive_dashboard", {
    date_from_input: "2026-01-01",
    date_to_input: "2026-12-31",
  }),
  "executive dashboard",
);
assert(
  Array.isArray(executive.financial?.order_value),
  "executive financial metrics are grouped by currency",
);
assert(
  !payloadHasForbiddenKey(executive),
  "executive payload excludes confidential detail fields",
);

for (const reportType of ["order", "payment", "delay", "delivery", "claim"]) {
  const memberReport = must(
    await member.database.rpc("get_fixed_report", {
      report_type_input: reportType,
      date_from_input: "2026-01-01",
      date_to_input: "2026-12-31",
      status_filter_input: null,
      row_limit_input: 500,
      row_offset_input: 0,
    }),
    `member ${reportType} report`,
  );
  assert(
    !payloadHasForbiddenKey(memberReport),
    `member ${reportType} report excludes confidential fields`,
  );
  assert(
    !JSON.stringify(memberReport).includes(crossOrderNumber),
    `member ${reportType} report isolates another member`,
  );

  const adminReport = must(
    await operator.database.rpc("get_fixed_report", {
      report_type_input: reportType,
      date_from_input: "2026-01-01",
      date_to_input: "2026-12-31",
      status_filter_input: null,
      row_limit_input: 500,
      row_offset_input: 0,
    }),
    `admin ${reportType} report`,
  );
  assert(
    !payloadHasForbiddenKey(adminReport),
    `admin ${reportType} core report excludes cost/confidential fields`,
  );
}

const invalidRange = await operator.database.rpc("get_fixed_report", {
  report_type_input: "order",
  date_from_input: "2024-01-01",
  date_to_input: "2026-12-31",
  status_filter_input: null,
  row_limit_input: 500,
  row_offset_input: 0,
});
assert(Boolean(invalidRange.error), "report date range is capped at 366 days");

const exportAuditId = must(
  await operator.database.rpc("record_fixed_report_export", {
    report_type_input: "order",
    filters_input: {
      date_from: "2026-01-01",
      date_to: "2026-12-31",
      status: null,
    },
    row_count_input: 1,
  }),
  "record report export",
);
const audit = must(
  await admin.database
    .from("audit_events")
    .select("id,entity_type,action,after_data")
    .eq("id", exportAuditId)
    .single(),
  "read report export audit",
);
assert(
  audit.entity_type === "fixed_report" && audit.action === "EXPORTED",
  "CSV export produces an append-only audit event",
);

for (const line of results) console.log(line);
console.log(`Slice 10 branch integration complete: ${results.length} assertions`);
