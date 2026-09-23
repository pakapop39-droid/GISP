import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  requireMember: vi.fn(),
  apiError: vi.fn((error: { status?: number }) => Response.json(
    { code: "ERROR" },
    { status: error?.status ?? 500 },
  )),
}));

vi.mock("@/lib/api/response", () => ({ apiError: mocks.apiError }));
vi.mock("@/lib/custom-rfq/server", () => ({ requireMember: mocks.requireMember }));
vi.mock("@/lib/insforge/admin", () => ({ createInsForgeAdminClient: mocks.createAdmin }));

import { DELETE, GET } from "./route";

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
  metadataDeleteError?: Error;
};

function createAdmin(rows: RowSet = {}) {
  const events: string[] = [];
  const signed = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.invalid/signed" }, error: null });
  const remove = vi.fn(async () => {
    events.push("storage.remove");
    return { data: null, error: null };
  });
  const dataByTable: Record<string, Record<string, unknown> | null> = {
    custom_requests: rows.customRequest === undefined ? {
      id: requestId,
      organization_id: organizationId,
      member_profile_id: memberProfileId,
      status: "DRAFT",
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
      original_name: "spec.pdf",
    } : rows.file,
  };
  const admin = {
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
        delete: () => {
          events.push(`database.delete:${table}`);
          const chain = {
            error: table === "file_metadata" ? rows.metadataDeleteError ?? null : null,
            eq: () => chain,
          };
          return chain;
        },
      })),
    },
    storage: { from: () => ({ createSignedUrl: signed, remove }) },
  };
  return { admin, events, signed, remove };
}

function callGet() {
  return GET({} as never, { params: Promise.resolve({ id: requestId, fileId }) });
}

function callDelete() {
  return DELETE({} as never, { params: Promise.resolve({ id: requestId, fileId }) });
}

describe("Member Custom Request file binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMember.mockResolvedValue({ memberProfileId, organizationId, userId: "user-1" });
  });

  it("creates a signed URL only for the exact private same-request binding", async () => {
    const fixture = createAdmin();
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callGet();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.invalid/signed");
    expect(fixture.signed).toHaveBeenCalledWith(objectKey, 300);
  });

  it.each([
    ["cross organization", { customRequest: { id: requestId, organization_id: "org-2", member_profile_id: memberProfileId } }],
    ["wrong owner", { customRequest: { id: requestId, organization_id: organizationId, member_profile_id: "member-2" } }],
    ["orphan link", { link: null }],
    ["malformed link", { link: { custom_request_id: "request-2", file_id: fileId } }],
    ["wrong metadata id", { file: { id: "file-2", organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong entity type", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "ORDER", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong entity id", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: "request-2", bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong metadata organization", { file: { id: fileId, organization_id: "org-2", member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong metadata member", { file: { id: fileId, organization_id: organizationId, member_profile_id: "member-2", entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong bucket", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "public", visibility: "MEMBER_PRIVATE", object_key: objectKey } }],
    ["wrong visibility", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "PUBLIC", object_key: objectKey } }],
    ["blank key", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: "" } }],
    ["prefix without object", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: `custom-requests/${memberProfileId}/${requestId}/` } }],
    ["outside prefix", { file: { id: fileId, organization_id: organizationId, member_profile_id: memberProfileId, entity_type: "CUSTOM_REQUEST", entity_id: requestId, bucket: "gisp-member-private", visibility: "MEMBER_PRIVATE", object_key: `custom-requests/${memberProfileId}/request-2/spec.pdf` } }],
    ["missing metadata", { file: null }],
  ])("rejects %s before signing", async (_label, overrides) => {
    const fixture = createAdmin(overrides as RowSet);
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callGet();

    expect(response.status).toBe(404);
    expect(fixture.signed).not.toHaveBeenCalled();
  });

  it("fails closed on a query error before signing", async () => {
    const fixture = createAdmin({ errors: { file_metadata: new Error("QUERY_FAILED") } });
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callGet();

    expect(response.status).toBe(500);
    expect(fixture.signed).not.toHaveBeenCalled();
  });

  it("preserves DELETE order: link, metadata, then storage object", async () => {
    const fixture = createAdmin();
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callDelete();

    expect(response.status).toBe(200);
    expect(fixture.events).toEqual([
      "database.delete:custom_request_files",
      "database.delete:file_metadata",
      "storage.remove",
    ]);
    expect(fixture.remove).toHaveBeenCalledWith(objectKey);
  });

  it("preserves DELETE fail-closed cleanup when metadata deletion fails", async () => {
    const fixture = createAdmin({ metadataDeleteError: new Error("DELETE_FAILED") });
    mocks.createAdmin.mockReturnValue(fixture.admin);

    const response = await callDelete();

    expect(response.status).toBe(500);
    expect(fixture.events).toEqual([
      "database.delete:custom_request_files",
      "database.delete:file_metadata",
    ]);
    expect(fixture.remove).not.toHaveBeenCalled();
  });
});
