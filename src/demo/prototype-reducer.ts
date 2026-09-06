import Decimal from "decimal.js";
import { calculateMoney } from "../lib/money";
import { createPrototypeState } from "./prototype-fixtures";
import { reducePreparationAction } from "./prototype-preparation-reducer";
import { dispatchGateForItem, money, paymentSummary, shippedQuantity } from "./prototype-selectors";
import type { DemoRole } from "./types";
import type { PrototypeAction, PrototypeState } from "./prototype-types";

const roleNames: Record<DemoRole, string> = {
  MEMBER: "Member",
  GISP_ADMIN: "Admin",
  FINANCE: "Finance",
  QC: "QC",
  LOGISTICS: "Logistics",
  EXECUTIVE: "Executive",
};

function fail(state: PrototypeState, message: string): PrototypeState {
  return { ...state, lastError: message };
}

function allowed(state: PrototypeState, roles: DemoRole[]) {
  return roles.includes(state.activeRole);
}

function success(state: PrototypeState, action: PrototypeAction, detail: string): PrototypeState {
  return {
    ...state,
    lastError: null,
    audit: [
      ...state.audit,
      {
        id: `audit-${state.audit.length + 1}`,
        at: action.at,
        actor: state.activeRole,
        action: action.type,
        detail,
      },
    ],
  };
}

