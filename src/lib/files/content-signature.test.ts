import { describe, expect, it } from "vitest";
import { validateCustomRequestUpload } from "./content-signature";

const file = (name: string, type: string, bytes: number[]) => new File([new Uint8Array(bytes)], name, { type });
describe("Custom Request content signatures", () => {
  it.each([
    ["spec.pdf", "application/pdf", [0x25,0x50,0x44,0x46,0x2d], "pdf"],
    ["photo.jpg", "image/jpeg", [0xff,0xd8,0xff,0x00], "jpg"],
    ["photo.jpeg", "image/jpeg", [0xff,0xd8,0xff,0x00], "jpeg"],
    ["drawing.png", "image/png", [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a], "png"],
  ])("accepts %s only when extension, MIME and magic agree", async (name, type, bytes, extension) => {
    expect(await validateCustomRequestUpload(file(name as string,type as string,bytes as number[]))).toBe(extension);
  });
  it.each([
    ["drawing.dwg","application/acad",[0x41,0x43]],
    ["drawing.dxf","application/dxf",[0x30,0x0a]],
    ["fake.pdf","application/pdf",[0x89,0x50]],
    ["fake.png","image/jpeg",[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]],
    ["empty.pdf","application/pdf",[]],
  ])("rejects unsupported or mismatched %s", async (name,type,bytes) => {
    expect(await validateCustomRequestUpload(file(name as string,type as string,bytes as number[]))).toBeNull();
  });
});
