import {
  demoBalanceTransfers,
  demoCatalog,
  demoClaim,
  demoCustomProjectItems,
  demoCustomRequest,
  demoDepositTransfers,
  demoDocuments,
  demoFreightMoney,
  demoOrganizations,
  demoOrder,
  demoPaymentSchedules,
  demoProductionEvents,
  demoProject,
  demoQcInspections,
  demoQuotations,
  demoShipments,
  demoStandardProjectItems,
  demoSupplierOrders,
  demoSuppliers,
  demoUsers,
} from "./fixtures";
import {
  demoSceneIds,
  type DemoDataset,
  type DemoRole,
  type DemoSceneDefinition,
  type DemoSceneId,
  type DemoState,
} from "./types";

export const demoScenes = [
  {
    id: "WELCOME",
    order: 0,
    title: "เริ่ม Demo และเลือกบทบาท",
    actorRole: "MEMBER",
    actionLabel: "เริ่มเรื่อง Riverstone",
    outcome: "ผู้ชมเห็นว่าเป็นข้อมูลจำลองและเลือกบทบาทได้",
  },
  {
    id: "PROJECT_CATALOG",
    order: 1,
    title: "สร้าง Project และเลือกสินค้ามาตรฐาน",
    actorRole: "MEMBER",
    actionLabel: "สร้าง Project และ Product Schedule",
    outcome: "Standard Product ที่มี Active Price พร้อมสั่งโดยไม่ผ่าน RFQ",
  },
  {
    id: "CUSTOM_RFQ",
    order: 2,
    title: "ส่ง Custom Request",
    actorRole: "MEMBER",
    actionLabel: "ส่งแบบ Reception Counter และ Headboard",
    outcome: "รายการ Custom รอ Quotation และไม่สามารถสั่งโดยตรง",
  },
  {
    id: "QUOTATION",
    order: 3,
    title: "แก้ Revision และ Accept Quotation",
    actorRole: "GISP_ADMIN",
    actionLabel: "ส่ง V2 และให้ Member Accept",
    outcome: "V1 เป็น SUPERSEDED และ V2 ล็อกราคา สเปก VAT และ Lead Time",
  },
  {
    id: "ORDER_DEPOSIT",
    order: 4,
    title: "สร้าง Order และยืนยันมัดจำ",
    actorRole: "FINANCE",
    actionLabel: "ตรวจยอดโอนสะสมและออก PO",
    outcome: "มัดจำสองรายการรวมครบ 481,500 บาทก่อนเปิด PO",
  },
  {
    id: "PRODUCTION_QC",
    order: 5,
    title: "ติดตามการผลิตและแก้ QC",
    actorRole: "QC",
    actionLabel: "บันทึก QC Fail, Rework และ Reinspection",
    outcome: "เห็น Delay 5 วันและ Custom QC ผ่านหลังแก้สี",
  },
  {
    id: "APPROVAL_BALANCE",
    order: 6,
    title: "Member Approval และ Balance",
    actorRole: "MEMBER",
    actionLabel: "อนุมัติ Custom และยืนยันยอดคงเหลือ",
    outcome: "Dispatch Gate ผ่านหลังครบทั้งสี่เงื่อนไข",
  },
  {
    id: "PARTIAL_SHIPMENT",
    order: 7,
    title: "สร้าง Partial Shipment",
    actorRole: "LOGISTICS",
    actionLabel: "ส่ง Standard ก่อนและ Custom ภายหลัง",
    outcome: "Order แสดง PARTIALLY_SHIPPED และมี Shipment สองเที่ยว",
  },
  {
    id: "DELIVERY_CLAIM",
    order: 8,
    title: "ส่งมอบพร้อมปัญหาและเปิด Claim",
    actorRole: "MEMBER",
    actionLabel: "ยืนยันรับพร้อมปัญหาและแนบหลักฐาน",
    outcome: "Claim เชื่อมกับ Lounge Chair ใน Shipment แรก",
  },
  {
    id: "EXECUTIVE_SUMMARY",
    order: 9,
    title: "ปิด Claim และดู Executive Summary",
    actorRole: "EXECUTIVE",
    actionLabel: "ยืนยันสินค้าทดแทนและปิดเรื่อง",
    outcome: "เห็นผล Order, Payment, Delay, Delivery และ Claim ครบวงจร",
  },
] satisfies DemoSceneDefinition[];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createEmptyDataset(): DemoDataset {
  return {
    organizations: clone(demoOrganizations),
    users: clone(demoUsers),
    suppliers: clone(demoSuppliers),
    catalog: clone(demoCatalog),
    project: null,
    projectItems: [],
    customRequests: [],
    quotations: [],
    orders: [],
    paymentSchedules: [],
    paymentTransfers: [],
    supplierOrders: [],
    productionEvents: [],
    qcInspections: [],
    shipments: [],
    claims: [],
    documents: [],
  };
}

