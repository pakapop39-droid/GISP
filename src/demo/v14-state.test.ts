import { describe, expect, it } from "vitest";
import { createV14State } from "./v14-fixtures";
import { v14Reducer } from "./v14-reducer";
import { calculateFormulaPreview, hasActiveDisclosure, memberSafeSnapshot } from "./v14-selectors";
import type { V14Action, V14State } from "./v14-types";

type WithoutAt<T> = T extends unknown ? Omit<T, "at"> : never;

const run = (state: V14State, action: WithoutAt<V14Action>) =>
  v14Reducer(state, { ...action, at: "2026-08-01T10:00:00.000Z" } as V14Action);

describe("Demo 1.4 contracts", () => {
  it("calculates the approved 100 → 125 → 156.25 formula", () => {
    const state = createV14State();
    const result = calculateFormulaPreview("100", state.formulas[0].components, state.formulas[0].id);
    expect(result).toMatchObject({ memberPrice: "125.00", suggestedResalePrice: "156.25", freightEstimateLow: "15.00", freightEstimateHigh: "20.00" });
  });

  it("allows only Super Admin to change formulas and internal roles", () => {
    let state = createV14State();
    state = run(state, { type: "OVERRIDE_FORMULA_COMPONENT", formulaId: "formula-supplier-draft", componentCode: "platform", value: "6.00" });
    expect(state.lastError).toContain("Super Admin");
    state = run(state, { type: "SET_ADMIN_ROLE", role: "SUPER_ADMIN" });
    state = run(state, { type: "OVERRIDE_FORMULA_COMPONENT", formulaId: "formula-supplier-draft", componentCode: "platform", value: "6.00" });
    expect(state.formulas[1].components.find((item) => item.code === "platform")?.inherited).toBe(false);
  });

  it("creates and revokes a disclosure only after an approved visit", () => {
    let state = createV14State();
    state.workflow.memberApplication.status = "APPROVED";
    state = run(state, { type: "SUBMIT_VISIT", sampleId: "sample-sand-fabric", preferredDate: "2026-09-15" });
    state = run(state, { type: "APPROVE_VISIT", visitId: "visit-1", instruction: "พบทีม GISP ที่จุดนัดหมาย Foshan" });
    state = run(state, { type: "COMPLETE_VISIT", visitId: "visit-1" });
    expect(hasActiveDisclosure(state, "member-profile-atelier-nara", "supplier-foshan-seating")).toBe(true);
    state = run(state, { type: "SET_ADMIN_ROLE", role: "SUPER_ADMIN" });
    state = run(state, { type: "REVOKE_DISCLOSURE", grantId: "grant-1", reason: "ยุติสิทธิ์ตามคำขอ" });
    expect(hasActiveDisclosure(state, "member-profile-atelier-nara", "supplier-foshan-seating")).toBe(false);
  });

  it("serializes a member view without internal pricing or supplier ids", () => {
    const safe = JSON.stringify(memberSafeSnapshot(createV14State()));
    expect(safe).not.toContain("factoryUnitCost");
    expect(safe).not.toContain("formula-global");
    expect(safe).not.toContain("supplierId");
    expect(safe).not.toContain("internalNote");
    expect(safe).toContain("suggestedResalePrice");
  });

  it("never stores a member password or member sub-user action", () => {
    const raw = JSON.stringify(createV14State());
    expect(raw.toLowerCase()).not.toContain("password");
    expect(raw).not.toContain("INVITE_ORGANIZATION_USER");
  });

  it("requires an approved member before suspend and records a reason", () => {
    let state = createV14State();
    state = run(state, { type: "SET_MEMBER_ACCESS_STATUS", decision: "SUSPEND", reason: "ตรวจสอบบัญชี" });
    expect(state.workflow.memberApplication.status).toBe("NOT_STARTED");
    state = run(state, { type: "RUN_WORKFLOW", actor: "MEMBER", action: { type: "REGISTER_DEMO_ACCOUNT", email: "nara@atelier-demo.example" } });
    state = run(state, { type: "RUN_WORKFLOW", actor: "MEMBER", action: { type: "SUBMIT_MEMBER_APPLICATION", companyName: "Atelier Nara", taxId: "0105569000001" } });
    state = run(state, { type: "RUN_WORKFLOW", actor: "GISP_ADMIN", action: { type: "REVIEW_MEMBER_APPLICATION", decision: "APPROVE", note: "ผ่าน" } });
    state = run(state, { type: "SET_MEMBER_ACCESS_STATUS", decision: "SUSPEND", reason: "ตรวจสอบบัญชี" });
    expect(state.workflow.memberApplication.status).toBe("SUSPENDED");
    expect(state.audit.at(-1)?.reason).toBe("ตรวจสอบบัญชี");
  });
});
