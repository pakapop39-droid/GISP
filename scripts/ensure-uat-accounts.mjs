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
const emails = {
  admin: UAT_ADMIN_EMAIL,
  member: UAT_MEMBER_EMAIL,
};

function must(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function ensureAuthUser(email, name) {
  const client = createClient({ baseUrl, anonKey });
  let signedIn = await client.auth.signInWithPassword({ email, password });

  if (signedIn.error) {
    const created = await admin.auth.signUp({
      email,
      password,
      name,
      autoConfirm: true,
    });
    if (created.error && !String(created.error.message).toLowerCase().includes("already")) {
      throw new Error(`create ${email}: ${created.error.message}`);
    }
    signedIn = await client.auth.signInWithPassword({ email, password });
  }

  must(signedIn, `sign in ${email}`);
  const current = must(await client.auth.getCurrentUser(), `read ${email}`).user;
  if (!current?.id) throw new Error(`auth user id missing for ${email}`);
  return { id: current.id, email, client };
}

const operator = await ensureAuthUser(emails.admin, "GISP UAT Admin");
let internalOrganization = must(
  await admin.database.from("organizations").select("id").eq("code", "GISP").maybeSingle(),
  "load GISP organization",
);
if (!internalOrganization) {
  internalOrganization = must(
    await admin.database.from("organizations").insert([{
      code: "GISP",
      name: "Global Interior Supply Platform",
      status: "ACTIVE",
      approved_at: new Date().toISOString(),
    }]).select("id").single(),
    "create GISP organization",
  );
}

const operatorProfile = must(
  await admin.database.from("users").select("id").eq("id", operator.id).maybeSingle(),
  "load UAT admin profile",
);
if (!operatorProfile) {
  must(
    await admin.database.from("users").insert([{
      id: operator.id,
      primary_organization_id: internalOrganization.id,
      full_name: "GISP UAT Admin",
      status: "ACTIVE",
    }]),
    "create UAT admin profile",
  );
} else {
  must(
    await admin.database.from("users").update({
      primary_organization_id: internalOrganization.id,
      full_name: "GISP UAT Admin",
      status: "ACTIVE",
    }).eq("id", operator.id),
    "activate UAT admin profile",
  );
}

const superRole = must(
  await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").single(),
  "load SUPER_ADMIN role",
);
const operatorRole = must(
  await admin.database.from("user_roles").select("id").eq("user_id", operator.id).eq("role_id", superRole.id).is("revoked_at", null).limit(1).maybeSingle(),
  "load UAT admin role",
);
if (!operatorRole) {
  must(
    await admin.database.from("user_roles").insert([{
      user_id: operator.id,
      role_id: superRole.id,
      organization_id: null,
      assigned_by: operator.id,
    }]),
    "assign SUPER_ADMIN role",
  );
}

const member = await ensureAuthUser(emails.member, "GISP UAT Member");
let memberProfile = must(
  await admin.database.from("member_profiles").select("id,organization_id").eq("user_id", member.id).maybeSingle(),
  "load UAT member profile",
);

if (!memberProfile) {
  must(
    await member.client.database.rpc("save_member_onboarding", {
      contact_name_input: "GISP UAT Member",
      contact_phone_input: "0800000000",
      company_name_input: "GISP UAT Company",
      company_legal_name_input: "GISP UAT Company Limited",
      tax_id_input: "0999999999999",
      business_type_input: "Interior Design",
      address_line_input: "Bangkok",
      district_input: "Pathum Wan",
      province_input: "Bangkok",
      postal_code_input: "10330",
      service_areas_input: ["Bangkok"],
      product_interests_input: ["Furniture", "Custom Furniture"],
      training_interest_input: false,
      training_note_input: null,
    }),
    "save UAT member onboarding",
  );
  const applicationId = must(
    await member.client.database.rpc("submit_member_application", {}),
    "submit UAT member application",
  );
  must(
    await operator.client.database.rpc("approve_member_application", {
      application_id_input: applicationId,
      review_note_input: "Permanent shared UAT account",
    }),
    "approve UAT member application",
  );
  memberProfile = must(
    await admin.database.from("member_profiles").select("id,organization_id").eq("user_id", member.id).single(),
    "verify UAT member profile",
  );
} else {
  must(await admin.database.from("users").update({ status: "ACTIVE" }).eq("id", member.id), "activate UAT member user");
  must(await admin.database.from("organizations").update({ status: "ACTIVE" }).eq("id", memberProfile.organization_id), "activate UAT member organization");
}

const memberRole = must(
  await admin.database.from("roles").select("id").eq("code", "MEMBER").single(),
  "load MEMBER role",
);
const activeMemberRole = must(
  await admin.database.from("user_roles").select("id").eq("user_id", member.id).eq("role_id", memberRole.id).is("revoked_at", null).limit(1).maybeSingle(),
  "load UAT member role",
);
if (!activeMemberRole) {
  must(
    await admin.database.from("user_roles").insert([{
      user_id: member.id,
      role_id: memberRole.id,
      organization_id: memberProfile.organization_id,
      assigned_by: operator.id,
    }]),
    "assign MEMBER role",
  );
}

const permissionCheck = must(
  await operator.client.database.rpc("has_permission", {
    permission_code: "quotations.manage",
    target_organization_id: null,
  }),
  "verify UAT admin permission",
);
if (!permissionCheck) throw new Error("UAT admin does not have quotations.manage");

const visibleProfile = must(
  await member.client.database.rpc("current_member_profile_id", {}),
  "verify UAT member identity",
);
if (visibleProfile !== memberProfile.id) throw new Error("UAT member profile mismatch");

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  adminEmail: emails.admin,
  memberEmail: emails.member,
  adminRole: "SUPER_ADMIN",
  memberRole: "MEMBER",
  memberProfileReady: true,
}, null, 2));
