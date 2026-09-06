import { describe, expect, it } from "vitest";
import { createPrototypeState } from "./prototype-fixtures";
import { prototypeReducer } from "./prototype-reducer";
import { roleActionItems, selectMemberCatalog, selectMemberSafeState, uatSummary } from "./prototype-selectors";
import type { PrototypeAction, PrototypeState } from "./prototype-types";

type ActionInput = PrototypeAction extends infer T ? T extends PrototypeAction ? Omit<T, "at"> : never : never;
const at = "2026-08-01T05:00:00.000Z";

function run(state: PrototypeState, action: ActionInput) {
  return prototypeReducer(state, { ...action, at } as PrototypeAction);
}

function approveMember() {
  let state = createPrototypeState();
  state = run(state, { type: "REGISTER_DEMO_ACCOUNT", email: "owner@atelier-nara.demo" });
  state = run(state, { type: "SUBMIT_MEMBER_APPLICATION", companyName: "Atelier Nara", taxId: "0105567000001" });
  state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "FOUNDATION" });
  state = run(state, { type: "REVIEW_MEMBER_APPLICATION", decision: "APPROVE", note: "ข้อมูลครบ" });
  return state;
}

describe("MVP readiness demo", () => {
  it("บล็อก Pending Member และบันทึกการปฏิเสธข้อมูลข้ามบริษัท", () => {
    let state = createPrototypeState();
    state = run(state, { type: "SET_MODULE", module: "CATALOG" });
    expect(state.activeModule).toBe("FOUNDATION");
    expect(state.lastError).toBeTruthy();

    for (const item of state.permissionCases) state = run(state, { type: "RUN_PERMISSION_CASE", caseId: item.id });
    expect(state.permissionCases.every((item) => item.result === "DENIED")).toBe(true);
    expect(state.audit.filter((item) => item.action === "RUN_PERMISSION_CASE")).toHaveLength(3);
  });

  it("อนุมัติบริษัท เชิญผู้ใช้ และกำหนดหลาย Role", () => {
    let state = approveMember();
    state = run(state, { type: "INVITE_ORGANIZATION_USER", email: "team@atelier-nara.demo", fullName: "Nara Team" });
    const user = state.organizationUsers.at(-1)!;
    state = run(state, { type: "SET_ORGANIZATION_USER_ROLES", userId: user.id, roles: ["MEMBER", "FINANCE"] });
    expect(state.memberApplication.status).toBe("APPROVED");
    expect(state.organizationUsers.at(-1)?.roles).toEqual(["MEMBER", "FINANCE"]);
  });

  it("Publish ได้เมื่อมี Active Member Price และ Discontinued หายจาก Member Catalog", () => {
    let state = approveMember();
    const supplierId = state.suppliers[0].id;
    state = run(state, { type: "CREATE_PRODUCT_DRAFT", nameTh: "เก้าอี้ Demo", sku: "DEMO-CHAIR-01", supplierId, memberUnitPrice: "0.00", factoryUnitCost: "4500.00" });
    const productId = state.catalog.at(-1)!.id;
    state = run(state, { type: "PUBLISH_PRODUCT", productId });
    expect(state.catalog.at(-1)?.lifecycleStatus).toBe("DRAFT");
    state = run(state, { type: "UPDATE_PRODUCT_MASTER", productId, memberUnitPrice: "8900.00", activeMemberPrice: true });
    state = run(state, { type: "PUBLISH_PRODUCT", productId });
    expect(selectMemberCatalog(state).some((item) => item.id === productId)).toBe(true);
    state = run(state, { type: "DISCONTINUE_PRODUCT", productId });
    expect(selectMemberCatalog(state).some((item) => item.id === productId)).toBe(false);
  });

  it("Member-safe serialization ไม่เปิดเผยต้นทุน Supplier payment Internal note หรือไฟล์ลับ", () => {
    const serialized = JSON.stringify(selectMemberSafeState(createPrototypeState()));
    expect(serialized).not.toContain("factoryUnitCost");
    expect(serialized).not.toContain("factoryCostTotal");
    expect(serialized).not.toContain("supplierBalancePaid");
    expect(serialized).not.toContain("internalNote");
    expect(serialized).not.toContain("confidentialFiles");
  });

  it("Action Required แสดงตาม Role และ Role อื่นปิดแทนไม่ได้", () => {
    let state = createPrototypeState();
    const memberAction = roleActionItems(state)[0];
    state = run(state, { type: "COMPLETE_ACTION_ITEM", actionItemId: memberAction.id });
    expect(state.actionItems.find((item) => item.id === memberAction.id)?.status).toBe("DONE");
    state = run(state, { type: "SWITCH_ROLE", role: "FINANCE", module: "DASHBOARDS" });
    const adminAction = state.actionItems.find((item) => item.role === "GISP_ADMIN")!;
    state = run(state, { type: "COMPLETE_ACTION_ITEM", actionItemId: adminAction.id });
    expect(state.actionItems.find((item) => item.id === adminAction.id)?.status).not.toBe("DONE");
  });

  it("Sign-off ไม่ผ่านถ้ายังมี UAT ต้องแก้ และผ่านเมื่อครบ 8 Scenario", () => {
    let state = createPrototypeState();
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "UAT" });
    state = run(state, { type: "UPDATE_UAT_RESULT", resultId: state.uatResults[0].id, status: "NEEDS_FIX", note: "ทบทวน permission" });
    state = run(state, { type: "SIGN_OFF_UAT" });
    expect(state.buildReadiness).toBe("IN_UAT");
    for (const result of state.uatResults) state = run(state, { type: "UPDATE_UAT_RESULT", resultId: result.id, status: "PASS", note: "ผ่าน UAT" });
    expect(uatSummary(state).passed).toBe(8);
    state = run(state, { type: "SIGN_OFF_UAT" });
    expect(state.buildReadiness).toBe("APPROVED_FOR_MVP_BUILD");
  });

  it("Quotation หมดอายุแล้วต้องออก Revision และรับฉบับหมดอายุไม่ได้", () => {
    let state = approveMember();
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "CATALOG" });
    state = run(state, { type: "ADD_PROJECT_ITEM", productId: "product-reception-counter", quantity: 1, area: "Lobby" });
    const itemId = state.projectItems.at(-1)!.id;
    state = run(state, { type: "SUBMIT_RFQ", itemIds: [itemId], title: "Counter", specification: "Walnut", files: [] });
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "RFQ" });
    state = run(state, { type: "SEND_QUOTATION", unitPrices: { [itemId]: "165000.00" }, specification: "Walnut", leadTimeDays: 60, validityDays: 30 });
    const quoteId = state.quotations[0].id;
    state = run(state, { type: "EXPIRE_QUOTATION", quotationId: quoteId });
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "RFQ" });
    state = run(state, { type: "RESPOND_QUOTATION", quotationId: quoteId, response: "ACCEPT" });
    expect(state.quotations[0].status).toBe("EXPIRED");
    expect(state.lastError).toBeTruthy();
  });

  it("UAT Summary และข้อมูลเตรียมระบบยังคงเป็น Browser-local Version 3", () => {
    const state = createPrototypeState();
    expect(state.schemaVersion).toBe(3);
    expect(state.uatResults).toHaveLength(8);
    expect(uatSummary(state)).toEqual({ passed: 0, needsFix: 0, untested: 8, total: 8 });
    expect(state.buildReadiness).toBe("IN_UAT");
  });
});
