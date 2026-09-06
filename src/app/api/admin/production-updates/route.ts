import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  supplier_order_id: z.uuid(),
  status: z.enum([
    "ACKNOWLEDGED",
    "MATERIAL_PREPARATION",
    "IN_PRODUCTION",
    "ASSEMBLY",
    "FINISHING",
    "PRODUCTION_COMPLETED",
    "DELAYED",
  ]),
  note: z.string().trim().max(4000).optional(),
  estimated_completion_at: z.iso.datetime().optional(),
  progress_percent: z.coerce.number().min(0).max(100).optional(),
  started_at: z.iso.datetime().optional(),
  actual_completed_at: z.iso.datetime().optional(),
  delay_reason: z.string().trim().max(2000).optional(),
  file_ids: z.array(z.uuid()).max(20).default([]),
});

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "add_production_update",
    (input) => ({
      supplier_order_id_input: input.supplier_order_id,
      status_input: input.status,
      note_input: input.note ?? null,
      estimated_completion_at_input: input.estimated_completion_at ?? null,
      progress_percent_input: input.progress_percent ?? null,
      started_at_input: input.started_at ?? null,
      actual_completed_at_input: input.actual_completed_at ?? null,
      delay_reason_input: input.delay_reason ?? null,
      file_ids_input: input.file_ids,
    }),
    "บันทึกสถานะการผลิตแล้ว",
    201,
  );
}
