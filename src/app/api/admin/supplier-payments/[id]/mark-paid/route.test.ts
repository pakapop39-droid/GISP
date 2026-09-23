import { describe, expect, it } from "vitest";
import { POST } from "./route";
describe("Lean Supplier payment mark-paid closure", () => { it("fails closed before reading request or backend", async () => { const response=await POST(); expect(response.status).toBe(404); expect(await response.json()).toMatchObject({code:"LEAN_SCOPE_DEFERRED"}); }); });
