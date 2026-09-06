"use client";

import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Check, EyeOff, Landmark } from "lucide-react";
import { v14Progress } from "@/demo";
import { useV14 } from "./v14-context";
import { Metric, Status } from "./v14-ui";

const scenes=[
  ["01","Foundation","Member สมัครและส่งบริษัท → GISP Admin อนุมัติ → Catalog ปลดล็อก"],
  ["1A","Price Structure","Super Admin จัดการ Global → Supplier → Product; ทุน 100 → Member 125 → Suggested Resale 156.25"],
  ["1B","Sample & Visit","Member ขอ Visit; ก่อน Complete ซ่อน Supplier Identity แล้วจึงเปิดเผยเฉพาะ Profile+Supplier"],
  ["02","Catalog & Project","Member เห็นเฉพาะราคาที่เปิดเผยได้ และสร้าง Riverstone Product Schedule"],
  ["03","Custom RFQ","Member ส่งสเปก; Admin ตรวจ ขอข้อมูลเพิ่ม เลือก Candidate และมอบหมายงาน"],
  ["04","Quotation","GISP ออกใบเสนอราคา Versioned; Member Accept เฉพาะ Active Version"],
  ["05","Order & Payment","สร้าง Partial Order, VAT 7%, Deposit/Balance 50/50 และ Finance Verify ยอดสะสม"],
  ["06","Production & QC","ETA/Delay, Fail → Rework → Reinspection และ Custom Member Approval"],
  ["07","Shipment & Delivery","ตรวจ Dispatch Gate, แบ่ง Partial Shipment และบันทึกผู้รับกับหลักฐาน"],
  ["08","Claim","Warranty Snapshot, Suggested Responsibility และ Order Admin ยืนยันก่อน Resolution"],
  ["09","Documents & Audit","Snapshot ไม่เปลี่ยนย้อนหลัง และ Member-safe Selector ป้องกันข้อมูลภายใน"],
  ["10","UAT & Sign-off","8 หมวดต้อง PASS และ GISP Admin กด Human Sign-off ก่อนเริ่ม MVP Build"],
];

export function V14Overview(){const{state}=useV14();const progress=v14Progress(state);return <main className="v14-overview"><header><Link href="/v1-4" className="v14-brand"><span>GI</span><div><b>GISP Guided Overview</b><small>DEMO 1.4 · RIVERSTONE</small></div></Link><Status tone="info">READ-ONLY STORY</Status></header><section className="v14-overview__hero"><p className="v14-eyebrow">END-TO-END BUSINESS STORY</p><h1>หนึ่งโครงการ สอง Portal<br/>สิบขั้นตอนที่ส่งต่องานกัน</h1><p>หน้านี้ใช้ทำความเข้าใจก่อนทดลอง Functional Demo แต่ละขั้นด้านล่างบอกว่าใครเริ่ม ใครรับช่วง และข้อมูลใดต้องถูกปกป้อง</p><div className="v14-metrics"><Metric label="Current Progress" value={`${progress.complete}/${progress.total}`}/><Metric label="Member Profile" value={state.workflow.memberApplication.status}/><Metric label="State Revision" value={String(state.revision)}/></div></section><section className="v14-scenes">{scenes.map(([no,title,body],index)=><article key={no}><span>{no}</span><div><p className="v14-eyebrow">{index%2===0?"MEMBER → GISP":"GISP → MEMBER"}</p><h2>{title}</h2><p>{body}</p></div><Check size={20}/></article>)}</section><section className="v14-overview__rules"><div><BadgeDollarSign/><b>ราคาแนะนำไม่รวมยอด</b><p>Suggested Resale และ Freight Estimate แสดงเป็นคำแนะนำเท่านั้น</p></div><div><EyeOff/><b>Member-safe ทุกช่องทาง</b><p>Cost, Formula, Margin, Supplier Payment และ Internal Note ต้องไม่รั่ว</p></div><div><Landmark/><b>Disclosure มีขอบเขต</b><p>Supplier Identity เปิดเมื่อ Visit Completed และ Revoke ได้โดย Super Admin</p></div></section><footer><Link href="/v1-4/member" className="v14-button v14-button--dark">เริ่มทดลอง Member <ArrowRight size={17}/></Link><Link href="/v1-4/admin" className="v14-button v14-button--outline">เปิด Back Office <ArrowRight size={17}/></Link></footer></main>}
