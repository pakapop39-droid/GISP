import "server-only";

import { createAdminClient } from "@insforge/sdk";
import { getServerEnv } from "@/lib/env";

export function createInsForgeAdminClient() {
  const env = getServerEnv();
  return createAdminClient({
    baseUrl: env.INSFORGE_URL,
    apiKey: env.INSFORGE_API_KEY,
  });
}
