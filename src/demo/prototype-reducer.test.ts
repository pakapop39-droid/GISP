import { describe, expect, it } from "vitest";
import { createPrototypeState } from "./prototype-fixtures";
import { prototypeReducer } from "./prototype-reducer";
import { dispatchGateForItem, paymentSummary, selectMemberSafeState } from "./prototype-selectors";
import type { PrototypeAction, PrototypeState } from "./prototype-types";

type ActionInput = PrototypeAction extends infer T ? T extends PrototypeAction ? Omit<T, "at"> : never : never;
const at = "2026-07-31T03:00:00.000Z";

function run(state: PrototypeState, action: ActionInput) {
  return prototypeReducer(state, { ...action, at } as PrototypeAction);
}

function approvedState() {
  let state = createPrototypeState();
  state = run(state, { type: "REGISTER_DEMO_ACCOUNT", email: "owner@atelier-nara.demo" });
  state = run(state, { type: "SUBMIT_MEMBER_APPLICATION", companyName: "Atelier Nara Co., Ltd.", taxId: "0105567000001" });
  state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "FOUNDATION" });
  state = run(state, { type: "REVIEW_MEMBER_APPLICATION", decision: "APPROVE", note: "ข้อมูล Demo ครบถ้วน" });
  state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "CATALOG" });
  return state;
}

function quotedState() {
  let state = approvedState();
  state = run(state, { type: "ADD_PROJECT_ITEM", productId: "product-reception-counter", quantity: 1, area: "Lobby" });
  const customId = state.projectItems.find((item) => item.kind === "CUSTOM")!.id;
  state = run(state, { type: "SUBMIT_RFQ", itemIds: [customId], title: "Custom counter", specification: "Walnut veneer", files: [{ name: "drawing.pdf", type: "application/pdf", size: 1000 }] });
  state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "RFQ" });
  state = run(state, { type: "SEND_QUOTATION", unitPrices: { [customId]: "165000.00" }, specification: "Walnut veneer confirmed", leadTimeDays: 60, validityDays: 30 });
  return { state, customId };
}

function orderWithVerifiedDeposit() {
  const setup = quotedState();
  let state = setup.state;
  const customId = setup.customId;
  const quoteId = state.quotations[0].id;
  state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "RFQ" });
  state = run(state, { type: "RESPOND_QUOTATION", quotationId: quoteId, response: "ACCEPT" });
  state = run(state, { type: "CREATE_ORDER", quantities: Object.fromEntries(state.projectItems.map((item) => [item.id, item.quantity])) });
  const deposit = state.paymentSchedules.find((item) => item.type === "DEPOSIT")!;
  state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: deposit.id, amount: "100000.00", reference: "D-1" });
  state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: deposit.id, amount: String(Number(deposit.dueAmount) - 100000), reference: "D-2" });
  state = run(state, { type: "SWITCH_ROLE", role: "FINANCE", module: "ORDER" });
  for (const transfer of state.transfers.filter((item) => item.scheduleId === deposit.id)) state = run(state, { type: "VERIFY_PAYMENT", transferId: transfer.id });
  return { state, customId };
}

