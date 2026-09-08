"use client";

import { AlertTriangle, Bell, BookOpen, Boxes, Building2, CircleHelp, FileBarChart2, FileClock, FileQuestion, FileUp, FolderKanban, Gauge, HandCoins, KeyRound, LineChart, Link2, ListChecks, LogOut, Menu, Quote, ScanSearch, Settings2, ShoppingBag, Store, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { staffJobGroupLabelsForRoles } from "@/lib/auth/staff-job-groups";
import { isReleaseStagePathAllowed } from "@/lib/release-stage";
import type { AppAccessContext } from "@/lib/auth/types";

type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string; permissionsAny?: string[]; superAdminOnly?: boolean; feature?: "sharedCatalog" | "productSourcing" };
const postGoLiveFeaturesEnabled = process.env.NEXT_PUBLIC_ENABLE_POST_GO_LIVE_FEATURES === "true";
const sharedCatalogEnabled = postGoLiveFeaturesEnabled || process.env.NEXT_PUBLIC_ENABLE_SHARED_CATALOGS === "true";
const productSourcingEnabled = postGoLiveFeaturesEnabled || process.env.NEXT_PUBLIC_ENABLE_PRODUCT_SOURCING === "true";
const memberNav: NavItem[]=[{href:"/member/dashboard",label:"ภาพรวม",icon:Gauge},{href:"/member/reports",label:"รายงานของฉัน",icon:FileBarChart2},{href:"/member/catalog",label:"Catalog สินค้า",icon:ShoppingBag},{href:"/member/shared-catalogs",label:"Catalog ของฉัน",icon:Link2,feature:"sharedCatalog"},{href:"/member/sourcing-requests",label:"ขอจัดหาจากภาพ",icon:ScanSearch,feature:"productSourcing"},{href:"/member/projects",label:"โครงการของฉัน",icon:FolderKanban},{href:"/member/custom-requests",label:"Custom RFQ",icon:FileQuestion},{href:"/member/custom-quotations",label:"ใบเสนอราคา",icon:Quote},{href:"/member/orders",label:"ออเดอร์และชำระเงิน",icon:HandCoins},{href:"/member/claims",label:"Claim หลังส่งมอบ",icon:AlertTriangle},{href:"/member/profile",label:"ข้อมูลบริษัท",icon:Building2},{href:"/member/history",label:"ประวัติรายการ",icon:FileClock}];
const adminNav: NavItem[]=[
  {href:"/admin/dashboard",label:"ภาพรวมงาน",icon:Gauge},
  {href:"/admin/executive",label:"Executive Summary",icon:LineChart,permission:"reports.executive.read"},
  {href:"/admin/reports",label:"Fixed Reports",icon:FileBarChart2,permission:"reports.fixed.read"},
  {href:"/admin/catalog",label:"Catalog & Pricing",icon:Boxes,permission:"catalog.read"},
  {href:"/admin/catalog/imports",label:"Import สินค้า",icon:FileUp,permission:"catalog.import"},
  {href:"/admin/catalog/batch",label:"Batch Enrichment",icon:ListChecks,permission:"catalog.read"},
  {href:"/admin/custom-requests",label:"Custom RFQ Queue",icon:FileQuestion,permission:"rfq.manage"},
  {href:"/admin/sourcing-requests",label:"Product Sourcing",icon:ScanSearch,permission:"sourcing.manage",feature:"productSourcing"},
  {href:"/admin/custom-quotations",label:"Custom Quotation",icon:Quote,permission:"quotations.manage"},
  {href:"/admin/orders",label:"Order & Payment",icon:HandCoins,permissionsAny:["orders.manage","payments.verify","supplier_payments.request","supplier_payments.manage","production.manage","qc.manage","shipments.manage","deliveries.manage","freight.manage"]},
  {href:"/admin/claims",label:"Claim Queue",icon:AlertTriangle,permission:"claims.manage"},
  {href:"/admin/showroom-visits",label:"Showroom Visit",icon:Store,permission:"visits.manage"},
  {href:"/admin/members",label:"คำขอสมาชิก",icon:Building2,permission:"members.read"},
  {href:"/admin/users",label:"ผู้ใช้ภายใน",icon:Users,superAdminOnly:true},
  {href:"/admin/roles",label:"สิทธิ์เบื้องหลัง",icon:KeyRound,superAdminOnly:true},
  {href:"/admin/settings",label:"Company Settings",icon:Settings2,permission:"settings.read"},
  {href:"/admin/logs",label:"Audit & Security",icon:BookOpen,permission:"audit.read"},
  {href:"/admin/guide",label:"คู่มือ Admin",icon:CircleHelp},
];

