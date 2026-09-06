import { describe, expect, it } from "vitest";
import {
  calculateProductPrice,
  type PricingFormulaLayer,
} from "./engine";

const template: PricingFormulaLayer = {
  id: "global-v1",
  scopeType: "GLOBAL",
  suggestedResaleMarkupPercent: "25",
  freightEstimateMinPercent: "15",
  freightEstimateMaxPercent: "20",
  components: [
    {
      code: "platform",
      name: "Platform Cost",
      calculationType: "PERCENTAGE",
      calculationBasis: "FACTORY_COST_THB",
      value: "5",
      includedInMemberPrice: true,
      enabled: true,
      sortOrder: 10,
    },
    {
      code: "marketing",
      name: "Marketing and Training",
      calculationType: "PERCENTAGE",
      calculationBasis: "FACTORY_COST_THB",
      value: "10",
      includedInMemberPrice: true,
      enabled: true,
      sortOrder: 20,
    },
    {
      code: "sourcing",
      name: "Product Sourcing",
      calculationType: "PERCENTAGE",
      calculationBasis: "FACTORY_COST_THB",
      value: "10",
      includedInMemberPrice: true,
      enabled: true,
      sortOrder: 30,
    },
  ],
};

describe("Slice 2 pricing engine", () => {
  it("passes the approved 100 → 125 → 156.25 pricing example", () => {
    const result = calculateProductPrice("100", [template]);

    expect(result).toMatchObject({
      factoryCostThb: "100.00",
      memberPrice: "125.00",
      suggestedResalePrice: "156.25",
      freightEstimateMin: "15.00",
      freightEstimateMax: "20.00",
      grossMargin: "25.00",
      marginPercent: "20.00",
    });
  });

  it("inherits components and lets a more specific scope override by code", () => {
    const result = calculateProductPrice("100", [
      template,
      {
        ...template,
        id: "supplier-v1",
        scopeType: "SUPPLIER",
        components: [
          {
            ...template.components[1],
            code: "MARKETING",
            value: "12",
          },
        ],
      },
      {
        ...template,
        id: "product-v1",
        scopeType: "PRODUCT",
        components: [
          {
            code: "packing",
            name: "Packing",
            calculationType: "FIXED_AMOUNT_THB",
            calculationBasis: "FACTORY_COST_THB",
            value: "3",
            includedInMemberPrice: true,
            enabled: true,
            sortOrder: 40,
          },
        ],
      },
    ]);

    expect(result.memberPrice).toBe("130.00");
    expect(result.components.map((item) => item.code)).toEqual([
      "PLATFORM",
      "MARKETING",
      "SOURCING",
      "PACKING",
    ]);
    expect(result.components[1].sourceScope).toBe("SUPPLIER");
  });

  it("uses the running member price for MEMBER_PRICE basis", () => {
    const result = calculateProductPrice("100", [
      {
        ...template,
        components: [
          { ...template.components[0], value: "10" },
          {
            ...template.components[1],
            calculationBasis: "MEMBER_PRICE",
            value: "10",
          },
        ],
      },
    ]);

    expect(result.memberPrice).toBe("121.00");
    expect(result.components[1].basisAmount).toBe("110.00");
  });

  it("rounds each positive amount half-up to two decimal places", () => {
    const result = calculateProductPrice("0", [
      {
        ...template,
        suggestedResaleMarkupPercent: "0",
        freightEstimateMinPercent: "0",
        freightEstimateMaxPercent: "0",
        components: [
          {
            ...template.components[0],
            calculationType: "FIXED_AMOUNT_THB",
            value: "0.005",
          },
        ],
      },
    ]);

    expect(result.memberPrice).toBe("0.01");
  });

  it("rejects duplicate layers and invalid freight ranges", () => {
    expect(() => calculateProductPrice("100", [template, template])).toThrow(
      "Duplicate pricing scope",
    );
    expect(() =>
      calculateProductPrice("100", [
        {
          ...template,
          freightEstimateMinPercent: "20",
          freightEstimateMaxPercent: "15",
        },
      ]),
    ).toThrow("maximum must not be below minimum");
  });
});