describe("Functional Prototype reducer", () => {
  it("ทำ Standard พร้อมสั่ง แต่ Block Custom จนรับ Quotation", () => {
    let state = approvedState();
    state = run(state, { type: "ADD_PROJECT_ITEM", productId: "product-reception-counter", quantity: 1, area: "Lobby" });
    const custom = state.projectItems.at(-1)!;
    expect(state.projectItems[0].status).toBe("READY_TO_ORDER");
    expect(custom.status).toBe("WAITING_QUOTATION");
    state = run(state, { type: "CREATE_ORDER", quantities: { [custom.id]: 1 } });
    expect(state.order).toBeNull();
    expect(state.lastError).toContain("พร้อมสั่ง");
  });

  it("รองรับ RFQ ขอข้อมูลเพิ่มและ Resubmit", () => {
    let state = approvedState();
    state = run(state, { type: "ADD_PROJECT_ITEM", productId: "product-reception-counter", quantity: 1, area: "Lobby" });
    const id = state.projectItems.at(-1)!.id;
    state = run(state, { type: "SUBMIT_RFQ", itemIds: [id], title: "Counter", specification: "Draft spec", files: [] });
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "RFQ" });
    state = run(state, { type: "REQUEST_RFQ_INFO", message: "Need color sample" });
    expect(state.rfq?.status).toBe("NEEDS_INFO");
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "RFQ" });
    state = run(state, { type: "RESUBMIT_RFQ", specification: "Confirmed walnut sample" });
    expect(state.rfq?.status).toBe("READY_TO_QUOTE");
  });

  it("ทำ Version เก่าเป็น SUPERSEDED และรับได้เฉพาะ Active", () => {
    const setup = quotedState();
    let state = setup.state;
    const customId = setup.customId;
    const v1 = state.quotations[0].id;
    state = run(state, { type: "SEND_QUOTATION", unitPrices: { [customId]: "175000.00" }, specification: "Revision 2", leadTimeDays: 55, validityDays: 30 });
    expect(state.quotations.map((item) => item.status)).toEqual(["SUPERSEDED", "SENT"]);
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "RFQ" });
    state = run(state, { type: "RESPOND_QUOTATION", quotationId: v1, response: "ACCEPT" });
    expect(state.lastError).toContain("Active");
    state = run(state, { type: "RESPOND_QUOTATION", quotationId: state.quotations[1].id, response: "ACCEPT" });
    expect(state.projectItems.find((item) => item.id === customId)?.memberUnitPriceSnapshot).toBe("175000.00");
  });

  it("คำนวณ VAT และ Deposit/Balance 50/50 โดยไม่เกิดส่วนต่าง", () => {
    let { state } = quotedState();
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "RESPOND_QUOTATION", quotationId: state.quotations[0].id, response: "ACCEPT" });
    const item = state.projectItems.find((entry) => entry.kind === "CUSTOM")!;
    state = run(state, { type: "CREATE_ORDER", quantities: { [item.id]: 1 } });
    expect(state.order?.subtotal).toBe("165000.00");
    expect(state.order?.vatAmount).toBe("11550.00");
    expect(Number(state.order?.deposit) + Number(state.order?.balance)).toBe(Number(state.order?.grandTotal));
  });

  it("ยอดสะสมไม่ครบยัง Pending และยอดเกินแสดง Overpayment", () => {
    let { state } = orderWithVerifiedDeposit();
    const balance = state.paymentSchedules.find((item) => item.type === "BALANCE")!;
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: balance.id, amount: "1.00", reference: "B-1" });
    state = run(state, { type: "SWITCH_ROLE", role: "FINANCE", module: "ORDER" });
    state = run(state, { type: "VERIFY_PAYMENT", transferId: state.transfers.at(-1)!.id });
    expect(state.paymentSchedules.find((item) => item.id === balance.id)?.status).toBe("PENDING");
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: balance.id, amount: balance.dueAmount, reference: "B-2" });
    state = run(state, { type: "SWITCH_ROLE", role: "FINANCE", module: "ORDER" });
    state = run(state, { type: "VERIFY_PAYMENT", transferId: state.transfers.at(-1)!.id });
    expect(paymentSummary(state, balance.id).isOverpaid).toBe(true);
  });

  it("บล็อก PO ก่อน Deposit Verified", () => {
    let { state } = quotedState();
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "RESPOND_QUOTATION", quotationId: state.quotations[0].id, response: "ACCEPT" });
    state = run(state, { type: "CREATE_ORDER", quantities: { [state.projectItems[0].id]: 1 } });
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "ORDER" });
    state = run(state, { type: "ISSUE_PO" });
    expect(state.supplierOrders).toHaveLength(0);
    expect(state.lastError).toContain("Deposit");
  });

  it("รองรับ Reject และ Resubmit payment", () => {
    let { state } = quotedState();
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "RESPOND_QUOTATION", quotationId: state.quotations[0].id, response: "ACCEPT" });
    state = run(state, { type: "CREATE_ORDER", quantities: { [state.projectItems[0].id]: 1 } });
    state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: "schedule-deposit", amount: "1000", reference: "WRONG" });
    state = run(state, { type: "SWITCH_ROLE", role: "FINANCE", module: "ORDER" });
    state = run(state, { type: "REJECT_PAYMENT", transferId: "transfer-1", reason: "Mismatch" });
    expect(state.transfers[0].status).toBe("REJECTED");
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: "schedule-deposit", amount: "1000", reference: "RESUBMIT" });
    expect(state.transfers.at(-1)?.status).toBe("SUBMITTED");
  });

  it("บังคับ QC → Member Approval → Customer Balance → Supplier Balance", () => {
    const setup = orderWithVerifiedDeposit();
    let state = setup.state;
    const customId = setup.customId;
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "ORDER" });
    state = run(state, { type: "ISSUE_PO" });
    expect(dispatchGateForItem(state, customId).failures).toHaveLength(4);
    state = run(state, { type: "SWITCH_ROLE", role: "QC", module: "QC" });
    state = run(state, { type: "RECORD_QC", projectItemId: customId, result: "FAILED", note: "Color mismatch" });
    state = run(state, { type: "RECORD_QC", projectItemId: customId, result: "REWORK_REQUIRED", note: "Rework" });
    state = run(state, { type: "RECORD_QC", projectItemId: customId, result: "PASSED", note: "Reinspection passed" });
    expect(dispatchGateForItem(state, customId).failures).not.toContain("QC_NOT_PASSED");
  });

  it("Member-safe serialization ไม่เผย Factory Cost, Supplier Payment หรือ Internal Note", () => {
    const state = createPrototypeState();
    const serialized = JSON.stringify(selectMemberSafeState(state));
    expect(serialized).not.toContain("factoryUnitCost");
    expect(serialized).not.toContain("factoryCostTotal");
    expect(serialized).not.toContain("supplierBalancePaid");
    expect(serialized).not.toContain("internalNote");
  });

  it("เดิน Integration ตั้งแต่ PO, QC, Partial Shipment ถึง Claim Resolution", () => {
    const setup = orderWithVerifiedDeposit();
    let state = setup.state;
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "ORDER" });
    state = run(state, { type: "ISSUE_PO" });

    const balance = state.paymentSchedules.find((item) => item.type === "BALANCE")!;
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "ORDER" });
    state = run(state, { type: "SUBMIT_PAYMENT", scheduleId: balance.id, amount: balance.dueAmount, reference: "BAL-FULL" });
    state = run(state, { type: "SWITCH_ROLE", role: "FINANCE", module: "ORDER" });
    state = run(state, { type: "VERIFY_PAYMENT", transferId: state.transfers.at(-1)!.id });
    for (const supplierOrder of state.supplierOrders) state = run(state, { type: "MARK_SUPPLIER_BALANCE_PAID", supplierOrderId: supplierOrder.id });

    state = run(state, { type: "SWITCH_ROLE", role: "QC", module: "QC" });
    for (const line of state.order!.lines) state = run(state, { type: "RECORD_QC", projectItemId: line.projectItemId, result: "PASSED", note: "Reinspection passed" });
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "QC" });
    state = run(state, { type: "APPROVE_CUSTOM_QC", projectItemId: setup.customId });
    expect(state.order!.lines.every((line) => dispatchGateForItem(state, line.projectItemId).allowed)).toBe(true);

    state = run(state, { type: "SWITCH_ROLE", role: "LOGISTICS", module: "SHIPMENT" });
    const first = state.order!.lines[0];
    state = run(state, { type: "CREATE_SHIPMENT", allocations: [{ projectItemId: first.projectItemId, quantity: 1 }], tracking: "TRACK-1" });
    expect(state.shipments).toHaveLength(1);
    state = run(state, { type: "CREATE_SHIPMENT", allocations: [{ projectItemId: first.projectItemId, quantity: first.quantity }], tracking: "TOO-MUCH" });
    expect(state.shipments).toHaveLength(1);
    expect(state.lastError).toContain("เกิน");
    state = run(state, { type: "RECORD_DELIVERY", shipmentId: "shipment-1", recipient: "Site Manager", result: "WITH_ISSUE", evidence: [{ name: "damage.jpg", type: "image/jpeg", size: 500 }] });

    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "SHIPMENT" });
    state = run(state, { type: "OPEN_CLAIM", shipmentId: "shipment-1", projectItemId: first.projectItemId, description: "Scuff found" });
    state = run(state, { type: "SWITCH_ROLE", role: "GISP_ADMIN", module: "SHIPMENT" });
    state = run(state, { type: "RESOLVE_CLAIM", resolution: "Replace one piece" });
    state = run(state, { type: "SWITCH_ROLE", role: "MEMBER", module: "SHIPMENT" });
    state = run(state, { type: "CONFIRM_CLAIM" });
    expect(state.claim?.status).toBe("CLOSED");
  });

  it("สร้าง Browser-local audit ทุก Action และ Reset แยกได้", () => {
    let state = approvedState();
    state = run(state, { type: "ADD_PROJECT_ITEM", productId: "product-dining-chair", quantity: 4, area: "All-day Dining" });
    expect(state.audit.at(-1)?.action).toBe("ADD_PROJECT_ITEM");
    state = run(state, { type: "RESET_PROTOTYPE" });
    expect(state.projectItems).toHaveLength(2);
    expect(state.schemaVersion).toBe(3);
  });
});
