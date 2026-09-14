import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  product: { supplier_id: "supplier-1" },
  mappings: [
    { option_value_id: "value-active", finish_id: "finish-active" },
    { option_value_id: "value-inactive", finish_id: "finish-inactive" },
    { option_value_id: "value-other-supplier", finish_id: "finish-other-supplier" },
  ],
  finishes: [
    { id: "finish-active", collection_id: "collection-1", code: "A9-6001", name_th: "สีหนึ่ง", name_zh: null, swatch_file_id: "file-active", status: "ACTIVE" },
    { id: "finish-inactive", collection_id: "collection-1", code: "A9-6002", name_th: "สีสอง", name_zh: null, swatch_file_id: "file-inactive", status: "INACTIVE" },
    { id: "finish-other-supplier", collection_id: "collection-2", code: "A9-6003", name_th: "สีสาม", name_zh: null, swatch_file_id: "file-other", status: "ACTIVE" },
  ],
  collections: [
    { id: "collection-1", supplier_id: "supplier-1", status: "ACTIVE" },
    { id: "collection-2", supplier_id: "supplier-2", status: "ACTIVE" },
  ],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/insforge/admin", () => ({
  createInsForgeAdminClient: () => ({
    database: {
      from: (table: string) => {
        let ids: string[] = [];
        const filters = new Map<string, unknown>();
        const query = {
          select: () => query,
          in: (_column: string, values: string[]) => { ids = values; return query; },
          eq: (column: string, value: unknown) => { filters.set(column, value); return query; },
          maybeSingle: async () => table === "products"
            ? { data: fixture.product, error: null }
            : { data: null, error: null },
          limit: async () => {
            if (table === "product_option_finish_mappings") {
              return { data: fixture.mappings.filter((item) => ids.includes(item.option_value_id)), error: null };
            }
            if (table === "finishes") {
              return { data: fixture.finishes.filter((item) => ids.includes(item.id) && (!filters.has("status") || item.status === filters.get("status"))), error: null };
            }
            if (table === "finish_collections") {
              return { data: fixture.collections.filter((item) => ids.includes(item.id) && item.status === filters.get("status") && item.supplier_id === filters.get("supplier_id")), error: null };
            }
            if (table === "file_metadata") {
              return { data: ids.map((id) => ({ id, bucket: "gisp-confidential", object_key: `swatches/${id}.webp` })), error: null };
            }
            return { data: [], error: null };
          },
        };
        return query;
      },
    },
    storage: {
      from: () => ({
        createSignedUrl: async (key: string) => ({ data: { signedUrl: `https://signed.example/${key}` }, error: null }),
      }),
    },
  }),
}));

import { signedMemberOptionFinishes } from "./member-server";

describe("member finish projection", () => {
  beforeEach(() => {
    fixture.product = { supplier_id: "supplier-1" };
  });

  it("returns only active finishes from the product supplier with signed URLs", async () => {
    const result = await signedMemberOptionFinishes("product-1", [
      "value-active", "value-inactive", "value-other-supplier",
    ]);
    expect([...result.keys()]).toEqual(["value-active"]);
    expect(result.get("value-active")).toEqual({
      code: "A9-6001",
      label: "สีหนึ่ง",
      labelZh: null,
      swatchUrl: "https://signed.example/swatches/file-active.webp",
    });
  });

  it("does not query mappings when the product has no active option values", async () => {
    expect((await signedMemberOptionFinishes("product-1", [])).size).toBe(0);
  });
});
