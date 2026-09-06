import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { createAdminClient } from "@insforge/sdk";

const productionProjectDirectory = resolve(
  process.env.GISP_PRODUCTION_PROJECT_DIR ?? "C:/codex/GISP/production-release-a",
);
const projectConfigPath = resolve(productionProjectDirectory, ".insforge/project.json");
const ownerEmail = "pakapop39@gmail.com";
const ownerName = "Pakapop";

const projectConfig = JSON.parse(await readFile(projectConfigPath, "utf8"));
const baseUrl = `https://${projectConfig.appkey}.${projectConfig.region}.insforge.app`;
const apiKey = projectConfig.api_key?.trim();

if (!projectConfig.appkey || !projectConfig.region || !apiKey) {
  throw new Error("Production InsForge project configuration is incomplete");
}

const admin = createAdminClient({ baseUrl, apiKey });

function must(result, label) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

async function findOwnerId() {
  return must(
    await admin.database.rpc("operator_find_auth_user_id", { email_input: ownerEmail }),
    "Find Production Owner",
  );
}

let ownerId = await findOwnerId();
let accountCreated = false;

if (!ownerId) {
  // This credential exists only in process memory. The Owner replaces it through
  // the emailed reset link; it is never printed or written to disk.
  const temporaryPassword = `${randomBytes(32).toString("base64url")}Aa1!`;
  const created = must(
    await admin.auth.signUp({
      email: ownerEmail,
      password: temporaryPassword,
      name: ownerName,
      autoConfirm: true,
    }),
    "Create and confirm Production Owner",
  );

  ownerId = created?.user?.id ?? (await findOwnerId());
  accountCreated = true;
}

if (!ownerId) {
  throw new Error("Production Owner identity was not returned after account creation");
}

const superAdminRole = must(
  await admin.database.from("roles").select("id").eq("code", "SUPER_ADMIN").single(),
  "Find SUPER_ADMIN role",
);
const activeSuperAdmins = must(
  await admin.database
    .from("user_roles")
    .select("user_id")
    .eq("role_id", superAdminRole.id)
    .is("revoked_at", null),
  "Check active SUPER_ADMIN assignments",
);

const ownerAlreadyAssigned = activeSuperAdmins.some((row) => row.user_id === ownerId);
if (activeSuperAdmins.length > 0 && !ownerAlreadyAssigned) {
  throw new Error("A different active SUPER_ADMIN already exists in Production");
}

if (!ownerAlreadyAssigned) {
  must(
    await admin.database.rpc("operator_bootstrap_super_admin", {
      target_user_id_input: ownerId,
      full_name_input: ownerName,
    }),
    "Bootstrap Production Owner as SUPER_ADMIN",
  );
}

const ownerRow = must(
  await admin.database.from("users").select("id,status,full_name").eq("id", ownerId).single(),
  "Verify active application Owner",
);
const ownerRole = must(
  await admin.database
    .from("user_roles")
    .select("id,user_id")
    .eq("user_id", ownerId)
    .eq("role_id", superAdminRole.id)
    .is("revoked_at", null)
    .single(),
  "Verify Owner SUPER_ADMIN assignment",
);
const auditRows = must(
  await admin.database
    .from("audit_events")
    .select("id")
    .eq("actor_user_id", ownerId)
    .eq("action", "OPERATOR_BOOTSTRAP")
    .limit(1),
  "Verify Owner bootstrap audit",
);

const resetRequest = must(
  await admin.auth.sendResetPasswordEmail({
    email: ownerEmail,
    redirectTo: "https://m8ugbyak.insforge.site/reset-password",
  }),
  "Send Production Owner password reset email",
);

console.log(
  JSON.stringify({
    accountCreated,
    ownerActive: ownerRow.status === "ACTIVE",
    superAdminAssigned: Boolean(ownerRole.id),
    bootstrapAuditRecorded: auditRows.length > 0,
    resetEmailAccepted: resetRequest?.success === true,
  }),
);
