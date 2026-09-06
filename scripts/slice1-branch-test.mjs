import { createAdminClient, createClient } from "@insforge/sdk";
import { createHash } from "node:crypto";
import { getUatPassword } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
if (!baseUrl || !apiKey || !anonKey) throw new Error("Branch test environment is incomplete");

const admin = createAdminClient({ baseUrl, apiKey });
const password = getUatPassword();
const runId = Date.now();
const results = [];
const assert = (condition, label) => { if (!condition) throw new Error(`FAILED: ${label}`); results.push(`PASS: ${label}`); };
const must = (result, label) => { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; };
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function createAuthUser(prefix) {
  const email = `${prefix}.${runId}@example.com`;
  const creator = createAdminClient({ baseUrl, apiKey });
  const created = must(await creator.auth.signUp({ email, password, name: prefix, autoConfirm: true }), `create ${prefix}`);
  const directUser = created?.user;
  let id = directUser?.id;
  let tokenPayloadKeys = [];
  if (!id && created?.accessToken) {
    const createdClient = createClient({ baseUrl, accessToken: created.accessToken, isServerMode: true });
    const current = must(await createdClient.auth.getCurrentUser(), `read created ${prefix}`);
    id = current.user?.id;
    if (!id) {
      const payload = JSON.parse(Buffer.from(created.accessToken.split(".")[1], "base64url").toString("utf8"));
      tokenPayloadKeys = Object.keys(payload);
      id = payload.sub ?? payload.user_id ?? payload.id;
    }
  }
  if (!id) id = must(await admin.database.rpc("operator_find_auth_user_id", { email_input: email }), `lookup ${prefix}`);
  if (!id) throw new Error(`create ${prefix}: user identity missing; token payload keys ${tokenPayloadKeys.join(",")}`);
  return { id, email };
}

async function signIn(user) {
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email: user.email, password }), `sign in ${user.email}`);
  return client;
}

async function registerSession(client, label) {
  const raw = `${label}-${runId}-${Math.random()}`;
  must(await client.database.rpc("register_app_session", {
    token_hash_input: hash(raw),
    expires_at_input: new Date(Date.now() + 86400000).toISOString(),
    ip_address_input: "127.0.0.1",
    user_agent_input: "GISP Slice 1 integration test",
  }), `register session ${label}`);
  return hash(raw);
}

async function onboard(client, suffix) {
  const profileId = must(await client.database.rpc("save_member_onboarding", {
    contact_name_input: `Member ${suffix}`, contact_phone_input: "0800000000",
    company_name_input: `GISP Test ${suffix}`, company_legal_name_input: `GISP Test ${suffix} Co., Ltd.`,
    tax_id_input: `01055${String(runId).slice(-8)}`, business_type_input: "Interior Design",
    address_line_input: "Bangkok", district_input: "Pathum Wan", province_input: "Bangkok",
    postal_code_input: "10330", service_areas_input: ["Bangkok"], product_interests_input: ["Furniture"],
    training_interest_input: true, training_note_input: "Materials",
  }), `save onboarding ${suffix}`);
  const applicationId = must(await client.database.rpc("submit_member_application", {}), `submit application ${suffix}`);
  return { profileId, applicationId };
}

const owner = await createAuthUser("owner");
must(await admin.database.rpc("operator_bootstrap_super_admin", { target_user_id_input: owner.id, full_name_input: "Project Owner" }), "bootstrap owner");
const ownerClient = await signIn(owner);
const ownerSession = await registerSession(ownerClient, "owner");
const ownerContext = must(await ownerClient.database.rpc("get_app_access_context", { token_hash_input: ownerSession }), "owner context");
assert(ownerContext.roles.includes("SUPER_ADMIN") && ownerContext.permissions.includes("permissions.manage"), "owner is the audited initial Super Admin");

const memberA = await createAuthUser("member-a");
const memberB = await createAuthUser("member-b");
const clientA = await signIn(memberA); const clientB = await signIn(memberB);
let sessionA = await registerSession(clientA, "member-a");
const sessionB = await registerSession(clientB, "member-b");
const onboardingA = await onboard(clientA, "A");
const onboardingB = await onboard(clientB, "B");

must(await ownerClient.database.rpc("approve_member_application", { application_id_input: onboardingA.applicationId, review_note_input: "integration approval" }), "approve A");
must(await ownerClient.database.rpc("reject_member_application", { application_id_input: onboardingB.applicationId, reason_input: "กรุณาตรวจเลขภาษี" }), "reject B");
let contextB = must(await clientB.database.rpc("get_app_access_context", { token_hash_input: sessionB }), "B rejected context");
assert(contextB.applicationStatus === "REJECTED", "reject state is visible to the member");
must(await clientB.database.rpc("submit_member_application", {}), "resubmit B");
must(await ownerClient.database.rpc("approve_member_application", { application_id_input: onboardingB.applicationId, review_note_input: "approved after resubmit" }), "approve resubmitted B");

