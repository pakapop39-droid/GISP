import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { OnboardingForm } from "@/components/onboarding-form";
import { accessHome, readAppAccessContext } from "@/lib/auth/session";
import { createInsForgeServerClient } from "@/lib/insforge/server";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const context=await readAppAccessContext(); if(!context)redirect("/login");
  const query=await searchParams; const editing=query.edit==="1"&&context.applicationStatus==="REJECTED";
  if(context.memberProfileId&&!editing)redirect(accessHome(context));
  let initial:Record<string,string|string[]|boolean>={};
  if(editing){const insforge=await createInsForgeServerClient();const {data}=await insforge.database.from("member_profiles").select("*").eq("user_id",context.userId).maybeSingle();initial=(data??{}) as Record<string,string|string[]|boolean>}
  return <main className="ui-onboarding paper-grid min-h-screen bg-porcelain px-6 py-8"><div className="mx-auto max-w-3xl"><BrandMark/><section className="ui-onboarding__card mt-12 rounded-[32px] border border-ink/10 bg-[#fcfaf4] p-7 shadow-paper sm:p-10"><span className="grid size-12 place-items-center rounded-2xl bg-jade text-white"><ShieldCheck size={20}/></span><p className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-jade">Member onboarding</p><h1 className="mt-2 font-display text-4xl font-semibold">{editing?"แก้ข้อมูลและส่งใหม่":"ข้อมูลบริษัทของคุณ"}</h1><p className="mt-3 text-sm leading-6 text-ink/55">ข้อมูลจริงจะเชื่อมกับ Member Profile เดียวของบัญชีนี้</p><OnboardingForm defaultName={context.displayName??undefined} initial={initial}/></section></div></main>;
}
