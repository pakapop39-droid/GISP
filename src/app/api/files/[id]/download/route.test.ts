import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const source=readFileSync(resolve(process.cwd(),"src/app/api/files/[id]/download/route.ts"),"utf8");
describe("generic file download boundary",()=>{it("denies every Custom Request before signing",()=>{
  expect(source).toContain('file.entity_type === "CUSTOM_REQUEST"');
  expect(source.indexOf('file.entity_type === "CUSTOM_REQUEST"')).toBeLessThan(source.indexOf("createSignedUrl"));
});});
