import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getEnrichmentPreview } from "@/lib/catalog/enrichment-service";
import { CatalogExcelError,isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";

export async function GET(request:Request,{params}:{params:Promise<{id:string;batchId:string}>}){
  const{id,batchId}=await params;if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(batchId).success)return invalidInput();
  try{const context=await requireAppAccess({permissions:["catalog.import"]});if(!isCatalogExcelRoundtripEnabled())return NextResponse.json({code:"FEATURE_DISABLED",message:"Excel Round-trip ยังไม่ได้เปิด"},{status:404});
    const url=new URL(request.url);const page=Math.max(1,Number(url.searchParams.get("page")||1)||1);const pageSize=Math.min(100,Math.max(1,Number(url.searchParams.get("pageSize")||50)||50));
    const client=await createInsForgeServerClient();const refreshed=await client.database.rpc("refresh_catalog_enrichment_targets",{batch_id_input:batchId});if(refreshed.error)throw refreshed.error;
    return NextResponse.json({data:await getEnrichmentPreview(id,batchId,page,pageSize,context.permissions.includes("catalog.cost.read"))});
  }catch(error){if(error instanceof CatalogExcelError)return NextResponse.json({code:error.code,message:error.message},{status:404});return apiError(error);}
}
