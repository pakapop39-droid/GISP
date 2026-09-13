import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { CatalogExcelError,isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";
import { createEnrichmentExport } from "@/lib/catalog/enrichment-service";

export async function GET(_request: Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params; if(!z.uuid().safeParse(id).success)return invalidInput();
  try{
    const context=await requireAppAccess({permissions:["catalog.import"]});
    if(!isCatalogExcelRoundtripEnabled())return NextResponse.json({code:"FEATURE_DISABLED",message:"Excel Round-trip ยังไม่ได้เปิดใน Environment นี้"},{status:404});
    const result=await createEnrichmentExport(id,context);
    return new NextResponse(Buffer.from(result.bytes),{status:200,headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":`attachment; filename="catalog-enrichment.xlsx"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,"Cache-Control":"no-store, private","X-Enrichment-Batch-Id":result.batchId}});
  }catch(error){if(error instanceof CatalogExcelError)return NextResponse.json({code:error.code,message:error.message},{status:error.code==="NOT_FOUND"?404:409});return apiError(error);}
}
