import { beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ count: 722, failOffset: -1, deny: false, ranges: [] as number[][] }));
vi.mock("@/lib/auth/session", () => ({ requireAppAccess: async () => { if (fixture.deny) throw new Error("DENIED"); } }));
vi.mock("@/lib/api/response", () => ({ apiError: () => Response.json({ error: "failed" }, { status: 500 }), invalidInput: vi.fn() }));
vi.mock("@/lib/catalog/api-schema", () => ({ productDraftSchema: {} }));
vi.mock("@/lib/insforge/server", () => ({
  createInsForgeServerClient: async () => ({ database: { from: () => {
    const query = {
      select: () => query,
      order: () => query,
      range: async (start: number, end: number) => {
        fixture.ranges.push([start, end]);
        if (start === fixture.failOffset) return { data: null, error: new Error("database failure") };
        return { data: Array.from({ length: Math.max(0, Math.min(end + 1, fixture.count) - start) }, (_, i) => ({ id: start + i })), error: null };
      },
    };
    return query;
  } } }),
}));

import { GET } from "./route";

beforeEach(() => { fixture.count = 722; fixture.failOffset = -1; fixture.deny = false; fixture.ranges = []; });
it("returns every CN01 product beyond the old 300 row limit", async () => {
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.data).toHaveLength(722);
  expect(new Set(body.data.map((p: { id: number }) => p.id)).size).toBe(722);
  expect(body.data.at(-1).id).toBe(721);
});
it("does not return an incomplete catalog when a later page fails", async () => {
  fixture.failOffset = 400;
  expect((await GET()).status).toBe(500);
});
it("checks catalog permissions before querying products", async () => {
  fixture.deny = true;
  await GET();
  expect(fixture.ranges).toEqual([]);
});
