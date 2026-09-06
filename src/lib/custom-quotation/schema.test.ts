import { describe, expect, it } from "vitest";
import { createQuotationSchema, quotationAdminActionSchema, quotationResponseSchema } from "./schema";

const validQuote = {
  custom_request_id: "11111111-1111-4111-8111-111111111111",
  subtotal: 100_000,
  lead_time_days: 45,
  valid_days: 30,
  supplier_id: "22222222-2222-4222-8222-222222222222",
  supplier_cost_total: 60_000,
  quote_note: "ส่งมอบตามเงื่อนไขโครงการ",
  confirmed_specification: "ตู้บิลท์อินไม้วีเนียร์โอ๊ก ขนาดยืนยันตามแบบ",
};

describe("Slice 5 quotation validation", () => {
  it("accepts a complete quotation snapshot", () => {
    expect(createQuotationSchema.parse(validQuote)).toMatchObject({ valid_days: 30, subtotal: 100_000 });
  });

  it("rejects zero price and missing confirmed specification", () => {
    expect(createQuotationSchema.safeParse({ ...validQuote, subtotal: 0 }).success).toBe(false);
    expect(createQuotationSchema.safeParse({ ...validQuote, confirmed_specification: "สั้น" }).success).toBe(false);
  });

  it("requires a reason for rejection and cancellation", () => {
    expect(quotationResponseSchema.safeParse({ response: "REJECTED", reason: "" }).success).toBe(false);
    expect(quotationResponseSchema.safeParse({ response: "ACCEPTED", reason: "" }).success).toBe(true);
    expect(quotationAdminActionSchema.safeParse({ action: "CANCEL", reason: "" }).success).toBe(false);
  });
});
