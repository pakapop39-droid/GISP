import { describe,expect,it } from "vitest";
import { addProjectItemSchema, cancelShowroomVisitSchema, createProjectSchema, reviewShowroomVisitSchema, revokeSupplierDisclosureSchema, scheduleTotals, showroomVisitSchema, updateProjectItemSchema } from "./schema";
describe("Slice 3 project schema",()=>{
 it("accepts a complete project",()=>{expect(createProjectSchema.safeParse({name:"บ้านตัวอย่าง จำลอง",projectType:"RESIDENTIAL",endCustomerName:"ลูกค้าจำลอง",siteAddress:"กรุงเทพมหานคร",expectedNeedDate:"2026-12-01"}).success).toBe(true)});
 it("rejects invalid quantities",()=>{expect(addProjectItemSchema.safeParse({productId:"00000000-0000-4000-8000-000000000001",quantity:0}).success).toBe(false)});
 it("accepts editing quantity and product options",()=>{expect(updateProjectItemSchema.safeParse({areaId:null,variantId:null,quantity:2,selectedOptions:[{optionId:"00000000-0000-4000-8000-000000000001",valueId:"00000000-0000-4000-8000-000000000002",label:"Oak"}]}).success).toBe(true)});
 it("requires a product for a showroom visit",()=>{expect(showroomVisitSchema.safeParse({preferredAt:"2026-09-01T10:00:00+07:00",attendeeCount:2,note:""}).success).toBe(false)});
 it("allows only the supported admin transitions",()=>{expect(reviewShowroomVisitSchema.safeParse({action:"COMPLETE",note:"เรียบร้อย"}).success).toBe(true);expect(reviewShowroomVisitSchema.safeParse({action:"DELETE",note:""}).success).toBe(false)});
 it("requires reasons for cancellation and revocation",()=>{expect(cancelShowroomVisitSchema.safeParse({reason:"ยกเลิกนัด"}).success).toBe(true);expect(revokeSupplierDisclosureSchema.safeParse({reason:"สั้น"}).success).toBe(false)});
 it("calculates a schedule total",()=>{expect(scheduleTotals([{areaName:"Living",sku:"A",name:"Chair",variant:null,options:"",quantity:2,unit:"EA",unitPrice:1500,status:"READY_TO_ORDER"}])).toEqual({quantity:2,subtotal:3000})});
});
