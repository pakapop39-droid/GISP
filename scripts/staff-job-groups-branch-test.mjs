import { createHash } from "node:crypto";
import { createAdminClient, createClient } from "@insforge/sdk";

const baseUrl = process.env.INSFORGE_URL;
const apiKey = process.env.INSFORGE_API_KEY;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;
const password = process.env.STAFF_GROUPS_UAT_PASSWORD;

if (!baseUrl || !apiKey || !anonKey || !password) {
  throw new Error(
    "INSFORGE_URL, INSFORGE_API_KEY, NEXT_PUBLIC_INSFORGE_ANON_KEY และ STAFF_GROUPS_UAT_PASSWORD จำเป็นสำหรับ Branch test",
  );
}

const admin = createAdminClient({ baseUrl, apiKey });
const results = [];
const must = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const assert = (condition, label) => {
  if (!condition) throw new Error(`FAILED: ${label}`);
  results.push(`PASS: ${label}`);
};

const rolePermissions = {
  SUPER_ADMIN: ["members.roles.manage", "permissions.manage", "supplier_payments.request", "supplier_payments.manage", "reports.fixed.read"],
  MEMBER_ADMIN: ["members.approve", "reports.fixed.read"],
  PRODUCT_ADMIN: ["catalog.import"],
  ORDER_ADMIN: ["orders.manage"],
  PURCHASING: ["production.manage", "supplier_payments.request"],
  FINANCE: ["payments.verify", "supplier_payments.manage", "freight.manage", "reports.fixed.read"],
  QC: ["qc.manage", "reports.fixed.read"],
  LOGISTICS: ["shipments.manage", "deliveries.manage", "reports.fixed.read"],
};

const accounts = [
  {
    key: "owner",
    email: "uat-staff-owner@gisp.example.com",
    name: "UAT เจ้าของระบบ",
    roles: ["SUPER_ADMIN"],
  },
  {
    key: "operations",
    email: "uat-staff-operations@gisp.example.com",
    name: "UAT ผู้ดูแลระบบงานและออเดอร์",
    roles: ["MEMBER_ADMIN", "PRODUCT_ADMIN", "ORDER_ADMIN", "PURCHASING", "QC"],
  },
  {
    key: "finance",
    email: "uat-staff-finance@gisp.example.com",
    name: "UAT การเงิน",
    roles: ["FINANCE"],
  },
  {
    key: "logistics",
    email: "uat-staff-logistics@gisp.example.com",
    name: "UAT โลจิสติกส์",
    roles: ["LOGISTICS"],
  },
];

async function ensureAuthUser(account) {
  const client = createClient({ baseUrl, anonKey });
  let signedIn = await client.auth.signInWithPassword({ email: account.email, password });
  if (signedIn.error) {
    const created = await admin.auth.signUp({
      email: account.email,
      password,
      name: account.name,
      autoConfirm: true,
    });
    if (created.error && !String(created.error.message).toLowerCase().includes("already")) {
      throw new Error(`create ${account.email}: ${created.error.message}`);
    }
    signedIn = await client.auth.signInWithPassword({ email: account.email, password });
  }
  must(signedIn, `sign in ${account.email}`);
  const current = must(await client.auth.getCurrentUser(), `read ${account.email}`).user;
  if (!current?.id) throw new Error(`auth user id missing for ${account.email}`);
  return { ...account, id: current.id, client };
}

let organization = must(
  await admin.database.from("organizations").select("id").eq("code", "GISP").maybeSingle(),
  "load GISP organization",
);
if (!organization) {
  organization = must(
    await admin.database.from("organizations").insert([{
      code: "GISP",
      name: "Global Interior Supply Platform",
      status: "ACTIVE",
      approved_at: new Date().toISOString(),
    }]).select("id").single(),
    "create GISP organization",
  );
}

const allRoleCodes = Object.keys(rolePermissions);
for (const code of allRoleCodes) {
  const existing = must(
    await admin.database.from("roles").select("id").eq("code", code).maybeSingle(),
    `load role ${code}`,
  );
  if (!existing) {
    must(
      await admin.database.from("roles").insert([{ code, name: code, description: "Branch UAT reference role" }]),
      `seed role ${code}`,
    );
  }
}

const permissionCodes = [...new Set(Object.values(rolePermissions).flat())];
for (const code of permissionCodes) {
  const existing = must(
    await admin.database.from("permissions").select("id").eq("code", code).maybeSingle(),
    `load permission ${code}`,
  );
  if (!existing) {
    must(
      await admin.database.from("permissions").insert([{ code, name: code, description: "Branch UAT reference permission" }]),
      `seed permission ${code}`,
    );
  }
}

const roles = must(await admin.database.from("roles").select("id,code"), "load roles");
const permissions = must(await admin.database.from("permissions").select("id,code"), "load permissions");
const roleId = Object.fromEntries(roles.map((row) => [row.code, row.id]));
const permissionId = Object.fromEntries(permissions.map((row) => [row.code, row.id]));

