import type { NextRequest } from "next/server";
import { z } from "zod";
import { runRpcRoute } from "@/lib/api/rpc-route";

const schema = z.object({
  order_item_id: z.uuid(),
  result: z.enum(["PASSED", "FAILED", "REWORK_REQUIRED"]),
  checklist: z.array(z.object({
    code: z.string().trim().max(80).optional(),
    label: z.string().trim().min(1).max(240),
    result: z.enum(["PASSED", "FAILED", "NOT_INSPECTED"]),
    note: z.string().trim().max(1000).optional(),
  })).min(1).max(50),
  note: z.string().trim().max(4000).optional(),
  defect_note: z.string().trim().max(4000).optional(),
  rework_note: z.string().trim().max(4000).optional(),
  inspection_type: z.enum(["INITIAL", "REINSPECTION"]).default("INITIAL"),
  parent_inspection_id: z.uuid().optional(),
  file_ids: z.array(z.uuid()).max(20).default([]),
});

export async function POST(request: NextRequest) {
  return runRpcRoute(
    request,
    schema,
    "record_qc_inspection",
    (input) => ({
      order_item_id_input: input.order_item_id,
      result_input: input.result,
      checklist_input: input.checklist,
      note_input: input.note ?? null,
      defect_note_input: input.defect_note ?? null,
      rework_note_input: input.rework_note ?? null,
      inspection_type_input: input.inspection_type,
      parent_inspection_id_input: input.parent_inspection_id ?? null,
      file_ids_input: input.file_ids,
    }),
    "บันทึก QC Inspection แล้ว",
    201,
  );
}
