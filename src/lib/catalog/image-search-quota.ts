import { createHash } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import path from "node:path";

// Local preview only. Exclusive creation survives restarts and concurrent workers.
// Slots are never released after an uncertain/billable request. Distributed hosting
// must replace this with an atomic database quota before enabling this feature.
async function claimSlot(directory: string, maximum: number) {
  await mkdir(directory, { recursive: true });
  for (let slot = 0; slot < maximum; slot++) {
    try {
      const file = await open(path.join(directory, `${slot}.used`), "wx");
      await file.close();
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  throw new Error("IMAGE_SEARCH_QUOTA");
}

export async function reserveImageSearch(directory: string, accountId: string, limits = { account: 30, total: 200 }) {
  const key = createHash("sha256").update(accountId).digest("hex");
  await claimSlot(path.join(directory, "accounts", key), limits.account);
  await claimSlot(path.join(directory, "total"), limits.total);
}