export function ProductionShell({portal,context,children,releaseStage,staffOperations=false}:{staffOperations?:boolean;releaseStage?:string;portal:"member"|"admin";context:AppAccessContext;children:React.ReactNode}){
  const pathname=usePathname();const router=useRouter();const [open,setOpen]=useState(false);const isSuperAdmin=context.roles.includes("SUPER_ADMIN");
  const nav=(portal==="member"?memberNav:adminNav).filter(item=>isReleaseStagePathAllowed(item.href,releaseStage,staffOperations)&&(!item.permission||context.permissions.includes(item.permission))&&(!item.permissionsAny||item.permissionsAny.some(permission=>context.permissions.includes(permission)))&&(!item.superAdminOnly||isSuperAdmin)&&(!item.feature||(item.feature==="sharedCatalog"?sharedCatalogEnabled:productSourcingEnabled)));
  async function signOut(){await fetch("/api/auth/sign-out",{method:"POST"});router.replace("/login");router.refresh()}
  const roleLabels=portal==="member"?["สมาชิก"]:staffJobGroupLabelsForRoles(context.roles);
  const sidebar=<><div className="v14-side-intro"><span>{portal==="member"?"MEMBER PORTAL":"OPERATIONS PORTAL"}</span><strong>{context.companyName??context.displayName??"GISP"}</strong><small>{roleLabels.join(" · ")}</small></div><nav>{nav.map((item,index)=>{const Icon=item.icon;const active=item.href==="/admin/catalog"?(pathname===item.href||pathname.startsWith("/admin/catalog/products/")):(pathname===item.href||pathname.startsWith(`${item.href}/`));return <Link key={item.href} href={item.href} onClick={()=>setOpen(false)} className={active?"active":""}><Icon size={16}/><span>{item.label}</span><small>{String(index+1).padStart(2,"0")}</small></Link>})}</nav><div className="v14-side-foot"><span>SECURED SESSION</span><strong>{context.displayName??"ผู้ใช้งาน"}</strong><button type="button" onClick={signOut} className={`mt-3 flex items-center gap-2 text-xs ${portal==="member"?"text-ink/65 hover:text-ink":"text-white/70 hover:text-white"}`}><LogOut size={14}/>ออกจากระบบ</button></div></>;
  return <div className={`v14-app v14-app--${portal} gisp-production ui-foundation`}><header className="v14-topbar"><Link href={portal==="member"?"/member/dashboard":"/admin/dashboard"} className="v14-brand"><span>GI</span><div><b>GISP</b><small>{portal==="member"?"MEMBER":"OPERATIONS"}</small></div></Link><div className="v14-topbar__right"><span className="v14-status v14-status--good">{context.userStatus}</span><button className="v14-icon-button" aria-label="การแจ้งเตือน" title="การแจ้งเตือน"><Bell size={17}/></button><button className="v14-icon-button lg:hidden" onClick={()=>setOpen(true)} aria-label="เปิดเมนู"><Menu size={18}/></button></div></header><aside className="v14-sidebar">{sidebar}</aside>{open&&<div className="v14-nav-scrim is-open fixed inset-0 z-50 bg-black/40 lg:hidden" onClick={()=>setOpen(false)}><aside className="v14-sidebar is-open !inset-y-0 !top-0 !flex !h-full" onClick={event=>event.stopPropagation()}><button type="button" onClick={()=>setOpen(false)} className="mb-4 ml-auto grid size-9 place-items-center" aria-label="ปิดเมนู"><X/></button>{sidebar}</aside></div>}<main className="v14-content">{children}</main></div>;
}

