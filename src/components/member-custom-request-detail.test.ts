import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const source=readFileSync(resolve(process.cwd(),"src/components/member-custom-request-detail.tsx"),"utf8");
describe("Custom Request file picker",()=>{it("advertises only PDF/JPEG/PNG",()=>{expect(source).toContain("application/pdf,image/jpeg,image/png");expect(source).not.toMatch(/\.dwg|\.dxf/i);});});
