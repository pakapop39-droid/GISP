import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/session",()=>({AppAccessError:class AppAccessError extends Error{code="X";status=400;}}));
vi.mock("@/lib/auth/auth-errors",()=>({isExistingAuthUserError:(message:string)=>message.toLowerCase().includes('duplicate key value violates unique constraint "_user_email_key"')}));
import { apiError } from "./response";
describe("race and duplicate API responses",()=>{
  it.each(["duplicate key value violates unique constraint", "could not serialize access", "deadlock detected", "PROJECT_ITEM_NOT_ORDERABLE", "QUANTITY_EXCEEDS_REMAINING"])("maps %s to reloadable 409",async message=>{const response=apiError(new Error(message));expect(response.status).toBe(409);expect(await response.json()).toMatchObject({code:"CONFLICT_RELOAD_REQUIRED"});expect(JSON.stringify(await apiError(new Error(message)).json())).toContain("โหลดหน้าใหม่");});
  it("preserves the dedicated account-already-exists response before generic duplicate handling",async()=>{
    const response=apiError(new Error('duplicate key value violates unique constraint "_user_email_key"'));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({code:"ACCOUNT_ALREADY_EXISTS"});
  });
});
