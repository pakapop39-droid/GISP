import { describe, expect, it } from "vitest";
import { filterOrderRows } from "./order-list-filter";
import type { OrderListRow } from "./types";

const rows: OrderListRow[] = [
  {
    id: "1",
    order_number: "ORD-1001",
    status: "IN_PRODUCTION",
    currency: "THB",
    subtotal: 100,
    vat_amount: 7,
    grand_total: 107,
    deposit_amount: 53.5,
    balance_amount: 53.5,
    deposit_verified_at: null,
    balance_verified_at: null,
    created_at: "2026-08-30T00:00:00.000Z",
    project: { id: "p1", project_number: "PRJ-RIVERSIDE", name: "Riverside House", site_address: "Bangkok" },
    member: { id: "m1", company_name: "Example Interior", contact_name: "Anan" },
  },
  {
    id: "2",
    order_number: "ORD-1002",
    status: "COMPLETED",
    currency: "THB",
    subtotal: 200,
    vat_amount: 14,
    grand_total: 214,
    deposit_amount: 107,
    balance_amount: 107,
    deposit_verified_at: null,
    balance_verified_at: null,
    created_at: "2026-08-29T00:00:00.000Z",
    project: { id: "p2", project_number: "PRJ-OFFICE", name: "North Office", site_address: "Bangkok" },
    member: { id: "m2", company_name: "North Design", contact_name: "Mali" },
  },
];

describe("order list search and filter", () => {
  it("returns every row when no search or status is selected", () => {
    expect(filterOrderRows(rows, "", "")).toHaveLength(2);
  });

  it("searches order, project and member text without case sensitivity", () => {
    expect(filterOrderRows(rows, "riverside", "").map((row) => row.id)).toEqual(["1"]);
    expect(filterOrderRows(rows, "NORTH DESIGN", "").map((row) => row.id)).toEqual(["2"]);
  });

  it("combines search text with the selected status", () => {
    expect(filterOrderRows(rows, "office", "COMPLETED").map((row) => row.id)).toEqual(["2"]);
    expect(filterOrderRows(rows, "office", "IN_PRODUCTION")).toHaveLength(0);
  });
});
