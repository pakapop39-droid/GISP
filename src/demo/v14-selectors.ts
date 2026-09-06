import Decimal from "decimal.js";
import { money } from "./prototype-selectors";
import type { FormulaComponent, FormulaPreview, V14State } from "./v14-types";

function amount(base: Decimal, component: FormulaComponent) {
  return component.calculationType === "FIXED_AMOUNT_THB"
    ? new Decimal(component.value)
    : base.mul(component.value).div(100);
}

export function calculateFormulaPreview(factoryCost: string, components: FormulaComponent[], formulaId: string): FormulaPreview {
  const cost = new Decimal(factoryCost || 0);
  const memberComponents = components.filter((item) => item.includeInMemberPrice);
  const componentTotal = memberComponents.reduce((sum, item) => sum.add(amount(cost, item)), new Decimal(0));
  const memberPrice = cost.add(componentTotal);
  const resale = components.find((item) => item.code === "resale_markup")!;
  const freightLow = components.find((item) => item.code === "freight_low")!;
  const freightHigh = components.find((item) => item.code === "freight_high")!;
  return {
    factoryCostThb: money(cost),
    componentTotal: money(componentTotal),
    memberPrice: money(memberPrice),
    suggestedResalePrice: money(memberPrice.add(amount(memberPrice, resale))),
    freightEstimateLow: money(amount(cost, freightLow)),
    freightEstimateHigh: money(amount(cost, freightHigh)),
    formulaId,
  };
}

export function hasActiveDisclosure(state: V14State, memberProfileId: string, supplierId: string) {
  return state.disclosureGrants.some((grant) => grant.memberProfileId === memberProfileId && grant.supplierId === supplierId && !grant.revokedAt);
}

export function memberSafeCatalog(state: V14State) {
  const memberProfileId = "member-profile-atelier-nara";
  return state.workflow.catalog
    .filter((product) => product.lifecycleStatus === "PUBLISHED" && product.activeMemberPrice)
    .map((product) => {
      const memberPrice = new Decimal(product.memberUnitPrice);
      const cost = new Decimal(product.factoryUnitCost);
      const disclosed = hasActiveDisclosure(state, memberProfileId, product.supplierId);
      const supplier = state.workflow.suppliers.find((item) => item.id === product.supplierId);
      return {
        id: product.id,
        sku: product.sku,
        nameTh: product.nameTh,
        nameEn: product.nameEn,
        kind: product.kind,
        category: product.category,
        memberUnitPrice: money(memberPrice),
        suggestedResalePrice: money(memberPrice.mul("1.25")),
        freightEstimateLow: money(cost.mul("0.15")),
        freightEstimateHigh: money(cost.mul("0.20")),
        leadTimeDays: product.leadTimeDays,
        specification: product.specification,
        partnerSource: disclosed ? supplier?.name ?? "Partner Factory" : `Partner Source — ${supplier?.city ?? "China"}`,
        supplierDisclosed: disclosed,
        samples: state.samples.filter((sample) => sample.productId === product.id).map((sample) => ({ id: sample.id, code: sample.code, type: sample.type, materialName: sample.materialName, memberDisplayLabel: sample.memberDisplayLabel, city: sample.city, country: sample.country, status: sample.status })),
      };
    });
}

export function memberSafeSnapshot(state: V14State) {
  return {
    memberApplication: state.workflow.memberApplication,
    catalog: memberSafeCatalog(state),
    project: state.workflow.project,
    projectItems: state.workflow.projectItems.map((entry) => {
      const item = { ...entry };
      delete (item as Partial<typeof item>).supplierId;
      return item;
    }),
    rfq: state.workflow.rfq ? { ...state.workflow.rfq, supplierId: undefined } : null,
    quotations: state.workflow.quotations,
    order: state.workflow.order,
    paymentSchedules: state.workflow.paymentSchedules,
    transfers: state.workflow.transfers,
    productionUpdates: state.workflow.productionUpdates.map((entry) => {
      const item = { ...entry };
      delete (item as Partial<typeof item>).note;
      return item;
    }),
    qcInspections: state.workflow.qcInspections,
    memberApprovedItemIds: state.workflow.memberApprovedItemIds,
    shipments: state.workflow.shipments,
    claim: state.workflow.claim,
    visits: state.visits.map((entry) => {
      const visit = { ...entry };
      delete (visit as Partial<typeof visit>).supplierId;
      return visit;
    }),
    warranty: { title: state.warrantySnapshot.title, terms: state.warrantySnapshot.terms, version: state.warrantySnapshot.version },
    suggestedResponsibility: state.suggestedResponsibility,
    confirmedResponsibility: state.confirmedResponsibility,
  };
}

export function v14Progress(state: V14State) {
  const checks = [
    state.workflow.memberApplication.status === "APPROVED",
    state.internalUsers.some((user) => user.roles.length > 1),
    state.formulas.some((formula) => formula.status === "ACTIVE"),
    state.workflow.projectItems.length > 2,
    state.workflow.quotations.some((quote) => quote.status === "ACCEPTED"),
    Boolean(state.workflow.order),
    state.workflow.qcInspections.some((item) => item.result === "PASSED"),
    state.visits.some((visit) => visit.status === "COMPLETED"),
    state.workflow.shipments.some((shipment) => shipment.status === "DELIVERED"),
    state.workflow.claim?.status === "CLOSED",
  ];
  return { complete: checks.filter(Boolean).length, total: checks.length, checks };
}

export function v14UatSummary(state: V14State) {
  const passed = state.uatResults.filter((item) => item.status === "PASS").length;
  const needsFix = state.uatResults.filter((item) => item.status === "NEEDS_FIX").length;
  return { passed, needsFix, untested: state.uatResults.length - passed - needsFix, total: state.uatResults.length };
}
