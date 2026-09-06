import Decimal from "decimal.js";
import { evaluateDispatchGate } from "../lib/workflow";
import type {
  DemoDashboardSummary,
  DemoExecutiveSummary,
  DemoMemberView,
  DemoProduct,
  DemoState,
} from "./types";

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2).toFixed(2);
}

function toMemberProduct(
  product: DemoProduct,
): Omit<DemoProduct, "factoryUnitCost"> {
  return {
    id: product.id,
    sku: product.sku,
    nameTh: product.nameTh,
    nameEn: product.nameEn,
    kind: product.kind,
    supplierId: product.supplierId,
    category: product.category,
    memberUnitPrice: product.memberUnitPrice,
    currency: product.currency,
    leadTimeDays: product.leadTimeDays,
    specification: product.specification,
  };
}

export function getProjectItemsSubtotal(state: DemoState) {
  return money(
    state.dataset.projectItems.reduce((sum, item) => {
      if (item.memberUnitPriceSnapshot === null) return sum;
      return sum.add(
        new Decimal(item.memberUnitPriceSnapshot).mul(item.quantity),
      );
    }, new Decimal(0)),
  );
}

export function getDashboardSummary(
  state: DemoState,
): DemoDashboardSummary {
  const paymentActions = state.dataset.paymentSchedules.filter(
    (schedule) => schedule.status === "PENDING",
  ).length;
  const productionDelays = new Set(
    state.dataset.productionEvents
      .filter((event) => event.status === "DELAYED")
      .map((event) => event.supplierOrderId),
  ).size;
  const openClaims = state.dataset.claims.filter(
    (claim) => claim.status !== "CLOSED",
  ).length;
  const customApprovalActions = state.dataset.supplierOrders.filter(
    (order) => order.status === "WAITING_MEMBER_APPROVAL",
  ).length;
  const rfqActions = state.dataset.customRequests.filter(
    (request) => request.status === "SUBMITTED",
  ).length;

  return {
    projects: state.dataset.project ? 1 : 0,
    activeOrders: state.dataset.orders.filter(
      (order) => order.status !== "COMPLETED",
    ).length,
    paymentActions,
    productionDelays,
    shipmentsInTransit: state.dataset.shipments.filter(
      (shipment) => shipment.status === "IN_TRANSIT",
    ).length,
    deliveries: state.dataset.shipments.filter(
      (shipment) => shipment.status === "DELIVERED",
    ).length,
    openClaims,
    actionRequired:
      paymentActions + customApprovalActions + rfqActions + openClaims,
  };
}

export function getDispatchGateResults(state: DemoState) {
  const balanceVerified = state.dataset.paymentSchedules.some(
    (schedule) =>
      schedule.type === "BALANCE" && schedule.status === "VERIFIED",
  );

  return state.dataset.projectItems.map((item) => {
    const inspections = state.dataset.qcInspections
      .filter((inspection) => inspection.projectItemId === item.id)
      .sort((left, right) =>
        left.inspectedAt.localeCompare(right.inspectedAt),
      );
    const latestInspection = inspections.at(-1);
    const supplierOrder = state.dataset.supplierOrders.find((order) =>
      order.projectItemIds.includes(item.id),
    );
    const gate = evaluateDispatchGate({
      qcPassed: latestInspection?.result === "PASSED",
      isCustom: item.kind === "CUSTOM",
      memberApproved: item.memberApprovedAt !== null,
      customerBalanceVerified: balanceVerified,
      supplierBalancePaid: supplierOrder?.supplierBalancePaid ?? false,
    });

    return {
      projectItemId: item.id,
      ...gate,
    };
  });
}

export function getMemberView(state: DemoState): DemoMemberView {
  return {
    catalog: state.dataset.catalog.map(toMemberProduct),
    project: state.dataset.project,
    projectItems: state.dataset.projectItems,
    customRequests: state.dataset.customRequests,
    quotations: state.dataset.quotations,
    orders: state.dataset.orders,
    paymentSchedules: state.dataset.paymentSchedules,
    paymentTransfers: state.dataset.paymentTransfers,
    productionEvents: state.dataset.productionEvents,
    qcInspections: state.dataset.qcInspections.filter(
      (inspection) => inspection.memberVisible,
    ),
    shipments: state.dataset.shipments,
    claims: state.dataset.claims,
    documents: state.dataset.documents.filter(
      (document) => document.visibility === "MEMBER",
    ),
  };
}

export function getExecutiveSummary(
  state: DemoState,
): DemoExecutiveSummary {
  const orderSubtotal = state.dataset.orders.reduce(
    (sum, order) => sum.add(order.subtotal),
    new Decimal(0),
  );
  const factoryCost = state.dataset.supplierOrders.reduce(
    (sum, order) => sum.add(order.factoryCostTotal),
    new Decimal(0),
  );
  const margin = orderSubtotal.minus(factoryCost);
  const freightRevenue = state.dataset.paymentSchedules
    .filter((schedule) => schedule.type === "FREIGHT")
    .reduce(
      (sum, schedule) => sum.add(schedule.subtotalBeforeVat ?? 0),
      new Decimal(0),
    );
  const paymentVerified = state.dataset.paymentTransfers.reduce(
    (sum, transfer) => sum.add(transfer.amount),
    new Decimal(0),
  );

  return {
    grossSalesBeforeVat: money(orderSubtotal),
    factoryCost: money(factoryCost),
    grossProductMargin: money(margin),
    grossProductMarginPercent: orderSubtotal.isZero()
      ? "0.00"
      : margin.div(orderSubtotal).mul(100).toDecimalPlaces(2).toFixed(2),
    freightRevenueBeforeVat: money(freightRevenue),
    paymentVerified: money(paymentVerified),
  };
}
