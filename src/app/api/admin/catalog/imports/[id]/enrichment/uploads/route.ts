import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { CATALOG_EXCEL_MAX_BYTES, CATALOG_EXCEL_MIME, CatalogExcelError,isCatalogExcelRoundtripEnabled } from "@/lib/catalog/excel-roundtrip";
import { stageEnrichmentUpload } from "@/lib/catalog/enrichment-service";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const{id}=await params;if(!z.uuid().safeParse(id).success)return invalidInput();
  try{
    const context=await requireAppAccess({permissions:["catalog.import"]});
    if(!isCatalogExcelRoundtripEnabled())return NextResponse.json({code:"FEATURE_DISABLED",message:"Excel Round-trip ยังไม่ได้เปิดใน Environment นี้"},{status:404});
    const form=await request.formData();const file=form.get("file");
    if(!(file instanceof File)||file.size>CATALOG_EXCEL_MAX_BYTES||file.type!==CATALOG_EXCEL_MIME)return NextResponse.json({code:"INVALID_FILE",message:"รองรับ .xlsx ไม่เกิน 10 MB เท่านั้น"},{status:400});
    const result=await stageEnrichmentUpload(id,file,context);
    return NextResponse.json({data:result,message:"อัปโหลดและจัดทำ Preview แล้ว"},{status:201});
  }catch(error){if(error instanceof CatalogExcelError)return NextResponse.json({code:error.code,message:error.message},{status:error.code==="PERMISSION_DENIED"?403:error.code==="INVALID_TRANSITION"?409:400});return apiError(error);}
}