const profiles = must(await admin.database.from("member_profiles").select("id,user_id,organization_id"), "load profiles");
const profileA = profiles.find((row) => row.user_id === memberA.id);
const profileB = profiles.find((row) => row.user_id === memberB.id);
const projectRows = must(await admin.database.from("projects").insert([
  { organization_id: profileA.organization_id, member_profile_id: profileA.id, project_number: `PRJ-A-${runId}`, name: "A private project", site_address: "A site", created_by: memberA.id },
  { organization_id: profileB.organization_id, member_profile_id: profileB.id, project_number: `PRJ-B-${runId}`, name: "B private project", site_address: "B site", created_by: memberB.id },
]).select("id,member_profile_id,name"), "seed isolated projects");
const visibleA = must(await clientA.database.from("projects").select("id,member_profile_id,name"), "member A project read");
assert(visibleA.length === 1 && visibleA[0].member_profile_id === profileA.id, "RLS isolates two active Member Profiles");

must(await ownerClient.database.rpc("suspend_user", { target_user_id_input: memberA.id, reason_input: "integration suspension" }), "suspend A");
const revokedContext = must(await clientA.database.rpc("get_app_access_context", { token_hash_input: sessionA }), "revoked session lookup");
assert(revokedContext === null, "suspension revokes all prior GISP app sessions");
const suspendedClient = await signIn(memberA);
sessionA = await registerSession(suspendedClient, "member-a-suspended");
const suspendedContext = must(await suspendedClient.database.rpc("get_app_access_context", { token_hash_input: sessionA }), "suspended context");
const suspendedDirect = must(await suspendedClient.database.from("projects").select("id,name"), "suspended direct project read");
const safeHistory = must(await suspendedClient.database.rpc("get_member_history", {}), "sanitized history");
assert(suspendedContext.userStatus === "SUSPENDED" && suspendedDirect.length === 0 && safeHistory.some((row) => row.item_id === projectRows[0].id), "suspended member gets sanitized history but no base-table access");
assert(!Object.keys(safeHistory[0]).some((key) => /price|cost|supplier|total/i.test(key)), "sanitized history excludes price, cost and supplier fields");
must(await ownerClient.database.rpc("reactivate_user", { target_user_id_input: memberA.id }), "reactivate A");

const protectedLastAdmin = await ownerClient.database.rpc("revoke_production_role", { target_user_id_input: owner.id, role_code_input: "SUPER_ADMIN" });
assert(Boolean(protectedLastAdmin.error), "last active Super Admin cannot lose the role");

async function nextReferenceWithRetry() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await admin.database.rpc("next_record_reference", { target_prefix: "PRJ" });
    if (!result.error || !/socket hang up|ECONNRESET|fetch failed/i.test(result.error.message)) return result;
    if (attempt === 3) return result;
  }
}
const directReference = await ownerClient.database.rpc("next_record_reference", { target_prefix: "PRJ" });
const directDocument = await ownerClient.database.rpc("next_document_number", { target_document_type: "ORD" });
assert(Boolean(directReference.error) && Boolean(directDocument.error), "authenticated users cannot allocate numbers outside permission-checked business actions");
const refs = await Promise.all(Array.from({ length: 20 }, () => nextReferenceWithRetry()));
const numbers = refs.map((result) => must(result, "concurrent reference"));
assert(new Set(numbers).size === numbers.length, "concurrent record references are unique");

const docTypes = ["QT","ORD","SO","PO","INV","INV-DEP","INV-BAL","INV-FRT","PAY","SHP","DLV","CLM"];
const documents = [];
for (const type of docTypes) documents.push(await admin.database.rpc("next_document_number", { target_document_type: type }));
assert(documents.every((result) => !result.error), "all approved atomic document types generate successfully");

must(await admin.database.from("file_metadata").insert([{ member_profile_id: profileA.id, organization_id: profileA.organization_id, bucket: "gisp-member-private", object_key: `members/${profileA.id}/rls-${runId}.pdf`, original_name: "rls.pdf", mime_type: "application/pdf", size_bytes: 10, visibility: "MEMBER_PRIVATE", entity_type: "MEMBER_APPLICATION", uploaded_by: memberA.id }]), "seed file metadata");
const filesA = must(await suspendedClient.database.from("file_metadata").select("id,member_profile_id"), "A file metadata");
const filesB = must(await clientB.database.from("file_metadata").select("id,member_profile_id"), "B file metadata");
assert(filesA.length === 1 && filesB.length === 0, "file metadata cannot cross Member Profiles");

const auditRow = must(await admin.database.from("audit_events").select("id").limit(1).single(), "find audit row");
const auditMutation = await admin.database.from("audit_events").update({ action: "TAMPERED" }).eq("id", auditRow.id);
assert(Boolean(auditMutation.error), "audit log is append-only even for admin API calls");

must(await ownerClient.database.rpc("revoke_all_app_sessions", { target_user_id_input: memberA.id, reason_input: "INTEGRATION_FORCE_LOGOUT" }), "force logout A");
const forcedContext = must(await suspendedClient.database.rpc("get_app_access_context", { token_hash_input: sessionA }), "forced session lookup");
assert(forcedContext === null, "force logout invalidates the target user's current app session");

for (const line of results) console.log(line);
console.log(`Slice 1 branch integration complete: ${results.length} assertions`);
