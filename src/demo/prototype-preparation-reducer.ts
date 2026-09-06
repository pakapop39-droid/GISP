import Decimal from "decimal.js";
import type { DemoRole } from "./types";
import type { PrototypeAction, PrototypeState } from "./prototype-types";

const preparationActions = new Set<PrototypeAction["type"]>([
  "REGISTER_DEMO_ACCOUNT",
  "SUBMIT_MEMBER_APPLICATION",
  "REVIEW_MEMBER_APPLICATION",
  "INVITE_ORGANIZATION_USER",
  "SET_ORGANIZATION_USER_ROLES",
  "RUN_PERMISSION_CASE",
  "CREATE_SUPPLIER",
  "CREATE_PRODUCT_DRAFT",
  "UPDATE_PRODUCT_MASTER",
  "PUBLISH_PRODUCT",
  "DISCONTINUE_PRODUCT",
  "COMPLETE_ACTION_ITEM",
  "UPDATE_UAT_RESULT",
  "SIGN_OFF_UAT",
  "EXPIRE_QUOTATION",
  "CORRECT_QC",
  "REJECT_CLAIM",
]);

function fail(state: PrototypeState, message: string): PrototypeState {
  return { ...state, lastError: message };
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

function hasRole(state: PrototypeState, roles: DemoRole[]) {
  return roles.includes(state.activeRole);
}

export function reducePreparationAction(
  state: PrototypeState,
  action: PrototypeAction,
): PrototypeState | null {
  if (!preparationActions.has(action.type)) return null;

  if (action.type === "REGISTER_DEMO_ACCOUNT") {
    if (!hasRole(state, ["MEMBER"])) return fail(state, "ใช้บทบาท Member เพื่อสมัครบัญชีจำลอง");
    if (!action.email.includes("@")) return fail(state, "กรุณาใช้อีเมลจำลองที่ถูกต้อง");
    return success(
      { ...state, memberApplication: { ...state.memberApplication, email: action.email, registered: true } },
      action,
      `สมัครบัญชี Demo ด้วย ${action.email} โดยไม่บันทึกรหัสผ่าน`,
    );
  }

  if (action.type === "SUBMIT_MEMBER_APPLICATION") {
    if (!hasRole(state, ["MEMBER"]) || !state.memberApplication.registered) {
      return fail(state, "ต้องสมัครบัญชี Demo ก่อนส่งข้อมูลบริษัท");
    }
    if (!action.companyName.trim() || action.taxId.trim().length < 10) {
      return fail(state, "กรุณากรอกชื่อบริษัทและเลขประจำตัวผู้เสียภาษีจำลอง");
    }
    return success(
      {
        ...state,
        memberApplication: {
          ...state.memberApplication,
          companyName: action.companyName,
          taxId: action.taxId,
          status: "PENDING",
          reviewNote: null,
        },
        actionItems: state.actionItems.map((item) =>
          item.id === "action-member-foundation" ? { ...item, status: "DONE" } : item,
        ),
      },
      action,
      "ส่งข้อมูลบริษัทเพื่อรอ Admin อนุมัติ",
    );
  }

  if (action.type === "REVIEW_MEMBER_APPLICATION") {
    if (!hasRole(state, ["GISP_ADMIN"]) || state.memberApplication.status !== "PENDING") {
      return fail(state, "Admin ตรวจได้เฉพาะคำขอที่กำลังรออนุมัติ");
    }
    if (action.decision === "REJECT" && !action.note.trim()) {
      return fail(state, "การปฏิเสธสมาชิกต้องระบุเหตุผล");
    }
    const approved = action.decision === "APPROVE";
    return success(
      {
        ...state,
        memberApplication: {
          ...state.memberApplication,
          status: approved ? "APPROVED" : "REJECTED",
          reviewNote: action.note || "ตรวจข้อมูลบริษัทครบถ้วน",
        },
        actionItems: state.actionItems.map((item) =>
          item.id === "action-admin-member" ? { ...item, status: "DONE" } : item,
        ),
      },
      action,
      approved ? "Admin อนุมัติบริษัทและเปิดสิทธิ์ใช้งาน" : `Admin ปฏิเสธคำขอ: ${action.note}`,
    );
  }

  if (action.type === "INVITE_ORGANIZATION_USER") {
    if (!hasRole(state, ["GISP_ADMIN"]) || state.memberApplication.status !== "APPROVED") {
      return fail(state, "ต้องอนุมัติบริษัทและใช้บทบาท Admin ก่อนเชิญผู้ใช้");
    }
    if (!action.email.includes("@") || !action.fullName.trim()) return fail(state, "กรุณากรอกชื่อและอีเมลจำลอง");
    if (state.organizationUsers.some((user) => user.email === action.email)) return fail(state, "อีเมลนี้ถูกเชิญแล้ว");
    const user = {
      id: `org-user-${state.organizationUsers.length + 1}`,
      email: action.email,
      fullName: action.fullName,
      organizationId: "org-member-atelier-nara",
      roles: ["MEMBER" as const],
      status: "INVITED" as const,
    };
    return success({ ...state, organizationUsers: [...state.organizationUsers, user] }, action, `เชิญ ${action.fullName} เข้าบริษัท`);
  }

  if (action.type === "SET_ORGANIZATION_USER_ROLES") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึงกำหนด Role ได้");
    if (!action.roles.length) return fail(state, "ผู้ใช้ต้องมีอย่างน้อยหนึ่ง Role");
    if (!state.organizationUsers.some((user) => user.id === action.userId)) return fail(state, "ไม่พบผู้ใช้ในบริษัท");
    return success(
      { ...state, organizationUsers: state.organizationUsers.map((user) => user.id === action.userId ? { ...user, roles: action.roles } : user) },
      action,
      `กำหนด ${action.roles.length} Role ให้ผู้ใช้`,
    );
  }

  if (action.type === "RUN_PERMISSION_CASE") {
    const permissionCase = state.permissionCases.find((item) => item.id === action.caseId);
    if (!permissionCase) return fail(state, "ไม่พบ Permission Test Case");
    return success(
      {
        ...state,
        permissionCases: state.permissionCases.map((item) =>
          item.id === action.caseId ? { ...item, result: "DENIED" } : item,
        ),
      },
      action,
      `ปฏิเสธการเข้าถึง: ${permissionCase.label}`,
    );
  }

  if (action.type === "CREATE_SUPPLIER") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึงสร้าง Supplier ได้");
    if (!action.name.trim() || !action.city.trim()) return fail(state, "กรุณาระบุชื่อและเมืองของ Supplier");
    const supplier = {
      id: `supplier-prototype-${state.suppliers.length + 1}`,
      code: `SUP-CN-${String(state.suppliers.length + 1).padStart(3, "0")}`,
      name: action.name,
      city: action.city,
      country: "China" as const,
      internalNote: "Supplier Draft สำหรับ Demo เท่านั้น",
      status: "ACTIVE" as const,
      contactName: action.contactName,
      documents: action.files,
    };
    return success({ ...state, suppliers: [...state.suppliers, supplier] }, action, `สร้าง Supplier ${supplier.name}`);
  }

  if (action.type === "CREATE_PRODUCT_DRAFT") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึงสร้าง Product Draft ได้");
    if (!state.suppliers.some((supplier) => supplier.id === action.supplierId && supplier.status === "ACTIVE")) {
      return fail(state, "Product ต้องผูกกับ Supplier ที่ Active");
    }
    if (!action.nameTh.trim() || !action.sku.trim()) return fail(state, "กรุณาระบุชื่อสินค้าและ SKU");
    if (state.catalog.some((product) => product.sku === action.sku)) return fail(state, "SKU นี้มีอยู่แล้ว");
    const product = {
      id: `product-prototype-${state.catalog.length + 1}`,
      sku: action.sku,
      nameTh: action.nameTh,
      nameEn: "Demo Product Draft",
      kind: "STANDARD" as const,
      supplierId: action.supplierId,
      category: "Seating",
      memberUnitPrice: action.memberUnitPrice || "0.00",
      factoryUnitCost: action.factoryUnitCost || "0.00",
      currency: "THB" as const,
      leadTimeDays: 45,
      specification: "สเปกจำลองสำหรับตรวจ Product Master",
      lifecycleStatus: "DRAFT" as const,
      activeMemberPrice: new Decimal(action.memberUnitPrice || 0).greaterThan(0),
      variants: ["Default"],
      options: ["Ivory"],
      media: [],
      confidentialFiles: [],
      internalNote: "ต้นทุนและข้อมูลโรงงานสำหรับทีม GISP เท่านั้น",
    };
    return success({ ...state, catalog: [...state.catalog, product] }, action, `สร้าง ${product.sku} เป็น Draft`);
  }

  if (action.type === "UPDATE_PRODUCT_MASTER") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึงแก้ Product Master ได้");
    if (!state.catalog.some((product) => product.id === action.productId)) return fail(state, "ไม่พบสินค้า");
    return success(
      {
        ...state,
        catalog: state.catalog.map((product) => product.id === action.productId ? {
          ...product,
          memberUnitPrice: action.memberUnitPrice ?? product.memberUnitPrice,
          factoryUnitCost: action.factoryUnitCost ?? product.factoryUnitCost,
          activeMemberPrice: action.activeMemberPrice ?? product.activeMemberPrice,
          variants: action.variants ?? product.variants,
          options: action.options ?? product.options,
          media: action.media ?? product.media,
          confidentialFiles: action.confidentialFiles ?? product.confidentialFiles,
        } : product),
      },
      action,
      "แก้ Product Master โดยไม่เปลี่ยน Snapshot ในเอกสารเดิม",
    );
  }

  if (action.type === "PUBLISH_PRODUCT") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึง Publish สินค้าได้");
    const product = state.catalog.find((item) => item.id === action.productId);
    if (!product || product.lifecycleStatus !== "DRAFT") return fail(state, "Publish ได้เฉพาะ Product Draft");
    if (!product.activeMemberPrice || new Decimal(product.memberUnitPrice).lessThanOrEqualTo(0)) {
      return fail(state, "ต้องมี Active Member Price มากกว่า 0 ก่อน Publish");
    }
    return success(
      {
        ...state,
        catalog: state.catalog.map((item) => item.id === product.id ? { ...item, lifecycleStatus: "PUBLISHED" } : item),
        actionItems: state.actionItems.map((item) => item.id === "action-admin-product" ? { ...item, status: "DONE" } : item),
      },
      action,
      `Publish ${product.sku} ให้ Member เห็น`,
    );
  }

  if (action.type === "DISCONTINUE_PRODUCT") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึง Discontinue สินค้าได้");
    const product = state.catalog.find((item) => item.id === action.productId);
    if (!product || product.lifecycleStatus !== "PUBLISHED") return fail(state, "Discontinue ได้เฉพาะสินค้าที่ Published");
    return success(
      { ...state, catalog: state.catalog.map((item) => item.id === product.id ? { ...item, lifecycleStatus: "DISCONTINUED", activeMemberPrice: false } : item) },
      action,
      `Discontinue ${product.sku}; Snapshot เดิมยังคงอยู่`,
    );
  }

  if (action.type === "COMPLETE_ACTION_ITEM") {
    const item = state.actionItems.find((entry) => entry.id === action.actionItemId);
    if (!item || (item.role !== state.activeRole && state.activeRole !== "GISP_ADMIN")) {
      return fail(state, "บทบาทนี้ปิด Action Required รายการนี้ไม่ได้");
    }
    return success(
      { ...state, actionItems: state.actionItems.map((entry) => entry.id === item.id ? { ...entry, status: "DONE" } : entry) },
      action,
      `ปิด Action Required: ${item.title}`,
    );
  }

  if (action.type === "UPDATE_UAT_RESULT") {
    if (!state.uatResults.some((item) => item.id === action.resultId)) return fail(state, "ไม่พบ UAT Scenario");
    return success(
      { ...state, uatResults: state.uatResults.map((item) => item.id === action.resultId ? { ...item, status: action.status, note: action.note } : item), buildReadiness: "IN_UAT" },
      action,
      `บันทึก UAT เป็น ${action.status}`,
    );
  }

  if (action.type === "SIGN_OFF_UAT") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึง Sign-off UAT ได้");
    if (!state.uatResults.every((item) => item.status === "PASS")) {
      return fail(state, "ยัง Sign-off ไม่ได้: UAT ทั้ง 8 Scenario ต้องผ่านทั้งหมด");
    }
    return success({ ...state, buildReadiness: "APPROVED_FOR_MVP_BUILD" }, action, "UAT ผ่านครบและอนุมัติให้เตรียมเริ่ม MVP Build");
  }

  if (action.type === "EXPIRE_QUOTATION") {
    if (!hasRole(state, ["GISP_ADMIN"])) return fail(state, "เฉพาะ Admin จึงจำลอง Quotation หมดอายุได้");
    const quotation = state.quotations.find((item) => item.id === action.quotationId);
    if (!quotation || quotation.status !== "SENT") return fail(state, "ทำหมดอายุได้เฉพาะใบเสนอราคา Active");
    return success(
      { ...state, quotations: state.quotations.map((item) => item.id === quotation.id ? { ...item, status: "EXPIRED" } : item) },
      action,
      `Quotation Version ${quotation.version} หมดอายุและต้องออก Revision`,
    );
  }

  if (action.type === "CORRECT_QC") {
    if (!hasRole(state, ["QC"])) return fail(state, "เฉพาะ QC จึงเพิ่ม Correction Event ได้");
    const inspection = state.qcInspections.find((item) => item.id === action.inspectionId);
    if (!inspection || inspection.result !== "PASSED") return fail(state, "Correction ใช้ได้กับผลตรวจที่ Passed แล้วเท่านั้น");
    if (!action.note.trim()) return fail(state, "Correction ต้องมีเหตุผล");
    const correction = {
      id: `qc-${state.qcInspections.length + 1}`,
      projectItemId: inspection.projectItemId,
      result: "REWORK_REQUIRED" as const,
      note: action.note,
      correctionOfId: inspection.id,
    };
    return success({ ...state, qcInspections: [...state.qcInspections, correction] }, action, `เพิ่ม Correction Event แทนการแก้ผล ${inspection.id}`);
  }

  if (action.type === "REJECT_CLAIM") {
    if (!hasRole(state, ["GISP_ADMIN"]) || state.claim?.status !== "SUBMITTED") {
      return fail(state, "Admin ปฏิเสธได้เฉพาะ Claim ที่รอตรวจ");
    }
    if (!action.reason.trim()) return fail(state, "การปฏิเสธ Claim ต้องระบุเหตุผล");
    return success({ ...state, claim: { ...state.claim, status: "REJECTED", resolution: action.reason } }, action, `ปฏิเสธ Claim: ${action.reason}`);
  }

  return state;
}

