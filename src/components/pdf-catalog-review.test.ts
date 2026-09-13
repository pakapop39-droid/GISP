import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const detailRoute = read("src/app/api/admin/catalog/imports/[id]/route.ts");
const review = read("src/components/pdf-catalog-review.tsx");

describe("PDF Catalog review source preview", () => {
  it("selects each page render id without weakening the confidential artifact route", () => {
    expect(detailRoute).toContain("failure_message,rendered_file_id");
    expect(review).toContain("selectedPage?.rendered_file_id");
    expect(review).toContain("/artifacts/${selectedPage.rendered_file_id}");
    expect(review).toContain('detail.job.security_status === "VERIFIED"');
    expect(review).toContain("detail.job.security_verified_at");
  });

  it("shows loading, empty and safe error states instead of embedding the cross-origin PDF", () => {
    expect(review).not.toContain("<iframe");
    expect(review).toContain("กำลังโหลดภาพหน้าต้นฉบับ");
    expect(review).toContain("ยังไม่มีภาพ Render ของหน้าที่เลือก");
    expect(review).toContain("ไม่สามารถโหลดภาพ Render ของหน้านี้ได้");
    expect(review).toContain('target="_blank"');
    expect(review).toContain('rel="noopener noreferrer"');
    expect(review).toContain("เปิด PDF ต้นฉบับทั้งไฟล์ในแท็บใหม่");
  });

  it("keeps candidate selection beside details with a larger explicit preview", () => {
    expect(review).toContain("รูป Candidate ของรายการนี้");
    expect(review).toContain("ไม่พบรูป Candidate สำหรับสินค้านี้");
    expect(review).toContain("width={144} height={144}");
    expect(review).toContain("h-36 w-36 object-contain");
    expect(review).toContain("selectedImageFileId:image.file_id");
    expect(review).toContain("/images/${image.file_id}");
  });
});
