import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), limit: vi.fn(),
}));

vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({ database: { from: mocks.from } }),
}));

import { GET } from "./route";

const originalEnv = { ...process.env };
const request = () => new Request("https://child-rehearsal.insforge.site/api/health/release-attestation");

function configuredEnvironment() {
  process.env.RELEASE_CANDIDATE_COMMIT = "1".repeat(40);
  process.env.RELEASE_CANDIDATE_TREE = "2".repeat(40);
  process.env.RELEASE_TARGET_PROJECT_ID = "e902393a-ffe7-433d-96d8-a37256948959";
  process.env.RELEASE_TARGET_BACKEND_HOST = "child-key.ap-southeast.insforge.app";
  process.env.RELEASE_TARGET_APP_KEY = "child-key";
  process.env.INSFORGE_URL = "https://child-key.ap-southeast.insforge.app";
  process.env.NEXT_PUBLIC_INSFORGE_URL = "https://child-key.ap-southeast.insforge.app";
  process.env.NEXT_PUBLIC_APP_URL = "https://child-rehearsal.insforge.site";
  process.env.RELEASE_STAGE = "D";
  process.env.RELEASE_D_ENABLED_SLICES = "7,8,9,10";
  process.env.INSFORGE_API_KEY = "must-never-appear";
  process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "must-never-appear-either";
}

describe("hosted release attestation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    configuredEnvironment();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ limit: mocks.limit });
    mocks.limit.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("binds commit, tree, Child identity, app key, host and release flags", async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      format: "GISP_RELEASE_ATTESTATION_V1",
      bindingComplete: true,
      candidate: { commit: "1".repeat(40), tree: "2".repeat(40) },
      target: {
        projectId: "e902393a-ffe7-433d-96d8-a37256948959",
        backendHost: "child-key.ap-southeast.insforge.app",
        backendAppKey: "child-key",
        appHost: "child-rehearsal.insforge.site",
        requestHost: "child-rehearsal.insforge.site",
      },
      release: { stage: "D", enabledDSlices: [7, 8, 9, 10] },
      serverAdminProbeOk: true,
    });
    expect(mocks.select).toHaveBeenCalledWith("id", { head: true });
    expect(JSON.stringify(body)).not.toContain("must-never-appear");
    expect(JSON.stringify(body)).not.toMatch(/apiKey|anonKey|secret|token/i);
  });

  it("fails closed for mismatched backend app keys without exposing credentials", async () => {
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://other-child.ap-southeast.insforge.app";
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect((await response.json()).bindingComplete).toBe(false);
  });

  it("rejects an attacker host that merely starts with the expected Child app key", async () => {
    process.env.INSFORGE_URL = "https://child-key.ap-southeast.insforge.app.attacker.test";
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://child-key.ap-southeast.insforge.app.attacker.test";
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.bindingComplete).toBe(false);
    expect(JSON.stringify(body)).not.toContain("attacker.test");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("requires the configured Child host and app key to agree exactly", async () => {
    process.env.RELEASE_TARGET_APP_KEY = "different-child";
    expect((await GET(request())).status).toBe(503);
    process.env.RELEASE_TARGET_APP_KEY = "child-key";
    process.env.RELEASE_TARGET_BACKEND_HOST = "child-key.other-region.insforge.app";
    expect((await GET(request())).status).toBe(503);
  });

  it("fails closed before the admin probe for malformed identity or non-contiguous slices", async () => {
    process.env.RELEASE_TARGET_PROJECT_ID = "not-a-project";
    process.env.RELEASE_D_ENABLED_SLICES = "7,9";
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.target.projectId).toBe("not-a-project");
    expect(body.release.enabledDSlices).toEqual([]);
    expect(body.serverAdminProbeOk).toBe(false);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("fails closed when the safely targeted admin probe is denied", async () => {
    mocks.limit.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body.bindingComplete).toBe(false);
    expect(body.serverAdminProbeOk).toBe(false);
    expect(mocks.from).toHaveBeenCalledWith("file_metadata");
  });

  it("accepts Release C only when every D slice is disabled", async () => {
    process.env.RELEASE_STAGE = "C";
    delete process.env.RELEASE_D_ENABLED_SLICES;
    expect((await GET(request())).status).toBe(200);
    process.env.RELEASE_D_ENABLED_SLICES = "7";
    expect((await GET(request())).status).toBe(503);
  });

  it("fails closed when the request host is not the configured hosted app", async () => {
    const response = await GET(new Request("https://different-host.insforge.site/api/health/release-attestation"));
    expect(response.status).toBe(503);
    expect((await response.json()).bindingComplete).toBe(false);
  });
});
