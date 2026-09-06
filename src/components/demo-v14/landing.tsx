"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Layers3, ShieldCheck, UsersRound } from "lucide-react";
import { v14Progress, v14UatSummary } from "@/demo";
import { useV14 } from "./v14-context";
import { Metric, Status } from "./v14-ui";

export function DemoVersionLanding() {
  return <main className="v14-launch"><header><div className="v14-brand"><span>GI</span><div><b>GISP Demo Library</b><small>VERSIONED PROTOTYPES</small></div></div><Status tone="info">DEMO ENVIRONMENT</Status></header><section className="v14-launch__hero"><p className="v14-eyebrow">GLOBAL INTERIOR SUPPLY PLATFORM</p><h1>เลือกเวอร์ชัน Demo</h1><p>Demo 1.4 แยก Member Application และ GISP Back Office เสมือนแอปจริง ส่วน Demo 1.3 ถูกเก็บไว้เป็น Historical Baseline</p></section><div className="v14-version-grid"><Link href="/v1-4" className="v14-version-card featured"><span>ACTIVE REVIEW</span><h2>Demo 1.4</h2><p>Two-portal functional demo · Shared Riverstone State · UAT 8 หมวด</p><b>เปิดเวอร์ชันปัจจุบัน <ArrowRight size={18}/></b></Link><Link href="/v1-3" className="v14-version-card"><span>HISTORICAL BASELINE</span><h2>Demo 1.3</h2><p>Functional Prototype เดิมก่อนแยก Member และ Back Office</p><b>เปิด Demo เดิม <ArrowRight size={18}/></b></Link></div></main>;
}

export function V14Landing() {
  const { state } = useV14(); const progress=v14Progress(state); const uat=v14UatSummary(state);
  const portals=[
    {href:"/v1-4/member",icon:UsersRound,kicker:"EXTERNAL PORTAL",title:"Member Application",body:"ทดลองสมัครบริษัท เลือกสินค้า สร้าง Project ส่ง RFQ ชำระเงิน ติดตาม QC/Delivery และเปิด Claim",cta:"เข้าใช้งานในฐานะ Member"},
    {href:"/v1-4/admin",icon:Building2,kicker:"INTERNAL PORTAL",title:"GISP Back Office",body:"ทีม Admin, Finance, QC, Logistics, Executive และ Super Admin จัดการงานตามสิทธิ์",cta:"เข้า GISP Back Office"},
    {href:"/v1-4/overview",icon:BookOpen,kicker:"GUIDED STORY",title:"Guided Overview",body:"ชมเรื่องราว 10 ขั้นของ Riverstone และจุดตัดสำคัญระหว่างสอง Portal ก่อนทดลองกดเอง",cta:"ชมภาพรวม Workflow"},
  ];
  return <main className="v14-launch"><header><Link href="/" className="v14-brand"><span>GI</span><div><b>GISP Demo 1.4</b><small>RIVERSTONE · SHARED BROWSER STATE</small></div></Link><Status tone={state.buildReadiness==="APPROVED_FOR_MVP_BUILD"?"good":"warn"}>{state.buildReadiness}</Status></header><section className="v14-launch__hero"><p className="v14-eyebrow">TWO PORTALS · ONE WORKFLOW</p><h1>เห็นงานของ Member และทีม GISP<br/>เชื่อมต่อกันใน Demo เดียว</h1><p>เปิด Member และ Back Office คนละแท็บ เมื่อฝั่งหนึ่งส่งหรืออนุมัติงาน อีกฝั่งจะเห็นสถานะจาก Shared State ชุดเดียวกัน หลัง Refresh ข้อมูลยังอยู่</p><div className="v14-metrics"><Metric label="Mission Progress" value={`${progress.complete}/${progress.total}`}/><Metric label="State Revision" value={String(state.revision)}/><Metric label="UAT Passed" value={`${uat.passed}/${uat.total}`}/></div></section><div className="v14-portal-grid">{portals.map(({href,icon:Icon,kicker,title,body,cta})=><Link href={href} className="v14-portal-card" key={href}><Icon size={28}/><span>{kicker}</span><h2>{title}</h2><p>{body}</p><b>{cta}<ArrowRight size={17}/></b></Link>)}</div><section className="v14-handoff-note"><Layers3 size={25}/><div><b>วิธีทดสอบ Cross-portal Handoff</b><p>1) เปิด Member → Account & Company และส่งใบสมัคร 2) เปิด Back Office → Members แล้ว Approve 3) กลับ Member และ Refresh: Catalog จะปลดล็อก</p></div><ShieldCheck size={25}/></section></main>;
}
