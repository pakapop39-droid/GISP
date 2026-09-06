import Decimal from "decimal.js";
import { createV14State } from "./v14-fixtures";
import { prototypeReducer } from "./prototype-reducer";
import { calculateFormulaPreview } from "./v14-selectors";
import type { DemoRole } from "./types";
import type { AdminDemoRole, V14Action, V14State } from "./v14-types";

function actorForAdmin(role: AdminDemoRole): DemoRole {
  if (role === "SUPER_ADMIN") return "GISP_ADMIN";
  return role;
}

function fail(state: V14State, message: string): V14State {
  return { ...state, lastError: message };
}

function success(
  state: V14State,
  action: V14Action,
  actor: "MEMBER" | AdminDemoRole,
  detail: string,
  extra?: Pick<V14State["audit"][number], "before" | "after" | "reason">,
): V14State {
  return {
    ...state,
    lastError: null,
    revision: state.revision + 1,
    audit: [...state.audit, { id: `v14-audit-${state.audit.length + 1}`, at: action.at, actor, action: action.type, detail, ...extra }],
  };
}

export function v14Reducer(state: V14State, action: V14Action): V14State {
  if (action.type === "HYDRATE_V14") return action.state.schemaVersion === 4 ? action.state : state;
  if (action.type === "RESET_V14") return createV14State();
  if (action.type === "SET_ADMIN_ROLE") {
    return success({ ...state, activeAdminRole: action.role }, action, action.role, `เปิด Back Office ในบทบาท ${action.role}`);
  }

  if (action.type === "SET_MEMBER_ACCESS_STATUS") {
    if (!(state.activeAdminRole === "GISP_ADMIN" || state.activeAdminRole === "SUPER_ADMIN")) return fail(state, "เฉพาะ GISP Admin จึงจัดการสถานะการใช้งานของ Member ได้");
    if (!action.reason.trim()) return fail(state, "การ Suspend หรือ Reactivate ต้องระบุเหตุผล");
    const current = state.workflow.memberApplication.status;
    if (action.decision === "SUSPEND" && current !== "APPROVED") return fail(state, "Suspend ได้เฉพาะ Member ที่ Approved");
    if (action.decision === "REACTIVATE" && current !== "SUSPENDED") return fail(state, "Reactivate ได้เฉพาะ Member ที่ Suspended");
    const next = action.decision === "SUSPEND" ? "SUSPENDED" as const : "APPROVED" as const;
    return success(
      { ...state, workflow: { ...state.workflow, memberApplication: { ...state.workflow.memberApplication, status: next, reviewNote: action.reason } } },
      action,
      state.activeAdminRole,
      `${action.decision} Member Profile`,
      { before: current, after: next, reason: action.reason },
    );
  }

  if (action.type === "RUN_WORKFLOW") {
    if (["HYDRATE", "RESET_PROTOTYPE", "SWITCH_ROLE", "SET_MODULE"].includes(action.action.type)) {
      return fail(state, "Demo 1.4 จัดการ Route และ Role แยกจาก Version 1.3");
    }
    const currentActor = action.actor;
    const prepared = { ...state.workflow, activeRole: currentActor };
    const workflowAction = { ...action.action, at: action.at } as Parameters<typeof prototypeReducer>[1];
    const nextWorkflow = prototypeReducer(prepared, workflowAction);
    const failed = Boolean(nextWorkflow.lastError);
    const nextState = { ...state, workflow: { ...nextWorkflow, activeRole: state.workflow.activeRole }, lastError: nextWorkflow.lastError };
    if (failed) return nextState;
    return success(nextState, action, currentActor, `ส่ง Action ${action.action.type} ผ่าน Workflow Guard`);
  }

  if (action.type === "INVITE_INTERNAL_USER") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึงเชิญทีมงาน GISP ได้");
    if (!action.fullName.trim() || !action.email.includes("@")) return fail(state, "กรุณากรอกชื่อและอีเมลทีมงานจำลอง");
    if (state.internalUsers.some((user) => user.email === action.email)) return fail(state, "อีเมลนี้อยู่ในทีม GISP แล้ว");
    const user = { id: `staff-${state.internalUsers.length + 1}`, fullName: action.fullName, email: action.email, roles: ["PRODUCT_ADMIN" as const], status: "INVITED" as const };
    return success({ ...state, internalUsers: [...state.internalUsers, user] }, action, "SUPER_ADMIN", `เชิญ ${user.fullName} เข้าทีม GISP`);
  }

  if (action.type === "SET_INTERNAL_ROLES") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึงกำหนด Multi-role ได้");
    if (!action.roles.length || action.roles.some((role) => String(role) === "MEMBER")) return fail(state, "ทีม GISP ต้องมี Internal Role อย่างน้อยหนึ่ง Role และห้ามใช้ MEMBER");
    const target = state.internalUsers.find((user) => user.id === action.userId);
    if (!target) return fail(state, "ไม่พบทีมงาน GISP");
    return success(
      { ...state, internalUsers: state.internalUsers.map((user) => user.id === target.id ? { ...user, roles: action.roles, status: "ACTIVE" } : user) },
      action,
      "SUPER_ADMIN",
      `กำหนด ${action.roles.join(" + ")} ให้ ${target.fullName}`,
      { before: target.roles.join(","), after: action.roles.join(",") },
    );
  }

  if (action.type === "SET_INTERNAL_USER_STATUS") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึงเปลี่ยนสถานะทีมงานได้");
    const target = state.internalUsers.find((user) => user.id === action.userId);
    if (!target || !action.reason.trim()) return fail(state, "ต้องเลือกผู้ใช้และระบุเหตุผล");
    const activeSuperAdmins = state.internalUsers.filter((user) => user.status === "ACTIVE" && user.roles.includes("SUPER_ADMIN"));
    if (target.roles.includes("SUPER_ADMIN") && action.status === "SUSPENDED" && activeSuperAdmins.length === 1) return fail(state, "ห้ามระงับ Super Admin คนสุดท้าย");
    return success(
      { ...state, internalUsers: state.internalUsers.map((user) => user.id === target.id ? { ...user, status: action.status } : user) },
      action,
      "SUPER_ADMIN",
      `เปลี่ยนสถานะ ${target.fullName} เป็น ${action.status}`,
      { before: target.status, after: action.status, reason: action.reason },
    );
  }

  if (action.type === "OVERRIDE_FORMULA_COMPONENT") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึงแก้ Formula Component ได้");
    if (!new Decimal(action.value || 0).isPositive()) return fail(state, "ค่า Formula ต้องมากกว่า 0");
    const formula = state.formulas.find((item) => item.id === action.formulaId);
    if (!formula || formula.status !== "DRAFT") return fail(state, "แก้ได้เฉพาะ Formula Draft");
    const components = formula.components.map((component) => component.code === action.componentCode ? { ...component, value: action.value, inherited: false } : component);
    const formulas = state.formulas.map((item) => item.id === formula.id ? { ...item, components } : item);
    return success({ ...state, formulas }, action, "SUPER_ADMIN", `Override ${action.componentCode} เป็น ${action.value}`);
  }

  if (action.type === "PREVIEW_FORMULA") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึง Preview Formula ได้");
    const formula = state.formulas.find((item) => item.id === action.formulaId);
    if (!formula || !new Decimal(action.factoryCostThb || 0).isPositive()) return fail(state, "เลือก Formula และระบุต้นทุนที่มากกว่า 0");
    return success({ ...state, formulaPreview: calculateFormulaPreview(action.factoryCostThb, formula.components, formula.id) }, action, "SUPER_ADMIN", `Preview ${formula.code} จากทุน ${action.factoryCostThb}`);
  }

  if (action.type === "ACTIVATE_FORMULA" || action.type === "RETIRE_FORMULA") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึง Activate หรือ Retire Formula ได้");
    const target = state.formulas.find((item) => item.id === action.formulaId);
    if (!target || (action.type === "ACTIVATE_FORMULA" && target.status !== "DRAFT") || (action.type === "RETIRE_FORMULA" && target.status !== "ACTIVE")) return fail(state, "Formula ไม่อยู่ในสถานะที่เปลี่ยนได้");
    const nextStatus = action.type === "ACTIVATE_FORMULA" ? "ACTIVE" as const : "RETIRED" as const;
    const formulas = state.formulas.map((item) => item.id === target.id ? { ...item, status: nextStatus } : item);
    return success({ ...state, formulas, activeFormulaId: nextStatus === "ACTIVE" ? target.id : state.activeFormulaId }, action, "SUPER_ADMIN", `${action.type === "ACTIVATE_FORMULA" ? "Activate" : "Retire"} ${target.code}`, { before: target.status, after: nextStatus });
  }

  if (action.type === "SUBMIT_VISIT") {
    if (state.workflow.memberApplication.status !== "APPROVED") return fail(state, "Member ต้อง Active ก่อนส่งคำขอเยี่ยมชม");
    const sample = state.samples.find((item) => item.id === action.sampleId);
    if (!sample) return fail(state, "ไม่พบ Material Sample");
    if (state.visits.some((visit) => visit.sampleId === sample.id && !["REJECTED", "CANCELLED"].includes(visit.status))) return fail(state, "มีคำขอเยี่ยมชมรายการนี้อยู่แล้ว");
    const visit = { id: `visit-${state.visits.length + 1}`, memberProfileId: "member-profile-atelier-nara", supplierId: sample.supplierId, sampleId: sample.id, projectId: state.workflow.project.id, preferredDate: action.preferredDate, status: "SUBMITTED" as const, meetingInstruction: null, decisionReason: null };
    return success({ ...state, visits: [...state.visits, visit] }, action, "MEMBER", `ส่งคำขอเยี่ยมชม ${sample.memberDisplayLabel}`);
  }

  if (["APPROVE_VISIT", "COMPLETE_VISIT", "REJECT_VISIT", "CANCEL_VISIT"].includes(action.type)) {
    const typed = action as Extract<V14Action, { type: "APPROVE_VISIT" | "COMPLETE_VISIT" | "REJECT_VISIT" | "CANCEL_VISIT" }>;
    const visit = state.visits.find((item) => item.id === typed.visitId);
    if (!visit) return fail(state, "ไม่พบคำขอเยี่ยมชม");
    if (action.type === "CANCEL_VISIT") {
      if (!["SUBMITTED", "APPROVED"].includes(visit.status) || !action.reason.trim()) return fail(state, "Member ยกเลิกได้ก่อน Completed และต้องระบุเหตุผล");
      return success({ ...state, visits: state.visits.map((item) => item.id === visit.id ? { ...item, status: "CANCELLED", decisionReason: action.reason } : item) }, action, "MEMBER", "ยกเลิก Visit", { reason: action.reason });
    }
    if (!["GISP_ADMIN", "SUPER_ADMIN"].includes(state.activeAdminRole)) return fail(state, "เฉพาะ GISP Admin หรือ Super Admin จึงจัดการ Visit ได้");
    if (action.type === "APPROVE_VISIT") {
      if (visit.status !== "SUBMITTED" || !action.instruction.trim()) return fail(state, "Approve ได้จาก Submitted และต้องมี Meeting Instruction แบบไม่เปิดเผยโรงงาน");
      return success({ ...state, visits: state.visits.map((item) => item.id === visit.id ? { ...item, status: "APPROVED", meetingInstruction: action.instruction } : item) }, action, state.activeAdminRole, "Approve Visit โดยยัง Redact โรงงาน");
    }
    if (action.type === "REJECT_VISIT") {
      if (visit.status !== "SUBMITTED" || !action.reason.trim()) return fail(state, "Reject ได้จาก Submitted และต้องมีเหตุผล");
      return success({ ...state, visits: state.visits.map((item) => item.id === visit.id ? { ...item, status: "REJECTED", decisionReason: action.reason } : item) }, action, state.activeAdminRole, "Reject Visit", { reason: action.reason });
    }
    if (visit.status !== "APPROVED") return fail(state, "Visit ต้อง Approved ก่อน Complete");
    const grant = { id: `grant-${state.disclosureGrants.length + 1}`, memberProfileId: visit.memberProfileId, supplierId: visit.supplierId, sourceVisitId: visit.id, grantedAt: action.at, revokedAt: null, revocationReason: null };
    return success({ ...state, visits: state.visits.map((item) => item.id === visit.id ? { ...item, status: "COMPLETED" } : item), disclosureGrants: [...state.disclosureGrants, grant] }, action, state.activeAdminRole, "Complete Visit และสร้าง Disclosure Grant ใน Action เดียว");
  }

  if (action.type === "REVOKE_DISCLOSURE") {
    if (state.activeAdminRole !== "SUPER_ADMIN") return fail(state, "เฉพาะ Super Admin จึง Revoke Disclosure ได้");
    const grant = state.disclosureGrants.find((item) => item.id === action.grantId);
    if (!grant || grant.revokedAt || !action.reason.trim()) return fail(state, "เลือก Active Grant และระบุเหตุผล");
    return success({ ...state, disclosureGrants: state.disclosureGrants.map((item) => item.id === grant.id ? { ...item, revokedAt: action.at, revocationReason: action.reason } : item) }, action, "SUPER_ADMIN", "Revoke Supplier Disclosure และกลับเป็น Redacted", { reason: action.reason });
  }

  if (action.type === "CONFIRM_CLAIM_RESPONSIBILITY") {
    if (!(["GISP_ADMIN", "SUPER_ADMIN"] as AdminDemoRole[]).includes(state.activeAdminRole)) return fail(state, "เฉพาะ Order Admin Persona จึงยืนยันผู้รับผิดชอบได้");
    if (!state.workflow.claim) return fail(state, "ต้องมี Claim ก่อนยืนยันผู้รับผิดชอบ");
    return success({ ...state, confirmedResponsibility: action.responsibility, responsibilityConfirmedBy: "กิตติพงษ์ จัดซื้อ" }, action, state.activeAdminRole, `Order Admin ยืนยัน ${action.responsibility} โดยไม่อนุมัติค่าชดเชยอัตโนมัติ`);
  }

  if (action.type === "UPDATE_V14_UAT") {
    const result = state.uatResults.find((item) => item.id === action.resultId);
    if (!result) return fail(state, "ไม่พบ UAT Scenario");
    return success({ ...state, uatResults: state.uatResults.map((item) => item.id === result.id ? { ...item, status: action.status, note: action.note } : item), buildReadiness: "PENDING_DEMO_1_4_UAT" }, action, state.activeAdminRole, `บันทึก UAT ${result.title}: ${action.status}`);
  }

  if (action.type === "SIGN_OFF_V14") {
    if (state.activeAdminRole !== "GISP_ADMIN") return fail(state, "GISP Admin เท่านั้นที่ Sign-off Demo Gate");
    if (!state.uatResults.every((item) => item.status === "PASS")) return fail(state, "UAT ทั้ง 8 หมวดต้อง PASS และไม่มี NEEDS FIX");
    return success({ ...state, buildReadiness: "APPROVED_FOR_MVP_BUILD" }, action, "GISP_ADMIN", "Human Sign-off Demo Application 1.4 ครบ 8/8");
  }

  return state;
}

export { actorForAdmin };
