import Decimal from "decimal.js";

Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

export const pricingScopeTypes = ["GLOBAL", "SUPPLIER", "PRODUCT"] as const;
export const pricingCalculationTypes = [
  "PERCENTAGE",
  "FIXED_AMOUNT_THB",
] as const;
export const pricingCalculationBases = [
  "FACTORY_COST_THB",
  "MEMBER_PRICE",
] as const;

export type PricingScopeType = (typeof pricingScopeTypes)[number];
export type PricingCalculationType =
  (typeof pricingCalculationTypes)[number];
export type PricingCalculationBasis =
  (typeof pricingCalculationBases)[number];

export type PricingFormulaComponent = {
  code: string;
  name: string;
  calculationType: PricingCalculationType;
  calculationBasis: PricingCalculationBasis;
  value: Decimal.Value;
  includedInMemberPrice: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type PricingFormulaLayer = {
  id: string;
  scopeType: PricingScopeType;
  suggestedResaleMarkupPercent: Decimal.Value;
  freightEstimateMinPercent: Decimal.Value;
  freightEstimateMaxPercent: Decimal.Value;
  components: PricingFormulaComponent[];
};

export type ResolvedPricingComponent = PricingFormulaComponent & {
  sourceFormulaId: string;
  sourceScope: PricingScopeType;
};

export type PricingComponentBreakdown = ResolvedPricingComponent & {
  basisAmount: string;
  calculatedAmount: string;
};

export type PricingResult = {
  factoryCostThb: string;
  memberPrice: string;
  suggestedResalePrice: string;
  freightEstimateMin: string;
  freightEstimateMax: string;
  grossMargin: string;
  marginPercent: string;
  suggestedResaleMarkupPercent: string;
  freightEstimateMinPercent: string;
  freightEstimateMaxPercent: string;
  components: PricingComponentBreakdown[];
};

const scopePriority: Record<PricingScopeType, number> = {
  GLOBAL: 1,
  SUPPLIER: 2,
  PRODUCT: 3,
};

const roundMoney = (value: Decimal.Value) =>
  new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

const normalizeCode = (code: string) => code.trim().toUpperCase();

function assertNonNegative(value: Decimal.Value, field: string) {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.isNegative()) {
    throw new Error(`${field} must be a non-negative decimal`);
  }
  return decimal;
}

export function resolvePricingFormula(layers: PricingFormulaLayer[]) {
  if (!layers.length) {
    throw new Error("At least one pricing formula layer is required");
  }

  const orderedLayers = [...layers].sort(
    (left, right) =>
      scopePriority[left.scopeType] - scopePriority[right.scopeType],
  );
  const seenScopes = new Set<PricingScopeType>();
  const resolved = new Map<string, ResolvedPricingComponent>();

  for (const layer of orderedLayers) {
    if (seenScopes.has(layer.scopeType)) {
      throw new Error(`Duplicate pricing scope: ${layer.scopeType}`);
    }
    seenScopes.add(layer.scopeType);

    const layerCodes = new Set<string>();
    for (const component of layer.components) {
      const code = normalizeCode(component.code);
      if (!code) throw new Error("Pricing component code is required");
      if (layerCodes.has(code)) {
        throw new Error(
          `Duplicate pricing component ${code} in ${layer.scopeType}`,
        );
      }
      layerCodes.add(code);
      assertNonNegative(component.value, `Component ${code}`);
      resolved.set(code, {
        ...component,
        code,
        sourceFormulaId: layer.id,
        sourceScope: layer.scopeType,
      });
    }
  }

  const effectiveLayer = orderedLayers.at(-1)!;
  const resaleMarkup = assertNonNegative(
    effectiveLayer.suggestedResaleMarkupPercent,
    "Suggested resale markup",
  );
  const freightMin = assertNonNegative(
    effectiveLayer.freightEstimateMinPercent,
    "Freight estimate minimum",
  );
  const freightMax = assertNonNegative(
    effectiveLayer.freightEstimateMaxPercent,
    "Freight estimate maximum",
  );
  if (freightMax.lessThan(freightMin)) {
    throw new Error("Freight estimate maximum must not be below minimum");
  }

  return {
    effectiveFormulaId: effectiveLayer.id,
    suggestedResaleMarkupPercent: resaleMarkup,
    freightEstimateMinPercent: freightMin,
    freightEstimateMaxPercent: freightMax,
    components: [...resolved.values()].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.code.localeCompare(right.code),
    ),
  };
}

export function calculateProductPrice(
  factoryCostThbInput: Decimal.Value,
  layers: PricingFormulaLayer[],
): PricingResult {
  const factoryCostThb = roundMoney(
    assertNonNegative(factoryCostThbInput, "Factory cost THB"),
  );
  const resolved = resolvePricingFormula(layers);
  const breakdown: PricingComponentBreakdown[] = [];
  let memberPrice = factoryCostThb;

  for (const component of resolved.components) {
    if (!component.enabled) continue;
    const componentValue = new Decimal(component.value);
    const basis =
      component.calculationBasis === "FACTORY_COST_THB"
        ? factoryCostThb
        : memberPrice;
    const amount = roundMoney(
      component.calculationType === "PERCENTAGE"
        ? basis.mul(componentValue).div(100)
        : componentValue,
    );

    if (component.includedInMemberPrice) {
      memberPrice = roundMoney(memberPrice.add(amount));
    }
    breakdown.push({
      ...component,
      basisAmount: basis.toFixed(2),
      calculatedAmount: amount.toFixed(2),
    });
  }

  const suggestedResalePrice = roundMoney(
    memberPrice.mul(
      new Decimal(1).add(
        resolved.suggestedResaleMarkupPercent.div(100),
      ),
    ),
  );
  const freightEstimateMin = roundMoney(
    factoryCostThb.mul(resolved.freightEstimateMinPercent).div(100),
  );
  const freightEstimateMax = roundMoney(
    factoryCostThb.mul(resolved.freightEstimateMaxPercent).div(100),
  );
  const grossMargin = roundMoney(memberPrice.minus(factoryCostThb));
  const marginPercent = memberPrice.isZero()
    ? new Decimal(0)
    : grossMargin
        .mul(100)
        .div(memberPrice)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    factoryCostThb: factoryCostThb.toFixed(2),
    memberPrice: memberPrice.toFixed(2),
    suggestedResalePrice: suggestedResalePrice.toFixed(2),
    freightEstimateMin: freightEstimateMin.toFixed(2),
    freightEstimateMax: freightEstimateMax.toFixed(2),
    grossMargin: grossMargin.toFixed(2),
    marginPercent: marginPercent.toFixed(2),
    suggestedResaleMarkupPercent:
      resolved.suggestedResaleMarkupPercent.toFixed(4),
    freightEstimateMinPercent: resolved.freightEstimateMinPercent.toFixed(4),
    freightEstimateMaxPercent: resolved.freightEstimateMaxPercent.toFixed(4),
    components: breakdown,
  };
}
