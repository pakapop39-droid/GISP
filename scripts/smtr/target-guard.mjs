import fs from "node:fs";
import path from "node:path";

export const DEVELOPMENT_PROJECT_ID = "db09b94e-fc37-4f90-9530-3289afef0b79";
export const DEVELOPMENT_HOST = "https://kit6y4pj.ap-southeast.insforge.app";
export const DEVELOPMENT_PROJECT_NAME = "gisp-mvp-development";

const normalizeUrl = (value) => String(value ?? "").trim().replace(/\/+$/, "");

export function validateDevelopmentTarget({ linked, env }) {
  if (env.SMTR_ALLOW_DEVELOPMENT !== "true") {
    throw new Error("SMTR_TARGET_GUARD: SMTR_ALLOW_DEVELOPMENT=true is required");
  }
  if (!linked || linked.project_id !== DEVELOPMENT_PROJECT_ID) {
    throw new Error("SMTR_TARGET_GUARD: linked project id is not the approved Development project");
  }
  if (linked.project_name !== DEVELOPMENT_PROJECT_NAME) {
    throw new Error("SMTR_TARGET_GUARD: linked project name is not the approved Development project");
  }
  if (normalizeUrl(linked.oss_host) !== DEVELOPMENT_HOST) {
    throw new Error("SMTR_TARGET_GUARD: linked host is not the approved Development host");
  }
  for (const key of ["INSFORGE_URL", "NEXT_PUBLIC_INSFORGE_URL"]) {
    if (normalizeUrl(env[key]) !== DEVELOPMENT_HOST) {
      throw new Error(`SMTR_TARGET_GUARD: ${key} must exactly match the approved Development host`);
    }
  }
  if (!env.INSFORGE_API_KEY || !env.NEXT_PUBLIC_INSFORGE_ANON_KEY) {
    throw new Error("SMTR_TARGET_GUARD: Development credentials are incomplete");
  }
  return {
    projectId: DEVELOPMENT_PROJECT_ID,
    projectName: DEVELOPMENT_PROJECT_NAME,
    host: DEVELOPMENT_HOST,
  };
}

export function loadDevelopmentTarget({ cwd = process.cwd(), env = process.env } = {}) {
  const projectPath = path.join(cwd, ".insforge", "project.json");
  const linked = JSON.parse(fs.readFileSync(projectPath, "utf8"));
  return validateDevelopmentTarget({ linked, env });
}
