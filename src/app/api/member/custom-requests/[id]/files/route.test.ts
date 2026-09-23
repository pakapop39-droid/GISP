import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  requireMember: vi.fn(),
  validateUpload: vi.fn(),
  apiError: vi.fn(() => Response.json({ code: "SERVER_ERROR" }, { status: 500 })),
}));

vi.mock("@/lib/api/response", () => ({ apiError: mocks.apiError }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: mocks.createAdmin }));
vi.mock("@/lib/custom-rfq/server", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/custom-rfq/types", () => ({ customRequestFileRoles: ["REFERENCE_IMAGE", "PDF", "CAD", "DIMENSION_DRAWING", "MATERIAL_REFERENCE"] }));
vi.mock("@/lib/files/content-signature", () => ({ validateCustomRequestUpload: mocks.validateUpload }));

import { POST } from "./route";

const source=readFileSync(resolve(process.cwd(),"src/app/api/member/custom-requests/[id]/files/route.ts"),"utf8");

function requestWithFile() {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "spec.pdf", { type: "application/pdf" }));
  form.set("fileRole", "PDF");
  return { formData: async () => form };
}

describe("Custom Request upload route contract",()=>{
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMember.mockResolvedValue({
      memberProfileId: "member-1",
      organizationId: "org-1",
      userId: "user-1",
    });
    mocks.validateUpload.mockResolvedValue("pdf");
  });
  it("validates bytes before storage and retains count/ownership/status guards",()=>{
    expect(source.indexOf("validateCustomRequestUpload(file)")).toBeLessThan(source.indexOf("createInsForgeAdminClient()"));
    expect(source).toContain("file.size <= maxBytes");
    expect(source).toContain("member_profile_id !== context.memberProfileId");
    expect(source).toContain('["DRAFT", "NEED_INFO"]');
    expect(source).toContain(">= 10");
    expect(source).not.toMatch(/dwg|dxf/i);
  });
  it("fails closed on count errors before storage upload",()=>{
    expect(source).toContain("if (count.error) throw count.error");
    expect(source.indexOf("if (count.error) throw count.error")).toBeLessThan(source.indexOf('.upload(requestedKey, file)'));
  });
  it("does not upload when the authoritative file count fails", async () => {
    const upload = vi.fn();
    mocks.createAdmin.mockReturnValue({
      database: {
        from: vi.fn((table: string) => {
          if (table === "custom_requests") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "request-1", member_profile_id: "member-1", status: "DRAFT" }, error: null }) }) }) };
          if (table === "custom_request_files") return { select: () => ({ eq: async () => ({ count: null, error: new Error("COUNT_FAILED") }) }) };
          throw new Error(`unexpected table ${table}`);
        }),
      },
      storage: { from: () => ({ upload, remove: vi.fn() }) },
    });

    const response = await POST(requestWithFile() as never, { params: Promise.resolve({ id: "request-1" }) });
    expect(response.status).toBe(500);
    expect(upload).not.toHaveBeenCalled();
  });
  it("cleans metadata and the storage-returned key after a partial failure",()=>{
    expect(source).toContain('from("file_metadata").delete()');
    expect(source).toContain("storageKey = storageData.key ?? requestedKey");
    expect(source).toContain('from("gisp-member-private").remove(storageKey)');
    expect(source).not.toContain("remove(requestedKey)");
  });
  it("removes the storage-returned key when metadata creation fails", async () => {
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const upload = vi.fn().mockResolvedValue({ data: { key: "canonical/returned-key.pdf", url: "https://storage.invalid/spec.pdf" }, error: null });
    const admin = {
      database: {
        from: vi.fn((table: string) => {
          if (table === "custom_requests") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "request-1", member_profile_id: "member-1", status: "DRAFT" }, error: null }) }) }) };
          if (table === "custom_request_files") return { select: () => ({ eq: async () => ({ count: 0, error: null }) }) };
          if (table === "file_metadata") return { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: new Error("METADATA_FAILED") }) }) }) };
          throw new Error(`unexpected table ${table}`);
        }),
      },
      storage: { from: () => ({ upload, remove }) },
    };
    mocks.createAdmin.mockReturnValue(admin);

    const response = await POST(requestWithFile() as never, { params: Promise.resolve({ id: "request-1" }) });
    expect(response.status).toBe(500);
    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("canonical/returned-key.pdf");
  });
});
