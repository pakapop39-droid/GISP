import Decimal from "decimal.js";
import { evaluateDispatchGate } from "../lib/workflow";
import type { DemoProjectItem } from "./types";
import type { PrototypeProduct, PrototypeState } from "./prototype-types";

export function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

export function projectItemTotal(state: PrototypeState, item: DemoProjectItem) {
  return money(new Decimal(item.memberUnitPriceSnapshot ?? 0).mul(item.quantity));
}

export function paymentSummary(state: PrototypeState, scheduleId: string) {
  const schedule = state.paymentSchedules.find((item) => item.id === scheduleId);
  const verified = state.transfers
    .filter((item) => item.scheduleId === scheduleId && item.status === "VERIFIED")
    .reduce((sum, item) => sum.add(item.amount), new Decimal(0));
  const due = new Decimal(schedule?.dueAmount ?? 0);
  return {
    verifiedAmount: money(verified),
    outstandingAmount: money(Decimal.max(due.minus(verified), 0)),
    isVerified: verified.greaterThanOrEqualTo(due),
    isOverpaid: verified.greaterThan(due),
  };
}

export function latestQcPassed(state: PrototypeState, projectItemId: string) {
  const result = [...state.qcInspections]
    .reverse()
    .find((item) => item.projectItemId === projectItemId)?.result;
  return result === "PASSED";
}

export function dispatchGateForItem(state: PrototypeState, projectItemId: string) {
  const item = state.projectItems.find((entry) => entry.id === projectItemId);
  const supplierOrder = state.supplierOrders.find((entry) => entry.itemIds.includes(projectItemId));
  const balance = state.paymentSchedules.find((entry) => entry.type === "BALANCE");
  return evaluateDispatchGate({
    qcPassed: latestQcPassed(state, projectItemId),
    isCustom: item?.kind === "CUSTOM",
    memberApproved: state.memberApprovedItemIds.includes(projectItemId),
    customerBalanceVerified: balance?.status === "VERIFIED",
    supplierBalancePaid: supplierOrder?.supplierBalancePaid ?? false,
  });
}

export function shippedQuantity(state: PrototypeState, projectItemId: string) {
  return state.shipments.reduce(
    (sum, shipment) =>
      sum + (shipment.allocations.find((item) => item.projectItemId === projectItemId)?.quantity ?? 0),
    0,
  );
}

export function prototypeMissionProgress(state: PrototypeState) {
  const missions = [
    state.projectItems.some((item) => item.kind === "CUSTOM"),
    state.quotations.some((item) => item.status === "ACCEPTED"),
    Boolean(state.order && state.paymentSchedules.some((item) => item.type === "DEPOSIT" && item.status === "VERIFIED")),
    state.order?.lines.every((line) => dispatchGateForItem(state, line.projectItemId).allowed) ?? false,
    Boolean(state.claim?.status === "CLOSED" || state.shipments.some((item) => item.status === "DELIVERED")),
  ];
  return { missions, complete: missions.filter(Boolean).length, total: missions.length };
}

export function selectMemberCatalog(state: PrototypeState) {
  return state.catalog
    .filter((product) => product.lifecycleStatus === "PUBLISHED" && product.activeMemberPrice)
    .map((product) => ({
      id: product.id,
      sku: product.sku,
      nameTh: product.nameTh,
      nameEn: product.nameEn,
      kind: product.kind,
      category: product.category,
      memberUnitPrice: product.memberUnitPrice,
      currency: product.currency,
      leadTimeDays: product.leadTimeDays,
      specification: product.specification,
      lifecycleStatus: product.lifecycleStatus,
    }));
}

export function roleActionItems(state: PrototypeState) {
  return state.actionItems.filter((item) => item.role === state.activeRole);
}

export function uatSummary(state: PrototypeState) {
  const passed = state.uatResults.filter((item) => item.status === "PASS").length;
  const needsFix = state.uatResults.filter((item) => item.status === "NEEDS_FIX").length;
  return { passed, needsFix, untested: state.uatResults.length - passed - needsFix, total: state.uatResults.length };
}

export function mvpPreparationProgress(state: PrototypeState) {
  const missions = [
    state.memberApplication.status === "APPROVED",
    state.permissionCases.every((item) => item.result === "DENIED"),
    state.catalog.some((item) => item.id.startsWith("product-prototype") && item.lifecycleStatus === "PUBLISHED"),
    state.quotations.some((item) => item.status === "ACCEPTED"),
    state.paymentSchedules.some((item) => item.type === "DEPOSIT" && item.status === "VERIFIED"),
    state.qcInspections.some((item) => item.result === "PASSED"),
    state.shipments.some((item) => item.status === "DELIVERED"),
    state.buildReadiness === "APPROVED_FOR_MVP_BUILD",
  ];
  return { missions, complete: missions.filter(Boolean).length, total: missions.length };
}

function safeProduct(product: PrototypeProduct) {
  return {
    id: product.id,
    sku: product.sku,
    nameTh: product.nameTh,
    nameEn: product.nameEn,
    kind: product.kind,
    category: product.category,
    memberUnitPrice: product.memberUnitPrice,
    currency: product.currency,
    leadTimeDays: product.leadTimeDays,
    specification: product.specification,
    lifecycleStatus: product.lifecycleStatus,
    activeMemberPrice: product.activeMemberPrice,
    variants: product.variants,
    options: product.options,
    media: product.media,
  };
}

export function selectMemberSafeState(state: PrototypeState) {
  return {
    ...state,
    catalog: state.catalog
      .filter((product) => product.lifecycleStatus === "PUBLISHED" && product.activeMemberPrice)
      .map(safeProduct),
    suppliers: [],
    actionItems: state.actionItems.filter((item) => item.role === "MEMBER"),
    supplierOrders: state.supplierOrders.map((order) => ({
      id: order.id,
      number: order.number,
      supplierId: order.supplierId,
      itemIds: order.itemIds,
    })),
    productionUpdates: state.productionUpdates.map((update) => ({
      id: update.id,
      progress: update.progress,
      eta: update.eta,
      delayed: update.delayed,
    })),
  };
}
