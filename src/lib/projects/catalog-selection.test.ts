import { describe, expect, it } from "vitest";
import { buildProjectItemSelection } from "./catalog-selection";

const optionId = "00000000-0000-4000-8000-000000000001";
const valueId = "00000000-0000-4000-8000-000000000002";

describe("buildProjectItemSelection", () => {
  it("builds the safe option snapshot required by the project item API", () => {
    expect(
      buildProjectItemSelection(
        [
          {
            id: optionId,
            name: "สีผ้า",
            isRequired: true,
            values: [{ id: valueId, label: "สีธรรมชาติ" }],
          },
        ],
        { [optionId]: valueId },
      ),
    ).toEqual({
      selectedOptions: [{ optionId, valueId, label: "สีธรรมชาติ" }],
      missingRequiredOptions: [],
    });
  });

  it("reports a required option before an item is submitted", () => {
    expect(
      buildProjectItemSelection(
        [
          {
            id: optionId,
            name: "สีผ้า",
            isRequired: true,
            values: [{ id: valueId, label: "สีธรรมชาติ" }],
          },
        ],
        {},
      ).missingRequiredOptions,
    ).toEqual(["สีผ้า"]);
  });
});
