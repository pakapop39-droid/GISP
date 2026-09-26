import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session",()=>({AppAccessError:class AppAccessError extends Error{code="X";status=400;}}));
vi.mock("@/lib/auth/auth-errors",()=>({isExistingAuthUserError:(message:string)=>message.toLowerCase().includes('duplicate key value violates unique constraint "_user_email_key"')}));
import { apiError } from "./response";
describe("race and duplicate API responses",()=>{
  it.each(["duplicate key value violates unique constraint", "could not serialize access", "deadlock detected", "PROJECT_ITEM_NOT_ORDERABLE", "QUANTITY_EXCEEDS_REMAINING", "PROJECT_ITEM_NOT_READY", "INVALID_ORDER_QUANTITY"])("maps %s to reloadable 409",async message=>{const response=apiError(new Error(message));expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:"CONFLICT_RELOAD_REQUIRED"});expect(JSON.stringify(await apiError(new Error(message)).json())).toContain("โหลดหน้าใหม่");});
  it("does not classify unrelated errors containing an Order code as a conflict",async()=>{
    const response=apiError(new Error("UNEXPECTED_PROJECT_ITEM_NOT_READY_SUFFIX"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({code:"SERVER_ERROR"});
  });
  it("preserves the dedicated account-already-exists response before generic duplicate handling",async()=>{
    const response=apiError(new Error('duplicate key value violates unique constraint "_user_email_key"'));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"ACCOUNT_ALREADY_EXISTS"});
  });
});

describe("database error privacy mappings",()=>{
  it("cloaks an unavailable payment schedule as generic NOT_FOUND",async()=>{
    const response=apiError(new Error("PAYMENT_SCHEDULE_NOT_AVAILABLE"));
    expect(response.status).toBe(404);
    const body=await response.json();
    expect(body).toEqual({code:"NOT_FOUND",message:"ไม่พบข้อมูลที่ต้องการ"});
    expect(JSON.stringify(body)).not.toContain("PAYMENT_SCHEDULE_NOT_AVAILABLE");
  });

  it("keeps permission denial at 403",async()=>{
    const response=apiError(new Error("PERMISSION_DENIED"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({code:"PERMISSION_DENIED"});
  });

  it("keeps unknown database failures at generic 500",async()=>{
    const response=apiError(new Error("UNRECOGNIZED_DATABASE_FAILURE"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({code:"SERVER_ERROR"});
  });

  it("keeps existing NOT_FOUND mapping unchanged",async()=>{
    const response=apiError(new Error("NOT_FOUND"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({code:"NOT_FOUND",message:"ไม่พบข้อมูลที่ต้องการ"});
  });
});
