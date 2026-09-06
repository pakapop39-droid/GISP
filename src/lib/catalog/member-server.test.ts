import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  media: [] as Array<{ id: string; product_id: string; file_id: string }>,
  batches: [] as string[][],
  failBatch: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({
    database: {
      from: (table: string) => {
        let ids: string[] = [];
        const query = {
          select: () => query,
          in: (_column: string, values: string[]) => { ids = values; return query; },
          eq: () => query,
          order: () => query,
          limit: async () => {
            if (table === "product_media") return { data: fixture.media, error: null };
            fixture.batches.push(ids);
            if (fixture.failBatch || ids.length > 40) return { data: null, error: new Error("502 Bad Gateway") };
            return { data: ids.map((id) => ({ id, bucket: "private", object_key: id })), error: null };
          },
        };
        return query;
      },
    },
    storage: { from: () => ({ createSignedUrl: async (key: string) => ({ data: { signedUrl: `https://signed.example/${key}` }, error: null }) }) },
  }),
}));

import { signedMemberProductMedia } from "./member-server";

describe("member catalog media metadata", () => {
  beforeEach(() => {
    fixture.batches = [];
    fixture.failBatch = false;
    fixture.media = Array.from({ length: 125 }, (_, i) => ({ id: `media-${i}`, product_id: `product-${i % 24}`, file_id: `file-${i}` }));
  });

  it("loads all 125 images without sending an oversized metadata filter", async () => {
    const result = await signedMemberProductMedia(["product-0"]);
    expect(fixture.batches.map((batch) => batch.length)).toEqual([40, 40, 40, 5]);
    expect([...result.values()].flat()).toHaveLength(125);
    expect(result.get("product-0")?.[0].url).toBe("https://signed.example/file-0");
  });

  it("does not query files for an empty catalog", async () => {
    expect((await signedMemberProductMedia([])).size).toBe(0);
    expect(fixture.batches).toEqual([]);
  });

  it("preserves metadata failures instead of reporting a successful empty catalog", async () => {
    fixture.failBatch = true;
    await expect(signedMemberProductMedia(["product-0"])).rejects.toThrow("502 Bad Gateway");
  });
});
