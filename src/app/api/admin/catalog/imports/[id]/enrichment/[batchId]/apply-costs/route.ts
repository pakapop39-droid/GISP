import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { enrichmentApplySchema,isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";
import { ensureEnrichmentBatchJob } from "@/lib/catalog/enrichment-service";

export async function POST(request:Request,{params}:{params:Promise<{id:string;batchId:string}>}){const{id,batchId}=await params;if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(batchId).success)return invalidInput();try{await requireAppAccess({permissions:["catalog.import","catalog.cost.manage"]});if(!isCatalogExcelRoundtripEnabled())return NextResponse.json({code:"FEATURE_DISABLED",message:"Excel Round-trip ยังไม่ได้เปิด"},{status:404});const parsed=enrichmentApplySchema.safeParse(await request.json());if(!parsed.success)return invalidInput(parsed.error.flatten());await ensureEnrichmentBatchJob(id,batchId);const db=await createInsForgeServerClient();const result=await db.database.rpc("apply_catalog_enrichment_costs",{batch_id_input:batchId,row_ids_input:parsed.data.rowIds,idempotency_key_input:parsed.data.idempotencyKey});if(result.error)throw result.error;return NextResponse.json({data:result.data,message:"ยืนยันต้นทุนแล้ว (Member Price ยังไม่ถูก Activate)"});}catch(error){return apiError(error);}}
