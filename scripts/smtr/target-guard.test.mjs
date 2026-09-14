import test from "node:test";
import assert from "node:assert/strict";
import { DEVELOPMENT_HOST, DEVELOPMENT_PROJECT_ID, DEVELOPMENT_PROJECT_NAME, validateDevelopmentTarget } from "./target-guard.mjs";

const valid = () => ({
  linked: { project_id: DEVELOPMENT_PROJECT_ID, project_name: DEVELOPMENT_PROJECT_NAME, oss_host: DEVELOPMENT_HOST },
  env: { SMTR_ALLOW_DEVELOPMENT: "true", INSFORGE_URL: DEVELOPMENT_HOST, NEXT_PUBLIC_INSFORGE_URL: DEVELOPMENT_HOST, INSFORGE_API_KEY: "test-only", NEXT_PUBLIC_INSFORGE_ANON_KEY: "test-only" },
});

test("accepts only the approved Development target", () => {
  assert.equal(validateDevelopmentTarget(valid()).projectId, DEVELOPMENT_PROJECT_ID);
});

test("rejects production before any SDK client is involved", () => {
  const input = valid();
  input.linked.project_id = "865860c2-49fa-4e53-908f-9396b2f75233";
  input.linked.project_name = "gisp-mvp-production";
  input.linked.oss_host = "https://m8ugbyak.ap-southeast.insforge.app";
  input.env.INSFORGE_URL = input.linked.oss_host;
  input.env.NEXT_PUBLIC_INSFORGE_URL = input.linked.oss_host;
  assert.throws(() => validateDevelopmentTarget(input), /linked project id/);
});

test("rejects a missing explicit opt-in", () => {
  const input = valid();
  delete input.env.SMTR_ALLOW_DEVELOPMENT;
  assert.throws(() => validateDevelopmentTarget(input), /SMTR_ALLOW_DEVELOPMENT/);
});

test("rejects mixed frontend and backend environments", () => {
  const input = valid();
  input.env.NEXT_PUBLIC_INSFORGE_URL = "https://m8ugbyak.ap-southeast.insforge.app";
  assert.throws(() => validateDevelopmentTarget(input), /NEXT_PUBLIC_INSFORGE_URL/);
});
