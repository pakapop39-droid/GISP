import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read=(path:string)=>readFileSync(resolve(process.cwd(),path),"utf8");
describe("Lean notification four-path closure",()=>{
  it("has no enqueue in shared RPC or Finance verify",()=>{for(const path of ["src/lib/api/rpc-route.ts","src/app/api/admin/payment-transfers/[id]/verify/route.ts"]){expect(read(path)).not.toContain("queue_current_user_notification");expect(read(path)).not.toContain("notificationWarning");}});
  it("has no queue read/write or email send in processor or edge retry",()=>{for(const path of ["src/app/api/internal/notifications/process/route.ts","functions/notification-retry.ts"]){const source=read(path);expect(source).toContain("LEAN_SCOPE_DEFERRED");expect(source).not.toMatch(/notification_jobs|emails\.send|\.update\(|\.insert\(/);}});
});
