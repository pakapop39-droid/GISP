import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { isPdfCatalogImportEnabled } from "@/lib/catalog/pdf-import";
import { createInsForgeServerClient } from "@/lib/insforge/server";
export async function POST(_request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!z.uuid().safeParse(id).success)return invalidInput();
  try{await requireAppAccess({permissions:["catalog.import"]});if(!isPdfCatalogImportEnabled())return NextResponse.json({code:"FEATURE_DISABLED",message:"PDF Catalog Import ยังไม่ได้เปิดใน Environment นี้"},{status:404});const db=await createInsForgeServerClient();const result=await db.database.rpc("cancel_catalog_pdf_import",{import_job_id_input:id});if(result.error)throw result.error;return NextResponse.json({data:result.data,message:"ยกเลิกงาน PDF แล้ว"});}catch(error){return apiError(error);}
}
