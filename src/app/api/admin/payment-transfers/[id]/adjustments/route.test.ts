import { describe, expect, it } from "vitest";
import { POST } from "./route";
describe("Lean adjustment closure", () => { it("fails closed before request parsing", async () => { const response=await POST(); expect(response.status).toBe(404); expect(await response.json()).toMatchObject({code:"LEAN_SCOPE_DEFERRED"}); }); });
