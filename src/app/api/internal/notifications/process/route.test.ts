import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";
describe("notification processor closure",()=>{it.each([GET,POST])("fails closed even when invoked directly",async handler=>{const response=await handler();expect(response.status).toBe(404);expect(await response.json()).toMatchObject({code:"LEAN_SCOPE_DEFERRED"});});});