function applyScene(dataset: DemoDataset, sceneId: DemoSceneId) {
  if (sceneId === "WELCOME") return;

  if (sceneId === "PROJECT_CATALOG") {
    dataset.project = clone(demoProject);
    dataset.projectItems = clone(demoStandardProjectItems);
    return;
  }

  if (sceneId === "CUSTOM_RFQ") {
    dataset.projectItems.push(...clone(demoCustomProjectItems));
    dataset.customRequests = [clone(demoCustomRequest)];
    return;
  }

  if (sceneId === "QUOTATION") {
    dataset.customRequests[0].status = "QUOTED";
    dataset.quotations = clone(demoQuotations);
    for (const item of dataset.projectItems.filter(
      (candidate) => candidate.kind === "CUSTOM",
    )) {
      const product = dataset.catalog.find(
        (candidate) => candidate.id === item.productId,
      );
      if (!product) throw new Error(`Missing demo product ${item.productId}`);
      item.memberUnitPriceSnapshot = product.memberUnitPrice;
      item.specificationSnapshot = product.specification;
      item.status = "READY_TO_ORDER";
      item.customQuotationId = "quotation-riverstone-v2";
    }
    return;
  }

  if (sceneId === "ORDER_DEPOSIT") {
    dataset.orders = [clone(demoOrder)];
    dataset.paymentSchedules = clone(demoPaymentSchedules);
    dataset.paymentTransfers = clone(demoDepositTransfers);
    dataset.supplierOrders = clone(demoSupplierOrders);
    for (const item of dataset.projectItems) item.status = "ORDERED";
    return;
  }

  if (sceneId === "PRODUCTION_QC") {
    dataset.orders[0].status = "IN_PRODUCTION";
    dataset.productionEvents = clone(demoProductionEvents);
    dataset.qcInspections = clone(demoQcInspections);
    for (const supplierOrder of dataset.supplierOrders) {
      supplierOrder.status =
        supplierOrder.id === "supplier-order-bespoke"
          ? "WAITING_MEMBER_APPROVAL"
          : "QC_PASSED";
    }
    return;
  }

  if (sceneId === "APPROVAL_BALANCE") {
    dataset.orders[0].status = "BALANCE_PAID";
    const balance = dataset.paymentSchedules.find(
      (schedule) => schedule.type === "BALANCE",
    );
    if (!balance) throw new Error("Missing demo balance schedule");
    balance.status = "VERIFIED";
    balance.verifiedAmount = balance.dueAmount;
    dataset.paymentTransfers.push(...clone(demoBalanceTransfers));
    for (const item of dataset.projectItems.filter(
      (candidate) => candidate.kind === "CUSTOM",
    )) {
      item.memberApprovedAt = "2026-10-26T04:00:00.000Z";
    }
    for (const supplierOrder of dataset.supplierOrders) {
      supplierOrder.supplierBalancePaid = true;
      supplierOrder.status = "READY_FOR_FACTORY_DISPATCH";
    }
    return;
  }

  if (sceneId === "PARTIAL_SHIPMENT") {
    dataset.orders[0].status = "PARTIALLY_SHIPPED";
    dataset.shipments = clone(demoShipments);
    for (const supplierOrder of dataset.supplierOrders) {
      supplierOrder.status = "SHIPPED";
    }
    return;
  }

  if (sceneId === "DELIVERY_CLAIM") {
    dataset.orders[0].status = "DELIVERED";
    for (const item of dataset.projectItems) item.status = "DELIVERED";
    for (const shipment of dataset.shipments) {
      shipment.status = "DELIVERED";
      shipment.deliveredAt =
        shipment.id === "shipment-standard"
          ? "2026-11-20T07:30:00.000Z"
          : "2026-11-28T07:30:00.000Z";
      shipment.deliveryResult =
        shipment.id === "shipment-standard"
          ? "DELIVERED_WITH_ISSUE"
          : "DELIVERED_COMPLETE";
    }
    dataset.claims = [clone(demoClaim)];
    dataset.paymentSchedules.push({
      id: "schedule-freight",
      orderId: demoOrder.id,
      type: "FREIGHT",
      dueAmount: demoFreightMoney.grandTotal,
      status: "PENDING",
      verifiedAmount: "0.00",
      subtotalBeforeVat: demoFreightMoney.subtotal,
      vatRate: demoFreightMoney.vatRate,
      vatAmount: demoFreightMoney.vatAmount,
    });
    return;
  }

  dataset.orders[0].status = "COMPLETED";
  if (dataset.project) dataset.project.status = "COMPLETED";
  const claim = dataset.claims[0];
  claim.status = "CLOSED";
  claim.resolution =
    "โรงงานผลิต Lounge Chair ทดแทน 1 ตัวและส่งถึงหน้างานเรียบร้อย";
  claim.memberConfirmedAt = "2026-12-06T04:00:00.000Z";
  const freight = dataset.paymentSchedules.find(
    (schedule) => schedule.type === "FREIGHT",
  );
  if (!freight) throw new Error("Missing demo freight schedule");
  freight.status = "VERIFIED";
  freight.verifiedAmount = freight.dueAmount;
  dataset.paymentTransfers.push({
    id: "transfer-freight",
    scheduleId: freight.id,
    reference: "PAY-2026-000005",
    amount: freight.dueAmount,
    submittedAt: "2026-12-02T03:00:00.000Z",
    status: "VERIFIED",
  });
}

