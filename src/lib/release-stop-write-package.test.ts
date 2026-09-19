import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "release-candidates", "pay-rpc-gate-001");
const emergency = join(root, "emergency");
const read = (name: string) => readFileSync(join(emergency, name), "utf8");
const withoutComments = (sql: string) => sql.replace(/--.*$/gm, "");
const normalized = (sql: string) => sql.replace(/\s+/g, " ").trim();
const canonicalLfSha256 = (content: string) => createHash("sha256")
  .update(Buffer.from(content.replace(/\r\n?/g, "\n"), "utf8"))
  .digest("hex");
const signature = (name: string, args: string) => `public.${name}(${args})`;

const cMember = [
  signature("submit_custom_request", "UUID,TEXT,TEXT"),
  signature("create_custom_request_draft", "UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT"),
  signature("save_custom_request_details", "UUID,UUID,UUID,UUID,TEXT,TEXT,TEXT,NUMERIC,NUMERIC,NUMERIC,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT"),
  signature("submit_custom_request_v2", "UUID"),
  signature("cancel_custom_request", "UUID,TEXT"),
  signature("respond_custom_quotation", "UUID,TEXT,TEXT"),
  signature("create_customer_order", "UUID,JSONB"),
  signature("submit_payment_transfer", "UUID,NUMERIC,TIMESTAMPTZ,UUID"),
  signature("request_order_cancellation", "UUID,TEXT,UUID"),
];
const cStaff = [
  signature("create_custom_quotation", "UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT"),
  signature("update_custom_quotation_draft", "UUID,NUMERIC,INTEGER,INTEGER,UUID,NUMERIC,TEXT,TEXT"),
  signature("send_custom_quotation", "UUID"),
  signature("admin_transition_custom_quotation", "UUID,TEXT,TEXT"),
  signature("issue_supplier_orders", "UUID"),
  signature("create_supplier_payment", "UUID,TEXT,NUMERIC,TEXT"),
  signature("review_supplier_payment", "UUID,BOOLEAN,TEXT"),
  signature("mark_supplier_payment_paid", "UUID,UUID"),
  signature("decide_order_cancellation", "UUID,BOOLEAN,TEXT,NUMERIC,NUMERIC"),
];
const d7Writes = [
  signature("add_production_update", "UUID,TEXT,TEXT,TIMESTAMPTZ,NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,JSONB"),
  signature("record_qc_inspection", "UUID,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,UUID,JSONB"),
  signature("respond_custom_qc", "UUID,TEXT,TEXT"), signature("approve_custom_qc", "UUID"),
  signature("reopen_qc_inspection", "UUID,TEXT"),
];
const d7Reads = [signature("get_dispatch_gate", "UUID"), signature("can_dispatch_order_item", "UUID")];
const d8 = [
  signature("create_warehouse_receipt", "UUID,UUID,TIMESTAMPTZ,INTEGER,NUMERIC,NUMERIC,TEXT,JSONB,UUID[]"),
  signature("release_warehouse_receipt_item", "UUID,NUMERIC"),
  signature("create_consolidation", "UUID,UUID,TEXT,TEXT,JSONB"), signature("confirm_consolidation", "UUID"),
  signature("create_shipment_v2", "UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,NUMERIC,TEXT"),
  signature("acknowledge_partial_shipment", "UUID,TEXT"), signature("dispatch_shipment", "UUID"),
  signature("add_shipment_event", "UUID,TEXT,TIMESTAMPTZ,TEXT,TEXT,TIMESTAMPTZ,BOOLEAN,UUID"),
  signature("schedule_delivery", "UUID,TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT"),
  signature("confirm_delivery_appointment", "UUID"),
  signature("request_delivery_reschedule", "UUID,JSONB,TEXT,TEXT,TEXT,TEXT,JSONB"),
  signature("review_delivery_reschedule", "UUID,BOOLEAN,TEXT,TIMESTAMPTZ,TIMESTAMPTZ"),
  signature("advance_delivery_status", "UUID,TEXT,TEXT,TEXT,TEXT,TEXT"),
  signature("record_delivery_v2", "UUID,TIMESTAMPTZ,TEXT,TEXT,JSONB,UUID[],TEXT,TEXT"),
  signature("add_logistics_cost", "UUID,UUID,UUID,TEXT,TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,BOOLEAN,TEXT,TEXT,UUID[]"),
  signature("finalize_logistics_costs", "UUID"), signature("issue_freight_invoice", "UUID,NUMERIC,TIMESTAMPTZ,TEXT"),
];
const d9 = [
  signature("create_claim", "UUID,TEXT,TEXT,TEXT,NUMERIC,TEXT,TIMESTAMPTZ,TEXT,TEXT,UUID"),
  signature("member_claim_action", "UUID,TEXT,TEXT,UUID"),
  signature("admin_claim_action", "UUID,TEXT,TEXT,TEXT,TEXT,UUID,UUID,TIMESTAMPTZ"),
  signature("record_claim_internal_cost", "UUID,TEXT,NUMERIC,TEXT,TEXT"),
];
const d10 = [signature("get_executive_dashboard", "DATE,DATE"),
  signature("get_fixed_report", "TEXT,DATE,DATE,TEXT,INTEGER,INTEGER"),
  signature("record_fixed_report_export", "TEXT,JSONB,INTEGER")];