export function prototypeReducer(state: PrototypeState, action: PrototypeAction): PrototypeState {
  if (action.type === "HYDRATE") return action.state.schemaVersion === 3 ? action.state : state;
  if (action.type === "RESET_PROTOTYPE") return createPrototypeState();
  if (action.type === "SET_MODULE") {
    const memberLockedModules = new Set(["CATALOG", "RFQ", "ORDER", "QC", "SHIPMENT", "DOCUMENTS"]);
    if (state.activeRole === "MEMBER" && state.memberApplication.status !== "APPROVED" && memberLockedModules.has(action.module)) {
      return fail(state, "บัญชี Member ยังรออนุมัติ กรุณาทำ Foundation Workflow ก่อน");
    }
    return { ...state, activeModule: action.module, lastError: null };
  }
  if (action.type === "SWITCH_ROLE") {
    return success(
      { ...state, activeRole: action.role, activeModule: action.module ?? state.activeModule },
      action,
      `ส่งต่องานให้ ${roleNames[action.role]}`,
    );
  }

  const preparationState = reducePreparationAction(state, action);
  if (preparationState) return preparationState;

  if (action.type === "ADD_PROJECT_ITEM") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงเพิ่มสินค้าในโครงการได้");
    if (state.memberApplication.status !== "APPROVED") return fail(state, "Member ต้องได้รับการอนุมัติก่อนเพิ่มสินค้า");
    const product = state.catalog.find((item) => item.id === action.productId);
    if (!product || action.quantity < 1) return fail(state, "กรุณาเลือกสินค้าและจำนวนที่ถูกต้อง");
    if (product.lifecycleStatus !== "PUBLISHED" || !product.activeMemberPrice || new Decimal(product.memberUnitPrice).lessThanOrEqualTo(0)) {
      return fail(state, "สินค้านี้ยังไม่ Published หรือไม่มี Active Member Price");
    }
    const item = {
      id: `item-prototype-${state.projectItems.length + 1}`,
      projectId: state.project.id,
      productId: product.id,
      supplierId: product.supplierId,
      area: action.area,
      quantity: action.quantity,
      kind: product.kind,
      memberUnitPriceSnapshot: product.kind === "STANDARD" ? product.memberUnitPrice : null,
      specificationSnapshot: product.specification,
      status: product.kind === "STANDARD" ? "READY_TO_ORDER" as const : "WAITING_QUOTATION" as const,
      customQuotationId: null,
      memberApprovedAt: null,
    };
    return success({ ...state, projectItems: [...state.projectItems, item] }, action, `เพิ่ม ${product.nameTh} จำนวน ${action.quantity}`);
  }

  if (action.type === "UPDATE_PROJECT_ITEM") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงแก้รายการโครงการได้");
    const item = state.projectItems.find((entry) => entry.id === action.itemId);
    if (!item || (action.quantity !== undefined && action.quantity < 1)) return fail(state, "ไม่พบรายการหรือจำนวนไม่ถูกต้อง");
    if (item.status === "ORDERED") return fail(state, "รายการที่สร้าง Order แล้วแก้ไม่ได้");
    return success({ ...state, projectItems: state.projectItems.map((entry) => entry.id === action.itemId ? { ...entry, quantity: action.quantity ?? entry.quantity, area: action.area ?? entry.area, specificationSnapshot: action.specification ?? entry.specificationSnapshot } : entry) }, action, "แก้จำนวน พื้นที่ หรือสเปกใน Project");
  }

  if (action.type === "REMOVE_PROJECT_ITEM") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงลบรายการได้");
    if (state.order?.lines.some((line) => line.projectItemId === action.itemId)) return fail(state, "ลบรายการที่อยู่ใน Order ไม่ได้");
    return success({ ...state, projectItems: state.projectItems.filter((item) => item.id !== action.itemId) }, action, "ลบรายการออกจาก Project");
  }

  if (action.type === "SUBMIT_RFQ") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงส่ง RFQ ได้");
    const validItems = state.projectItems.filter((item) => action.itemIds.includes(item.id) && item.kind === "CUSTOM");
    if (!validItems.length || !action.specification.trim()) return fail(state, "RFQ ต้องมีสินค้า Custom และสเปก");
    const rfq = { id: "rfq-prototype-1", number: "RFQ-2026-000101", itemIds: validItems.map((item) => item.id), title: action.title, specification: action.specification, files: action.files, supplierId: null, status: "SUBMITTED" as const, adminMessage: null };
    return success({ ...state, rfq }, action, `ส่ง ${rfq.number} พร้อมไฟล์จำลอง ${action.files.length} ไฟล์`);
  }

  if (action.type === "REQUEST_RFQ_INFO") {
    if (!allowed(state, ["GISP_ADMIN"]) || !state.rfq) return fail(state, "Admin และ RFQ ที่ส่งแล้วเท่านั้นจึงขอข้อมูลเพิ่มได้");
    return success({ ...state, rfq: { ...state.rfq, status: "NEEDS_INFO", adminMessage: action.message } }, action, "ขอข้อมูล RFQ เพิ่มจาก Member");
  }

  if (action.type === "RESUBMIT_RFQ") {
    if (!allowed(state, ["MEMBER"]) || state.rfq?.status !== "NEEDS_INFO") return fail(state, "RFQ ไม่ได้อยู่ในสถานะรอข้อมูลเพิ่ม");
    return success({ ...state, rfq: { ...state.rfq, status: "READY_TO_QUOTE", specification: action.specification, adminMessage: null } }, action, "Member ส่งข้อมูล RFQ เพิ่มแล้ว");
  }

  if (action.type === "SEND_QUOTATION") {
    if (!allowed(state, ["GISP_ADMIN"]) || !state.rfq || !["SUBMITTED", "READY_TO_QUOTE", "QUOTED"].includes(state.rfq.status)) return fail(state, "Admin ต้องมี RFQ ที่พร้อมเสนอราคา");
    const items = state.projectItems.filter((item) => state.rfq?.itemIds.includes(item.id));
    if (items.some((item) => !action.unitPrices[item.id] || new Decimal(action.unitPrices[item.id]).lte(0))) return fail(state, "กรุณาระบุราคา Custom ทุกรายการ");
    const subtotal = items.reduce((sum, item) => sum.add(new Decimal(action.unitPrices[item.id]).mul(item.quantity)), new Decimal(0));
    const totals = calculateMoney(subtotal);
    const quotations = state.quotations.map((quote) => quote.status === "SENT" ? { ...quote, status: "SUPERSEDED" as const } : quote);
    const version = quotations.length + 1;
    const quotation = { id: `quotation-${version}`, number: "QT-2026-000101", rfqId: state.rfq.id, version, status: "SENT" as const, unitPrices: action.unitPrices, subtotal: totals.subtotal, vatRate: totals.vatRate, vatAmount: totals.vatAmount, grandTotal: totals.grandTotal, specificationSnapshot: action.specification, leadTimeDays: action.leadTimeDays, validityDays: action.validityDays };
    return success({ ...state, quotations: [...quotations, quotation], rfq: { ...state.rfq, status: "QUOTED", supplierId: "supplier-guangzhou-bespoke" } }, action, `ส่ง ${quotation.number} Version ${version}`);
  }

  if (action.type === "RESPOND_QUOTATION") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงตอบใบเสนอราคาได้");
    const target = state.quotations.find((item) => item.id === action.quotationId);
    if (!target || target.status !== "SENT") return fail(state, "ตอบได้เฉพาะใบเสนอราคา Active ล่าสุด");
    const accepted = action.response === "ACCEPT";
    const quotations = state.quotations.map((item) => item.id === target.id ? { ...item, status: accepted ? "ACCEPTED" as const : "REJECTED" as const } : item);
    const projectItems = accepted ? state.projectItems.map((item) => target.unitPrices[item.id] ? { ...item, memberUnitPriceSnapshot: money(target.unitPrices[item.id]), specificationSnapshot: target.specificationSnapshot, status: "READY_TO_ORDER" as const, customQuotationId: target.id } : item) : state.projectItems;
    return success({ ...state, quotations, projectItems }, action, accepted ? `ยอมรับ Version ${target.version} และ Snapshot ราคา/สเปก` : `ปฏิเสธ Version ${target.version}`);
  }

  if (action.type === "CREATE_ORDER") {
    if (!allowed(state, ["MEMBER"]) || state.order) return fail(state, "Member สร้าง Order ได้ครั้งเดียวในสถานการณ์นี้");
    if (state.memberApplication.status !== "APPROVED") return fail(state, "Member ต้องได้รับการอนุมัติก่อนสร้าง Order");
    const lines = Object.entries(action.quantities).filter(([, quantity]) => quantity > 0).map(([projectItemId, quantity]) => {
      const item = state.projectItems.find((entry) => entry.id === projectItemId);
      return item ? { projectItemId, quantity, unitPrice: item.memberUnitPriceSnapshot ?? "0.00", item } : null;
    }).filter((line): line is NonNullable<typeof line> => Boolean(line));
    if (!lines.length || lines.some((line) => line.item.status !== "READY_TO_ORDER" || line.quantity > line.item.quantity)) return fail(state, "เลือกได้เฉพาะจำนวนที่พร้อมสั่งและไม่เกิน Project");
    const subtotal = lines.reduce((sum, line) => sum.add(new Decimal(line.unitPrice).mul(line.quantity)), new Decimal(0));
    const totals = calculateMoney(subtotal);
    const orderLines = lines.map((line) => ({ projectItemId: line.projectItemId, quantity: line.quantity, unitPrice: line.unitPrice }));
    const order = { id: "order-prototype-1", number: "ORD-2026-000101", lines: orderLines, ...totals, status: "AWAITING_DEPOSIT" as const };
    const paymentSchedules = [
      { id: "schedule-deposit", type: "DEPOSIT" as const, dueAmount: totals.deposit, verifiedAmount: "0.00", status: "PENDING" as const },
      { id: "schedule-balance", type: "BALANCE" as const, dueAmount: totals.balance, verifiedAmount: "0.00", status: "PENDING" as const },
    ];
    const selected = new Set(lines.map((line) => line.projectItemId));
    return success({ ...state, order, paymentSchedules, projectItems: state.projectItems.map((item) => selected.has(item.id) ? { ...item, status: "ORDERED" as const } : item) }, action, `สร้าง ${order.number} ยอดรวม ${totals.grandTotal} บาท`);
  }

  if (action.type === "SUBMIT_PAYMENT") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงส่งหลักฐานการโอนได้");
    if (!state.paymentSchedules.some((item) => item.id === action.scheduleId) || new Decimal(action.amount || 0).lte(0)) return fail(state, "ยอดโอนหรือรอบชำระไม่ถูกต้อง");
    const transfer = { id: `transfer-${state.transfers.length + 1}`, scheduleId: action.scheduleId, amount: money(action.amount), reference: action.reference, status: "SUBMITTED" as const, rejectReason: null };
    return success({ ...state, transfers: [...state.transfers, transfer] }, action, `ส่งยอดโอน ${transfer.amount} บาทให้ Finance ตรวจ`);
  }

  if (action.type === "VERIFY_PAYMENT" || action.type === "REJECT_PAYMENT") {
    if (!allowed(state, ["FINANCE"])) return fail(state, "เฉพาะ Finance จึงตรวจยอดโอนได้");
    const transfer = state.transfers.find((item) => item.id === action.transferId);
    if (!transfer || transfer.status !== "SUBMITTED") return fail(state, "ยอดโอนนี้ไม่ได้รอตรวจ");
    const transfers = state.transfers.map((item) => item.id === transfer.id ? { ...item, status: action.type === "VERIFY_PAYMENT" ? "VERIFIED" as const : "REJECTED" as const, rejectReason: action.type === "REJECT_PAYMENT" ? action.reason : null } : item);
    const temp = { ...state, transfers };
    const paymentSchedules = state.paymentSchedules.map((schedule) => {
      const summary = paymentSummary(temp, schedule.id);
      return { ...schedule, verifiedAmount: summary.verifiedAmount, status: summary.isVerified ? "VERIFIED" as const : "PENDING" as const };
    });
    return success({ ...state, transfers, paymentSchedules }, action, action.type === "VERIFY_PAYMENT" ? "Finance ยืนยันยอดโอนสะสม" : "Finance ปฏิเสธยอดและขอส่งใหม่");
  }

  if (action.type === "ISSUE_PO") {
    if (!allowed(state, ["GISP_ADMIN"]) || !state.order) return fail(state, "Admin ต้องมี Order ก่อนออก PO");
    if (state.paymentSchedules.find((item) => item.type === "DEPOSIT")?.status !== "VERIFIED") return fail(state, "ออก PO ไม่ได้จนกว่า Deposit จะ Verified ครบ");
    if (state.supplierOrders.length > 0) return fail(state, "PO ถูกออกแล้ว ระบบป้องกันการออกซ้ำ");
    const groups = new Map<string, string[]>();
    state.order.lines.forEach((line) => {
      const item = state.projectItems.find((entry) => entry.id === line.projectItemId);
      if (item) groups.set(item.supplierId, [...(groups.get(item.supplierId) ?? []), item.id]);
    });
    const supplierOrders = [...groups.entries()].map(([supplierId, itemIds], index) => ({ id: `supplier-order-${index + 1}`, number: `PO-2026-${String(index + 101).padStart(6, "0")}`, supplierId, itemIds, factoryCostTotal: money(itemIds.reduce((sum, id) => { const item = state.projectItems.find((entry) => entry.id === id); const product = state.catalog.find((entry) => entry.id === item?.productId); return sum.add(new Decimal(product?.factoryUnitCost ?? 0).mul(item?.quantity ?? 0)); }, new Decimal(0))), supplierBalancePaid: false }));
    return success({ ...state, supplierOrders, order: { ...state.order, status: "PO_ISSUED" } }, action, `ออก PO แยก ${supplierOrders.length} Supplier`);
  }

  if (action.type === "RECORD_PRODUCTION_UPDATE") {
    if (!allowed(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึงบันทึกความคืบหน้าการผลิตได้");
    if (!state.supplierOrders.length || action.progress < 0 || action.progress > 100) return fail(state, "ต้องออก PO และระบุ Progress 0–100");
    const update = { id: `production-${state.productionUpdates.length + 1}`, progress: action.progress, eta: action.eta, note: action.note, delayed: action.delayed };
    return success({ ...state, productionUpdates: [...state.productionUpdates, update], order: state.order ? { ...state.order, status: "IN_PRODUCTION" } : null }, action, `อัปเดตการผลิต ${action.progress}%${action.delayed ? " — Delay" : ""}`);
  }

  if (action.type === "RECORD_QC") {
    if (!allowed(state, ["QC"])) return fail(state, "เฉพาะ QC จึงบันทึกผลตรวจได้");
    if (!state.order?.lines.some((line) => line.projectItemId === action.projectItemId)) return fail(state, "ตรวจได้เฉพาะสินค้าใน Order");
    const latest = [...state.qcInspections].reverse().find((entry) => entry.projectItemId === action.projectItemId);
    if (latest?.result === "PASSED") return fail(state, "ผล QC ที่ Passed แล้วแก้ตรงไม่ได้ กรุณาเพิ่ม Correction Event");
    const inspection = { id: `qc-${state.qcInspections.length + 1}`, projectItemId: action.projectItemId, result: action.result, note: action.note, correctionOfId: null };
    return success({ ...state, qcInspections: [...state.qcInspections, inspection] }, action, `QC ${action.result}: ${action.note}`);
  }

  if (action.type === "APPROVE_CUSTOM_QC") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงอนุมัติ QC สินค้า Custom ได้");
    const item = state.projectItems.find((entry) => entry.id === action.projectItemId);
    if (item?.kind !== "CUSTOM" || !state.qcInspections.some((entry) => entry.projectItemId === item.id && entry.result === "PASSED")) return fail(state, "สินค้า Custom ต้อง QC ผ่านก่อน Member Approval");
    return success({ ...state, memberApprovedItemIds: [...new Set([...state.memberApprovedItemIds, item.id])] }, action, "Member อนุมัติสินค้า Custom หลัง QC ผ่าน");
  }

  if (action.type === "MARK_SUPPLIER_BALANCE_PAID") {
    if (!allowed(state, ["FINANCE"])) return fail(state, "เฉพาะ Finance จึงยืนยัน Supplier Balance ได้");
    if (!state.supplierOrders.some((item) => item.id === action.supplierOrderId)) return fail(state, "ไม่พบ Supplier Order");
    return success({ ...state, supplierOrders: state.supplierOrders.map((item) => item.id === action.supplierOrderId ? { ...item, supplierBalancePaid: true } : item) }, action, "Finance ยืนยัน Supplier Balance Paid");
  }

  if (action.type === "CREATE_SHIPMENT") {
    if (!allowed(state, ["LOGISTICS"])) return fail(state, "เฉพาะ Logistics จึงสร้าง Shipment ได้");
    if (!action.allocations.length) return fail(state, "Shipment ต้องมีสินค้าอย่างน้อยหนึ่งรายการ");
    for (const allocation of action.allocations) {
      const line = state.order?.lines.find((entry) => entry.projectItemId === allocation.projectItemId);
      if (!line || allocation.quantity < 1 || shippedQuantity(state, allocation.projectItemId) + allocation.quantity > line.quantity) return fail(state, "จำนวนส่งเกินจำนวนคงเหลือใน Order");
      if (!dispatchGateForItem(state, allocation.projectItemId).allowed) return fail(state, "ยังสร้าง Shipment ไม่ได้: Dispatch Gate ของบางรายการยังไม่ครบ");
    }
    const shipment = { id: `shipment-${state.shipments.length + 1}`, number: `SHP-2026-${String(state.shipments.length + 101).padStart(6, "0")}`, allocations: action.allocations, tracking: action.tracking, status: "IN_TRANSIT" as const, recipient: null, deliveryResult: null, evidence: [] };
    return success({ ...state, shipments: [...state.shipments, shipment] }, action, `สร้าง ${shipment.number} แบบ Partial Shipment`);
  }

  if (action.type === "RECORD_DELIVERY") {
    if (!allowed(state, ["LOGISTICS"])) return fail(state, "เฉพาะ Logistics จึงบันทึกการส่งมอบได้");
    if (!action.recipient.trim()) return fail(state, "ต้องระบุผู้รับสินค้า");
    if (!action.evidence.length) return fail(state, "Delivery ต้องมีหลักฐานจำลองอย่างน้อยหนึ่งไฟล์");
    return success({ ...state, shipments: state.shipments.map((item) => item.id === action.shipmentId ? { ...item, status: "DELIVERED", recipient: action.recipient, deliveryResult: action.result, evidence: action.evidence } : item) }, action, action.result === "WITH_ISSUE" ? "ส่งมอบพร้อมบันทึกปัญหา" : "ส่งมอบครบถ้วน");
  }

  if (action.type === "OPEN_CLAIM") {
    if (!allowed(state, ["MEMBER"])) return fail(state, "เฉพาะ Member จึงเปิด Claim ได้");
    const shipment = state.shipments.find((item) => item.id === action.shipmentId);
    if (shipment?.deliveryResult !== "WITH_ISSUE" || !shipment.allocations.some((item) => item.projectItemId === action.projectItemId)) return fail(state, "เปิด Claim ได้เฉพาะรายการที่ส่งมอบพร้อมปัญหา");
    const claim = { id: "claim-prototype-1", number: "CLM-2026-000101", shipmentId: action.shipmentId, projectItemId: action.projectItemId, description: action.description, status: "SUBMITTED" as const, resolution: null };
    return success({ ...state, claim }, action, `เปิด ${claim.number}`);
  }

  if (action.type === "RESOLVE_CLAIM") {
    if (!allowed(state, ["GISP_ADMIN"]) || state.claim?.status !== "SUBMITTED" || !action.resolution.trim()) return fail(state, "Admin ต้องระบุ Resolution ก่อนส่งให้ Member");
    return success({ ...state, claim: { ...state.claim, status: "RESOLVED", resolution: action.resolution } }, action, "Admin เสนอวิธีแก้ไข Claim");
  }

  if (action.type === "CONFIRM_CLAIM") {
    if (!allowed(state, ["MEMBER"]) || state.claim?.status !== "RESOLVED") return fail(state, "Member ยืนยันได้หลัง Admin ระบุ Resolution แล้ว");
    return success({ ...state, claim: { ...state.claim, status: "CLOSED" } }, action, "Member ยืนยันและปิด Claim");
  }

  return state;
}
