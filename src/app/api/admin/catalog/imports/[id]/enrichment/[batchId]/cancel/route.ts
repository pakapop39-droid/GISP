import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError,invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { enrichmentCancelSchema,isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";
import { ensureEnrichmentBatchJob } from "@/lib/catalog/enrichment-service";
export async function POST(request:Request,{params}:{params:Promise<{id:string;batchId:string}>}){const{id,batchId}=await params;if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(batchId).success)return invalidInput();try{await requireAppAccess({permissions:["catalog.import"]});if(!isCatalogExcelRoundtripEnabled())return NextResponse.json({code:"FEATURE_DISABLED",message:"Excel Round-trip ยังไม่ได้เปิด"},{status:404});const parsed=enrichmentCancelSchema.safeParse(await request.json());if(!parsed.success)return invalidInput(parsed.error.flatten());await ensureEnrichmentBatchJob(id,batchId);const db=await createInsForgeServerClient();const result=await db.database.rpc("cancel_catalog_enrichment_batch",{batch_id_input:batchId});if(result.error)throw result.error;return NextResponse.json({data:result.data,message:"ยกเลิกส่วนที่ยังไม่ Apply แล้ว"});}catch(error){return apiError(error);}}