function expectAcl(sql: string, operation: "GRANT" | "REVOKE", expected: string[]) {
  for (const item of expected) {
    expect(normalized(sql)).toContain(`${operation} ${operation === "GRANT" ? "EXECUTE " : "ALL "}ON FUNCTION ${item}`);
  }
}

describe("Release C/D emergency stop-write package", () => {
  it("uses exact C signatures, fail-closed private stubs, and never grants in a stop file", () => {
    const sql = read("stop-c.sql");
    expect(cMember).toHaveLength(9);
    expect(cStaff).toHaveLength(9);
    expectAcl(sql, "REVOKE", [...cMember, ...cStaff]);
    expect(sql.match(/EMERGENCY_WRITE_DISABLED/g)).toHaveLength(2);
    expect(sql.match(/LANGUAGE PLPGSQL SECURITY DEFINER/g)).toHaveLength(2);
    expect(sql.match(/SET search_path = pg_catalog, public, pg_temp/g)).toHaveLength(2);
    expect(normalized(sql)).toContain("REVOKE ALL ON FUNCTION public.verify_payment_transfer(UUID,BOOLEAN,TEXT)");
    expect(normalized(sql)).toContain("REVOKE ALL ON FUNCTION public.submit_payment_transfer_bound_impl(UUID,NUMERIC,TIMESTAMPTZ,UUID)");
    expect(withoutComments(sql)).not.toMatch(/\bGRANT\b/i);
  });

  it("keeps every stop template permission-only except explicit fail-closed function replacement", () => {
    for (const name of ["stop-c.sql", "stop-d7.sql", "stop-d8.sql", "stop-d9.sql", "stop-d10.sql"]) {
      const sql = withoutComments(read(name));
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\b/i);
      expect(sql).not.toMatch(/\bGRANT\b/i);
      expect(sql).not.toMatch(/\b(ALL FUNCTIONS|ALL ROUTINES|up --all|\*)\b/i);
    }
  });

  it("stops and resumes each D slice without crossing the next gate", () => {
    const stages = [
      ["d7", d7Writes, [...d8, ...d9, ...d10]], ["d8", d8, [...d9, ...d10]],
      ["d9", d9, d10], ["d10", d10, []],
    ] as const;
    for (const [stage, own, later] of stages) {
      const stop = read(`stop-${stage}.sql`);
      const resume = read(`resume-${stage}.sql`);
      expectAcl(stop, "REVOKE", [...own]);
      expectAcl(resume, "GRANT", [...own]);
      for (const item of later) expect(normalized(resume)).not.toContain(`FUNCTION ${item}`);
    }
    expect(read("stop-d8.sql")).toMatch(/AS \$\$ SELECT FALSE \$\$/);
    expect(read("resume-d8.sql")).toMatch(/AS \$\$ SELECT TRUE \$\$/);
    for (const helper of d7Reads) {
      expect(normalized(read("stop-d7.sql"))).not.toContain(`FUNCTION ${helper}`);
      expect(normalized(read("resume-d7.sql"))).not.toContain(`FUNCTION ${helper}`);
    }
    for (const retired of [signature("create_shipment", "TEXT,JSONB"), signature("record_delivery", "UUID,TEXT,UUID,BOOLEAN")]) {
      expect(normalized(read("stop-d8.sql"))).toContain(`REVOKE ALL ON FUNCTION ${retired}`);
      expect(normalized(read("resume-d8.sql"))).not.toContain(`GRANT EXECUTE ON FUNCTION ${retired}`);
    }
  });

  it("resumes C only, restores project_admin private ACL, and keeps legacy paths revoked", () => {
    const sql = read("resume-c.sql");
    expectAcl(sql, "GRANT", [...cMember, ...cStaff]);
    expect((sql.match(/TO project_admin;/g) ?? [])).toHaveLength(2);
    expect(normalized(sql)).toContain("REVOKE ALL ON FUNCTION public.verify_payment_transfer(UUID,BOOLEAN,TEXT)");
    expect(normalized(sql)).toContain("REVOKE ALL ON FUNCTION public.submit_payment_transfer_bound_impl(UUID,NUMERIC,TIMESTAMPTZ,UUID)");
    for (const item of [...d7Writes, ...d7Reads, ...d8, ...d9, ...d10]) {
      expect(normalized(sql)).not.toContain(`GRANT EXECUTE ON FUNCTION ${item}`);
    }
  });

  it("restores private function definitions from the frozen prerequisite", () => {
    const frozen = readFileSync(join(root, "migrations", "20260920010200_pay-private-executor.sql"), "utf8");
    const resume = read("resume-c.sql");
    for (const name of ["record_customer_payment_evidence_preview", "verify_payment_transfer_private"]) {
      const pattern = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`);
      expect(normalized(resume.match(pattern)?.[0] ?? "")).toBe(normalized(frozen.match(pattern)?.[0] ?? ""));
    }
  });

  it("is deterministic/idempotent at apply time and reconcile is SELECT-only", () => {
    for (const name of ["stop-c.sql", "stop-d7.sql", "stop-d8.sql", "stop-d9.sql", "stop-d10.sql",
      "resume-c.sql", "resume-d7.sql", "resume-d8.sql", "resume-d9.sql", "resume-d10.sql"]) {
      const sql = withoutComments(read(name));
      expect(sql).not.toMatch(/\b(DROP|ALTER|TRUNCATE)\b/i);
      expect(sql).not.toMatch(/\bIF NOT EXISTS\b/i);
    }
    const reconcile = withoutComments(read("reconcile.sql"));
    expect(reconcile).toContain("current_setting('gisp.cutover_at')");
    expect(reconcile).toMatch(/customer_orders/);
    expect(reconcile).toMatch(/payment_transfers/);
    expect(reconcile).toMatch(/shipments/);
    expect(reconcile).toMatch(/file_metadata/);
    expect(reconcile).toMatch(/notification_jobs/);
    expect(reconcile).toMatch(/notifications/);
    expect(reconcile).toMatch(/audit_events/);
    expect(reconcile).toMatch(/customer_orders[\s\S]*updated_at/i);
    expect(reconcile).toMatch(/payment_schedules[\s\S]*updated_at[\s\S]*verified_at/i);
    expect(reconcile).toMatch(/payment_transfers[\s\S]*finance_verified_at/i);
    expect(reconcile).toMatch(/shipments[\s\S]*updated_at/i);
    expect(reconcile).toMatch(/co\.id[\s\S]*co\.order_number[\s\S]*co\.status/i);
    expect(reconcile).toMatch(/co\.subtotal[\s\S]*co\.grand_total[\s\S]*co\.deposit_amount[\s\S]*co\.balance_amount/i);
    expect(reconcile).toMatch(/ps\.id[\s\S]*ps\.order_id[\s\S]*ps\.status[\s\S]*ps\.due_amount[\s\S]*ps\.verified_amount/i);
    expect(reconcile).toMatch(/pt\.id[\s\S]*pt\.payment_schedule_id[\s\S]*pt\.status[\s\S]*pt\.amount[\s\S]*pt\.evidence_file_id/i);
    expect(reconcile).toMatch(/sh\.id[\s\S]*sh\.shipment_number[\s\S]*sh\.customer_order_id[\s\S]*sh\.status/i);
    expect(reconcile).toMatch(/nj\.id[\s\S]*nj\.notification_id[\s\S]*nj\.channel[\s\S]*nj\.recipient[\s\S]*nj\.status/i);
    expect(reconcile).not.toMatch(/\b(html_body|provider_message_id|last_error|finance_note|shipping_address_snapshot|destination_address_snapshot)\b/i);
    expect(reconcile).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|SET)\b/i);
    expect(reconcile).not.toMatch(/\bLOCK\b|\bFOR\s+(UPDATE|SHARE)\b/i);
    expect(reconcile).not.toMatch(/\b(NOW|CLOCK_TIMESTAMP|STATEMENT_TIMESTAMP|RANDOM|NEXTVAL|SET_CONFIG)\s*\(/i);
  });

  it("records the complete returned advisor page and marks candidate ACL as unverified", () => {
    const triage = JSON.parse(readFileSync(join(root, "security", "advisor-triage.json"), "utf8"));
    expect(triage.snapshot.projectId).toBe("865860c2-49fa-4e53-908f-9396b2f75233");
    expect(triage.snapshot.returnedIssueCount).toBe(50);
    expect(triage.returnedIssues).toHaveLength(50);
    expect(new Set(triage.returnedIssues.map(([id]: [string]) => id)).size).toBe(50);
    expect(triage.cdRelevantReturnedIssueIds).toHaveLength(11);
    expect(triage.aclMatrix.productionBActual).toBe("unverified_for_candidate");
  });

  it("uses the authoritative canonical-LF hashes for all 12 release SQL files", () => {
    const expected: Record<string, string> = {
      "20260920010000_pay-close-legacy-entry.sql": "bbbf50032469ef407f287418d69cab33f64cd8b912a425e50e23c4f0994e5ffb",
      "20260920010100_pay-evidence-binding.sql": "5a8cc2a7308fd78a7dba87244871dae08d30e1665b2193694e9b9e97eb94dac3",
      "20260920010200_pay-private-executor.sql": "e9a4b2c4745cdf07278935cf079c8c5d3db4ab8e241b74626f72ac90148eb96c",
      "20260920010300_release-c-privileges.sql": "2abb7fc8e1ca11fb1c3376b211370908810b9dbe89184528084a913912c822a5",
      "20260920010400_d7-qc-reopen-prerequisite.sql": "354f735ef430a5a15a06c1741591a3b74c47daced974e720102e039e65a50d0e",
      "20260920010500_release-d7-privileges.sql": "9be89b775164025ee03368a83fd3a24bbaab3207203921f391ab56b96dcb855e",
      "20260920010600_d8-consolidation-prerequisite.sql": "df7de020ce9ab309b96e82a3551f653e228cb240ae5bddfaf96a3dfb01934ac3",
      "20260920010700_d8-customs-prerequisite.sql": "6c30c0380cd841a92074d40103f2594e3fae3f6ef2c7efc72972f3db9f7d70b6",
      "20260920010800_release-d8-privileges.sql": "41ecb7c4486caae0db5a2118a0fe062feed713e295131376d0d63c8632231970",
      "20260920010900_d8-freight-payment-enable.sql": "5cd45106a6bc4f36de1b16a2f09f606e2f48ff8961c56e778bae6b154258c577",
      "20260920011000_release-d9-privileges.sql": "f80a8c0e2106a373333b86206c23322b3b6afe12f7504fee76c211bc0f5defd2",
      "20260920011100_release-d10-privileges.sql": "d38c80941b0172fd1d46638ea79edfbe17c7901f842318d49d39f7fbb7ced5ab",
    };
    const parent = readFileSync(join(root, "README.md"), "utf8");
    const emergencyReadme = read("README.md");
    expect(Object.keys(expected)).toHaveLength(12);
    for (const [file, hash] of Object.entries(expected)) {
      const content = readFileSync(join(root, "migrations", file), "utf8");
      expect(canonicalLfSha256(content), file).toBe(hash);
      expect(parent, `${file} parent inventory`).toContain(`\`${hash}\``);
      expect(emergencyReadme, `${file} emergency inventory`).toContain(`\`${hash}\``);
    }
  });
});
