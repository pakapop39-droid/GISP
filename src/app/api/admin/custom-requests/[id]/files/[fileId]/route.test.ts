import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  requireRfqAdmin: vi.fn(),
  assertOrganizationPermission: vi.fn(),
  apiError: vi.fn((error: { status?: number }) => Response.json(
    { code: "ERROR" },
    { status: error?.status ?? 500 },
  )),
}));

vi.mock("@/lib/api/response", () => ({ apiError: mocks.apiError }));
vi.mock("@/lib/custom-rfq/server", () => ({ requireRfqAdmin: mocks.requireRfqAdmin }));
vi.mock("@/lib/auth/session", () => ({ assertOrganizationPermission: mocks.assertOrganizationPermission }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: mocks.createAdmin }));

import { GET } from "./route";

const requestId = "request-1";
const fileId = "file-1";
const memberProfileId = "member-1";
const organizationId = "org-1";
const objectKey = `custom-requests/${memberProfileId}/${requestId}/spec.pdf`;

type RowSet = {
  customRequest?: Record<string, unknown> | null;
  link?: Record<string, unknown> | null;
  file?: Record<string, unknown> | null;
  errors?: Partial<Record<"custom_requests" | "custom_request_files" | "file_metadata", Error>>;
};

function createAdmin(rows: RowSet = {}) {
  const signed = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.invalid/signed" }, error: null });
  const dataByTable: Record<string, Record<string, unknown> | null> = {
    custom_requests: rows.customRequest === undefined ? {
      id: requestId,
      organization_id: organizationId,
      member_profile_id: memberProfileId,
    } : rows.customRequest,
    custom_request_files: rows.link === undefined ? { custom_request_id: requestId, file_id: fileId } : rows.link,
    file_metadata: rows.file === undefined ? {
      id: fileId,
      organization_id: organizationId,
      member_profile_id: memberProfileId,
      entity_type: "CUSTOM_REQUEST",
      entity_id: requestId,
      bucket: "gisp-member-private",
      visibility: "MEMBER_PRIVATE",
      object_key: objectKey,
    } : rows.file,
  };
  return {
    signed,
    admin: {
      database: {
        from: vi.fn((table: string) => ({
          select: () => {
            const chain = {
              eq: () => chain,
              maybeSingle: async () => ({
                data: dataByTable[table],
                error: rows.errors?.[table as keyof NonNullable<RowSet["errors"]>] ?? null,
              }),
            };
            return chain;
          },
        })),
      },
      storage: { from: () => ({ createSignedUrl: signed }) },
    },
  };
}

function callGet() {
  return GET({} as never, { params: Promise.resolve({ id: requestId, fileId }) });
}

describe("Admin Custom Request file binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRfqAdmin.mockResolvedValue({ userId: "admin-1" });
  });

  it("authorizes organization scope and signs only the exact private binding", async () => {
    const fixture = createAdmin();
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callGet();

    expect(response.status).toBe(307);
    expect(mocks.assertOrganizationPermission).toHaveBeenCalledWith(
      { userId: "admin-1" },
      ["rfq.manage"],
      organizationId,
    );
    expect(fixture.signed).toHaveBeenCalledWith(objectKey, 300);
  });

  it.each([
    ["missing request", { customRequest: null }],
    ["orphan link", { link: null }],
    ["malformed link", { link: { custom_request_id: "request-2", file_id: fileId } }],
    ["wrong metadata id", { file: { id: "file-2", organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong entity type", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "ORDER", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong entity id", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: "request-2", bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong organization", { file: { id: fileId, organization_id: "org-2", member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong member profile", { file: { id: fileId, organization_id: organizationId, member_profile_id: "member-2", entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong bucket", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "public", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong visibility", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "PUBLIC", object_key: objectKey } }],
    ["blank key", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: "" } }],
    ["prefix without object", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: `custom-requests/${memberProfileId}/${requestId}/` } }],
    ["outside prefix", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: `custom-requests/${memberProfileId}/request-2/spec.pdf` } }],
    ["missing metadata", { file: null }],
  ])("rejects %s before organization authorization or signing", async (_label, overrides) => {
    const fixture = createAdmin(overrides as RowSet);
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callGet();

    expect(response.status).toBe(404);
    expect(mocks.assertOrganizationPermission).not.toHaveBeenCalled();
    expect(fixture.signed).not.toHaveBeenCalled();
  });

  it("fails closed on query errors before signing", async () => {
    const fixture = createAdmin({ errors: { custom_request_files: new Error("QUERY_FAILED") } });
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callGet();

    expect(response.status).toBe(500);
    expect(fixture.signed).not.toHaveBeenCalled();
  });

  it("preserves cross-organization permission denial before signing", async () => {
    const fixture = createAdmin();
    mocks.createAdmin.mockReturnValue(fixture.admin);
    mocks.assertOrganizationPermission.mockImplementation(() => {
      throw Object.assign(new Error("PERMISSION_DENIED"), { status: 403 });
    });

    const response = await callGet();

    expect(response.status).toBe(403);
    expect(fixture.signed).not.toHaveBeenCalled();
  });
});
