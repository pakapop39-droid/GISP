import { createAdminClient, createClient } from "@insforge/sdk";
import { UAT_ADMIN_EMAIL, UAT_MEMBER_EMAIL } from "./uat-password.mjs";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
const password = process.env.GISP_UAT_PASSWORD;

if (!baseUrl || !apiKey || !anonKey || !password) {
  throw new Error("INSFORGE_URL, INSFORGE_API_KEY, NEXT_PUBLIC_INSFORGE_ANON_KEY, and GISP_UAT_PASSWORD are required");
}

const admin = createAdminClient({ baseUrl, apiKey });
const legacyEmails = {
  admin: ["uat-admin@gisp.example.com", "uat-admin-shared@gisp.example.com"],
  member: ["uat-member@gisp.example.com", "uat-member-shared@gisp.example.com"],
};

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findAuthUser(email) {
  const response = await fetch(`${baseUrl}/api/auth/users?limit=100&search=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`list auth user ${email}: HTTP ${response.status}`);
  const body = await response.json();
  const users = body.data ?? body.users ?? body;
  return users.find((user) => user.email === email) ?? null;
}

async function createAndSignIn(email, name) {
  const existing = await findAuthUser(email);
  if (!existing) {
    must(await admin.auth.signUp({ email, password, name, autoConfirm: true }), `create ${email}`);
  }
  const client = createClient({ baseUrl, anonKey });
  must(await client.auth.signInWithPassword({ email, password }), `sign in ${email}`);
  const user = must(await client.auth.getCurrentUser(), `read ${email}`).user;
  if (!user?.id) throw new Error(`auth user id missing for ${email}`);
  return { id: user.id, client };
}

async function ensureAppUser(id, values) {
  const existing = must(await admin.database.from("users").select("id").eq("id", id).maybeSingle(), `load app user ${id}`);
  if (existing) {
    must(await admin.database.from("users").update(values).eq("id", id), `activate app user ${id}`);
  } else {
    must(await admin.database.from("users").insert([{ id, ...values }]), `create app user ${id}`);
  }
}

const legacyAdmins = (await Promise.all(legacyEmails.admin.map(findAuthUser))).filter(Boolean);
const legacyMembers = (await Promise.all(legacyEmails.member.map(findAuthUser))).filter(Boolean);
if (!legacyAdmins.length || !legacyMembers.length) throw new Error("legacy shared UAT accounts are missing");
const legacyAdminIds = legacyAdmins.map((user) => user.id);
const legacyMemberIds = legacyMembers.map((user) => user.id);
const legacyAdminApps = must(
  await admin.database.from("users").select("id,primary_organization_id").in("id", legacyAdminIds),
  "load legacy UAT admins",
);
const adminOrganizationId = legacyAdminApps.find((user) => user.primary_organization_id)?.primary_organization_id;
if (!adminOrganizationId) throw new Error("legacy UAT admin organization is missing");

const newAdmin = await createAndSignIn(UAT_ADMIN_EMAIL, "GISP Shared UAT Admin");
const newMember = await createAndSignIn(UAT_MEMBER_EMAIL, "GISP Shared UAT Member");
const legacyMemberProfiles = must(
  await admin.database.from("member_profiles").select("id,organization_id,user_id").in("user_id", legacyMemberIds),
  "load legacy UAT member profiles",
);
const existingNewMemberProfile = must(
  await admin.database.from("member_profiles").select("id,organization_id,user_id").eq("user_id", newMember.id).maybeSingle(),
  "load transferred UAT member profile",
);
const legacyMemberProfile = legacyMemberProfiles[0] ?? null;
const sharedMemberProfile = existingNewMemberProfile ?? legacyMemberProfile;
if (!sharedMemberProfile) throw new Error("shared UAT member profile is missing");

await ensureAppUser(newAdmin.id, {
  primary_organization_id: adminOrganizationId,
  full_name: "GISP Shared UAT Admin",
  status: "ACTIVE",
});
await ensureAppUser(newMember.id, {
  primary_organization_id: sharedMemberProfile.organization_id,
  full_name: "GISP Shared UAT Member",
  status: "ACTIVE",
});

const superRole = must(await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").single(), "load SUPER_ADMIN role");
const currentRole = must(
  await admin.database.from("user_roles").select("id").eq("user_id", newAdmin.id).eq("role_id", superRole.id).is("revoked_at", null).maybeSingle(),
  "load new UAT admin role",
);
if (!currentRole) {
  must(await admin.database.from("user_roles").insert([{
    user_id: newAdmin.id,
    role_id: superRole.id,
    organization_id: null,
    assigned_by: newAdmin.id,
  }]), "assign new UAT admin role");
}

const memberRole = must(await admin.database.from("roles").select("id").eq("code", "MEMBER").single(), "load MEMBER role");
const currentMemberRole = must(
  await admin.database.from("user_roles").select("id").eq("user_id", newMember.id).eq("role_id", memberRole.id).is("revoked_at", null).limit(1).maybeSingle(),
  "load new UAT member role",
);
if (!currentMemberRole) {
  must(await admin.database.from("user_roles").insert([{
    user_id: newMember.id,
    role_id: memberRole.id,
    organization_id: sharedMemberProfile.organization_id,
    assigned_by: newAdmin.id,
  }]), "assign new UAT member role");
}

if (!existingNewMemberProfile && legacyMemberProfile) {
  must(
    await admin.database.from("member_profiles").update({ user_id: newMember.id }).eq("id", legacyMemberProfile.id),
    "transfer shared UAT member profile",
  );
}

must(
  await admin.database.from("users").update({ status: "SUSPENDED" }).in("id", [...legacyAdminIds, ...legacyMemberIds]),
  "suspend exposed UAT users",
);
must(
  await admin.database.from("user_roles").update({ revoked_at: new Date().toISOString() })
    .in("user_id", legacyAdminIds).is("revoked_at", null),
  "revoke exposed UAT admin roles",
);

const adminPermission = must(
  await newAdmin.client.database.rpc("has_permission", { permission_code: "quotations.manage", target_organization_id: null }),
  "verify new UAT admin permission",
);
if (!adminPermission) throw new Error("new UAT admin permission check failed");
const visibleProfile = must(await newMember.client.database.rpc("current_member_profile_id", {}), "verify new UAT member profile");
if (visibleProfile !== sharedMemberProfile.id) throw new Error("new UAT member profile transfer failed");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  adminEmail: UAT_ADMIN_EMAIL,
  memberEmail: UAT_MEMBER_EMAIL,
  legacyAccountsSuspended: true,
  memberProfilePreserved: true,
}, null, 2));
