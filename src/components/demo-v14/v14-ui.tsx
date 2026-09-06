"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Menu, RotateCcw, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useV14 } from "./v14-context";

export const baht = (value: string | number | undefined) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value ?? 0));

export function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  return <span className={`v14-status v14-status--${tone}`}>{children}</span>;
}

export function Panel({ eyebrow, title, action, children, className = "" }: { eyebrow?: string; title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`v14-panel ${className}`}>
      <div className="v14-panel__head">
        <div>{eyebrow ? <p className="v14-eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="v14-metric"><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="v14-empty">{children}</div>;
}

export type NavItem = { key: string; label: string; icon: LucideIcon; locked?: boolean };

export function PortalShell({ kind, title, subtitle, screen, nav, children, topRight }: { kind: "member" | "admin"; title: string; subtitle: string; screen: string; nav: NavItem[]; children: ReactNode; topRight?: ReactNode }) {
  const { state, act } = useV14();
  const [menuOpen, setMenuOpen] = useState(false);
  const base = `/v1-4/${kind}`;
  return (
    <main className={`v14-app v14-app--${kind}`}>
      <header className="v14-topbar">
        <Link href="/v1-4" className="v14-brand" aria-label="กลับหน้า Demo 1.4"><span>GI</span><div><b>GISP</b><small>{kind === "member" ? "MEMBER APPLICATION" : "BACK OFFICE"}</small></div></Link>
        <div className="v14-topbar__right"><span className="v14-demo-stamp">DEMO 1.4</span>{topRight}<button className="v14-icon-button" aria-label="รีเซ็ต Demo 1.4" title="รีเซ็ต Demo 1.4" onClick={() => act({ type: "RESET_V14" })}><RotateCcw size={17} /></button><button className="v14-icon-button v14-menu-button" aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={19}/> : <Menu size={19}/>}</button></div>
      </header>
      <button className={`v14-nav-scrim ${menuOpen ? "is-open" : ""}`} aria-label="ปิดเมนู" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)}/>
      <aside className={`v14-sidebar ${menuOpen ? "is-open" : ""}`}>
        <div className="v14-side-intro"><span>{kind === "member" ? "RIVERSTONE PROJECT" : "GISP OPERATIONS"}</span><strong>{title}</strong><small>{subtitle}</small></div>
        <nav aria-label={kind === "member" ? "เมนู Member" : "เมนู Back Office"}>
          {nav.map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} href={`${base}?screen=${item.key}`} onClick={() => setMenuOpen(false)} aria-current={screen === item.key ? "page" : undefined} className={`${screen === item.key ? "active" : ""} ${item.locked ? "locked" : ""}`}><Icon size={17}/><span>{item.label}</span>{item.locked ? <small>LOCKED</small> : null}</Link>;
          })}
        </nav>
        <div className="v14-side-foot"><span>Shared browser state</span><strong>Revision {state.revision}</strong><small>Refresh แล้วข้อมูลยังอยู่</small></div>
      </aside>
      <div className="v14-content">
        {state.lastError ? <div className="v14-alert" role="alert"><b>ยังทำรายการไม่ได้</b><span>{state.lastError}</span></div> : null}
        {children}
      </div>
    </main>
  );
}

export function PageHero({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="v14-hero"><div><p className="v14-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

export function Handoff({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="v14-button v14-button--dark" target="_blank">{label}<ArrowRight size={16}/></Link>;
}
