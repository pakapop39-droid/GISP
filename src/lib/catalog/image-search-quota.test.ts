import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { reserveImageSearch } from "./image-search-quota";

it("enforces a persistent total cap under concurrent requests", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gisp-image-quota-"));
  try {
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => reserveImageSearch(root, String(i), { account: 2, total: 3 })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(3);
    expect(await readdir(path.join(root, "total"))).toHaveLength(3);
    await expect(reserveImageSearch(root, "next", { account: 2, total: 3 })).rejects.toThrow("IMAGE_SEARCH_QUOTA");
  } finally { await rm(root, { recursive: true, force: true }); }
});

it("caps one account while allowing other accounts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gisp-image-quota-"));
  try {
    await reserveImageSearch(root, "one", { account: 1, total: 3 });
    await expect(reserveImageSearch(root, "one", { account: 1, total: 3 })).rejects.toThrow("IMAGE_SEARCH_QUOTA");
    await expect(reserveImageSearch(root, "two", { account: 1, total: 3 })).resolves.toBeUndefined();
  } finally { await rm(root, { recursive: true, force: true }); }
});
