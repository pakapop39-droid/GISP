import { readFileSync } from "node:fs";
import { createAdminClient } from "@insforge/sdk";
import { getUatPassword, UAT_ADMIN_EMAIL } from "./uat-password.mjs";

const project = JSON.parse(readFileSync(new URL("../.insforge/project.json", import.meta.url), "utf8"));
const admin = createAdminClient({ baseUrl: project.oss_host, apiKey: project.api_key });
const email = UAT_ADMIN_EMAIL;
const password = getUatPassword();
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};

let userId;
const created = await admin.auth.signUp({ email, password, name: "GISP Slice 2 UAT Owner", autoConfirm: true });
if (!created.error) userId = created.data?.user?.id;
if (!userId) {
  userId = must(await admin.database.rpc("operator_find_auth_user_id", { email_input: email }), "find UAT auth user");
}
const organization = must(await admin.database.from("organizations").select("id").eq("code", "GISP").single(), "load GISP organization");
const existingUser = must(await admin.database.from("users").select("id").eq("id", userId).maybeSingle(), "load UAT app user");
if (existingUser) {
  must(await admin.database.from("users").update({ full_name: "GISP Slice 2 UAT Owner", primary_organization_id: organization.id, status: "ACTIVE" }).eq("id", userId), "activate UAT app user");
} else {
  must(await admin.database.from("users").insert([{ id: userId, full_name: "GISP Slice 2 UAT Owner", primary_organization_id: organization.id, status: "ACTIVE" }]), "create UAT app user");
}
const role = must(await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").single(), "load Super Admin role");
const assignment = must(await admin.database.from("user_roles").select("id").eq("user_id", userId).eq("role_id", role.id).maybeSingle(), "load UAT role assignment");
if (!assignment) {
  must(await admin.database.from("user_roles").insert([{ user_id: userId, role_id: role.id, organization_id: null, assigned_by: userId }]), "assign UAT Super Admin");
}
console.log(`Slice 2 UAT account ready: ${email}`);