for (const [code, codes] of Object.entries(rolePermissions)) {
  for (const permissionCode of codes) {
    const existing = must(
      await admin.database.from("role_permissions")
        .select("role_id")
        .eq("role_id", roleId[code])
        .eq("permission_id", permissionId[permissionCode])
        .maybeSingle(),
      `load ${code}/${permissionCode}`,
    );
    if (!existing) {
      must(
        await admin.database.from("role_permissions").insert([{
          role_id: roleId[code],
          permission_id: permissionId[permissionCode],
        }]),
        `grant ${code}/${permissionCode}`,
      );
    }
  }
}

const preparedAccounts = [];
for (const account of accounts) {
  const prepared = await ensureAuthUser(account);
  const userRow = must(
    await admin.database.from("users").select("id").eq("id", prepared.id).maybeSingle(),
    `load app user ${account.key}`,
  );
  if (!userRow) {
    must(
      await admin.database.from("users").insert([{
        id: prepared.id,
        primary_organization_id: organization.id,
        full_name: prepared.name,
        status: "ACTIVE",
      }]),
      `create app user ${account.key}`,
    );
  } else {
    must(
      await admin.database.from("users").update({
        primary_organization_id: organization.id,
        full_name: prepared.name,
        status: "ACTIVE",
      }).eq("id", prepared.id),
      `activate app user ${account.key}`,
    );
  }

  for (const code of prepared.roles) {
    const existing = must(
      await admin.database.from("user_roles")
        .select("id")
        .eq("user_id", prepared.id)
        .eq("role_id", roleId[code])
        .is("revoked_at", null)
        .maybeSingle(),
      `load ${account.key}/${code}`,
    );
    if (!existing) {
      must(
        await admin.database.from("user_roles").insert([{
          user_id: prepared.id,
          role_id: roleId[code],
          organization_id: code === "SUPER_ADMIN" ? null : organization.id,
          assigned_by: prepared.id,
        }]),
        `assign ${account.key}/${code}`,
      );
    }
  }
  preparedAccounts.push(prepared);
}

async function accessContext(account) {
  const rawToken = `${account.key}-${Date.now()}-${Math.random()}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  must(
    await account.client.database.rpc("register_app_session", {
      token_hash_input: tokenHash,
      expires_at_input: new Date(Date.now() + 3_600_000).toISOString(),
      ip_address_input: "127.0.0.1",
      user_agent_input: "GISP staff job groups branch test",
    }),
    `register session ${account.key}`,
  );
  return must(
    await account.client.database.rpc("get_app_access_context", { token_hash_input: tokenHash }),
    `access context ${account.key}`,
  );
}

const contexts = {};
for (const account of preparedAccounts) contexts[account.key] = await accessContext(account);

assert(
  accounts[1].roles.every((role) => contexts.operations.roles.includes(role)),
  "OPERATIONS ได้รับ 5 Role เบื้องหลังตามที่กำหนด",
);
assert(
  contexts.finance.roles.length === 1 && contexts.finance.roles[0] === "FINANCE",
  "FINANCE ได้รับ Role การเงินเพียงรายการเดียว",
);
assert(
  contexts.logistics.roles.length === 1 && contexts.logistics.roles[0] === "LOGISTICS",
  "LOGISTICS ได้รับ Role โลจิสติกส์เพียงรายการเดียว",
);
assert(
  contexts.operations.permissions.includes("supplier_payments.request")
    && !contexts.operations.permissions.includes("supplier_payments.manage"),
  "OPERATIONS สร้างคำขอจ่ายได้ แต่อนุมัติหรือบันทึกจ่ายไม่ได้",
);
assert(
  contexts.finance.permissions.includes("supplier_payments.manage")
    && !contexts.finance.permissions.includes("supplier_payments.request"),
  "FINANCE อนุมัติและบันทึกจ่ายได้ แต่ไม่มีสิทธิ์คำขอของฝ่ายปฏิบัติการ",
);
assert(
  contexts.logistics.permissions.includes("shipments.manage")
    && !contexts.logistics.permissions.includes("payments.verify")
    && !contexts.logistics.permissions.includes("supplier_payments.manage"),
  "LOGISTICS จัดการขนส่งได้และไม่มีสิทธิ์ข้อมูลการเงิน",
);
assert(
  !contexts.operations.permissions.includes("members.roles.manage"),
  "MEMBER_ADMIN ไม่มีสิทธิ์จัดการ Role พนักงาน",
);
assert(
  contexts.owner.roles.includes("SUPER_ADMIN")
    && contexts.owner.permissions.includes("members.roles.manage")
    && contexts.owner.permissions.includes("permissions.manage"),
  "SUPER_ADMIN ยังจัดการพนักงานและ Permission Matrix ได้",
);

for (const line of results) console.log(line);
console.log(JSON.stringify({
  ok: true,
  branchUrl: baseUrl,
  testAccounts: Object.fromEntries(accounts.map((account) => [account.key, account.email])),
}, null, 2));