function resolveSceneIndex(scene: DemoSceneId | number) {
  if (typeof scene === "number") {
    if (!Number.isInteger(scene) || scene < 0 || scene >= demoScenes.length) {
      throw new RangeError(`Invalid demo scene index: ${scene}`);
    }
    return scene;
  }
  const index = demoSceneIds.indexOf(scene);
  if (index === -1) throw new RangeError(`Invalid demo scene: ${scene}`);
  return index;
}

export function buildDemoState(
  scene: DemoSceneId | number = "WELCOME",
  activeRole: DemoRole = "MEMBER",
): DemoState {
  const sceneIndex = resolveSceneIndex(scene);
  const dataset = createEmptyDataset();

  for (let index = 0; index <= sceneIndex; index += 1) {
    applyScene(dataset, demoScenes[index].id);
  }

  dataset.documents = clone(
    demoDocuments.filter(
      (document) =>
        resolveSceneIndex(document.availableFromScene) <= sceneIndex,
    ),
  );

  return {
    sceneIndex,
    sceneId: demoScenes[sceneIndex].id,
    activeRole,
    dataset,
  };
}

export function advanceDemoState(state: DemoState) {
  const nextIndex = Math.min(state.sceneIndex + 1, demoScenes.length - 1);
  return buildDemoState(nextIndex, state.activeRole);
}

export function previousDemoState(state: DemoState) {
  const previousIndex = Math.max(state.sceneIndex - 1, 0);
  return buildDemoState(previousIndex, state.activeRole);
}

export function switchDemoRole(state: DemoState, role: DemoRole) {
  return buildDemoState(state.sceneIndex, role);
}

export function resetDemoState() {
  return buildDemoState("WELCOME", "MEMBER");
}
