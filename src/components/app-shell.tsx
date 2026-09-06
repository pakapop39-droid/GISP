"use client";

import { Bell, ChevronDown, LogOut, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { appModules } from "@/config/modules";
import { BrandMark } from "@/components/brand-mark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const navigation = (
    <>
      <div className="mb-8 flex items-center justify-between">
        <BrandMark />
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden"
          aria-label="ปิดเมนู"
        >
          <X size={20} />
        </button>
      </div>
      <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-ink/35">
        Workflow
      </p>
      <nav className="space-y-1">
        {appModules.map((module) => {
          const active = pathname === `/${module.slug}`;
          const Icon = module.icon;
          return (
            <Link
              key={module.slug}
              href={`/${module.slug}`}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-ink text-porcelain shadow-lg shadow-black/10"
                  : "text-ink/58 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span className="flex-1">{module.label}</span>
              <span
                className={`text-[9px] tracking-widest ${
                  active ? "text-porcelain/50" : "text-ink/25"
                }`}
              >
                {module.order}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink/50 transition hover:bg-lacquer/8 hover:text-lacquer"
        >
          <LogOut size={17} />
          ออกจากระบบ
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-porcelain text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-ink/8 bg-[#f8f5ed] px-5 py-6 lg:flex">
        {navigation}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-ink/35 backdrop-blur-sm lg:hidden">
          <aside className="flex h-full w-[86%] max-w-sm flex-col bg-[#f8f5ed] px-5 py-6 shadow-2xl">
            {navigation}
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-ink/8 bg-porcelain/90 px-5 backdrop-blur-xl sm:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-ink/10 lg:hidden"
            aria-label="เปิดเมนู"
          >
            <Menu size={20} />
          </button>
          <div className="relative hidden max-w-lg flex-1 md:block">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/35"
            />
            <input
              aria-label="ค้นหา"
              placeholder="ค้นหาโครงการ ออเดอร์ หรือเลขเอกสาร"
              className="h-11 w-full rounded-full border border-ink/8 bg-white/70 pl-11 pr-4 text-sm outline-none transition placeholder:text-ink/30 focus:border-jade/40 focus:ring-4 focus:ring-jade/8"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="relative grid size-10 place-items-center rounded-full border border-ink/8 bg-white"
              aria-label="การแจ้งเตือน"
            >
              <Bell size={17} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-lacquer" />
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-ink/8 bg-white py-1.5 pl-1.5 pr-3"
            >
              <span className="grid size-8 place-items-center rounded-full bg-jade text-xs font-bold text-white">
                GI
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-bold">GISP Admin</span>
                <span className="block text-[10px] text-ink/40">Workspace</span>
              </span>
              <ChevronDown size={14} className="text-ink/35" />
            </button>
          </div>
        </header>
        <main className="px-5 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
