import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";

export async function GET(_request: NextRequest,{params}:{params:Promise<{id:string;rowId:string;fileId:string}>}) {
  const {id,rowId,fileId}=await params;
  if([id,rowId,fileId].some((value)=>!z.uuid().safeParse(value).success))return invalidInput();
  try{
    await requireAppAccess({permissions:["catalog.import"]});
    const admin=createInsForgeAdminClient();
    const job=await admin.database.from("catalog_import_jobs").select("id,security_status,security_verified_at")
      .eq("id",id).eq("source_type","PDF").maybeSingle();
    if(job.error)throw job.error;
    if(!job.data)return NextResponse.json({code:"NOT_FOUND",message:"ไม่พบ Import Job"},{status:404});
    if(job.data.security_status!=="VERIFIED"||!job.data.security_verified_at)return NextResponse.json({code:"SECURITY_PENDING",message:"ไฟล์ยังไม่ผ่านการตรวจความปลอดภัย"},{status:423});
    const link=await admin.database.from("catalog_import_candidate_images").select("file_id,import_row_id").eq("file_id",fileId).eq("import_row_id",rowId).maybeSingle();
    if(link.error)throw link.error;
    if(!link.data)return NextResponse.json({code:"NOT_FOUND",message:"ไม่พบรูป Candidate"},{status:404});
    const row=await admin.database.from("catalog_import_rows").select("id").eq("id",rowId).eq("import_job_id",id).maybeSingle();
    if(row.error)throw row.error;
    if(!row.data)return NextResponse.json({code:"NOT_FOUND",message:"ไม่พบ Candidate"},{status:404});
    const file=await admin.database.from("file_metadata").select("bucket,object_key").eq("id",fileId)
      .eq("visibility","CONFIDENTIAL").eq("entity_type","CATALOG_IMPORT_CANDIDATE").eq("entity_id",id).maybeSingle();
    if(file.error)throw file.error;
    if(!file.data)return NextResponse.json({code:"NOT_FOUND",message:"ไม่พบไฟล์รูป"},{status:404});
    const signed=await admin.storage.from(file.data.bucket).createSignedUrl(file.data.object_key,300);
    if(signed.error||!signed.data)throw signed.error??new Error("SIGNED_URL_FAILED");
    return NextResponse.redirect(signed.data.signedUrl);
  }catch(error){return apiError(error);}
}
