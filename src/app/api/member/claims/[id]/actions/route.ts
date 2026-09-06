import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  id: z.uuid(),
  action: z.enum(["ADD_INFORMATION", "CONFIRM_RESOLVED", "STILL_ISSUE", "CONTACT_ME"]),
  note: z.string().trim().max(5000).optional(),
  evidence_file_id: z.uuid().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const forwarded = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ ...body, id }) }) as NextRequest;
  return runRpcRoute(forwarded, schema, "member_claim_action", (input) => ({
    claim_id_input: input.id,
    action_input: input.action,
    note_input: input.note ?? null,
    evidence_file_id_input: input.evidence_file_id ?? null,
  }), "อัปเดต Claim แล้ว");
}
