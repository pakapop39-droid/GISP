"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 350;

/**
 * แสดงสถานะการทำงานส่วนกลางสำหรับ request จาก browser และการเปลี่ยนหน้าภายในแอป
 * หน่วงการแสดงเล็กน้อยเพื่อไม่ให้หน้าจอกะพริบในงานที่เสร็จเร็วมาก
 */
export function GlobalActivityIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const pendingCount = useRef(0);
  const navigationPending = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleSince = useRef(0);

  useEffect(() => {
    const clearTimer = (timer: typeof showTimer) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const hasPendingWork = () => pendingCount.current > 0 || navigationPending.current;

    const requestShow = () => {
      clearTimer(hideTimer);
      if (visibleRef.current || showTimer.current) return;

      showTimer.current = setTimeout(() => {
        showTimer.current = null;
        if (!hasPendingWork()) return;
        visibleSince.current = Date.now();
        visibleRef.current = true;
        setVisible(true);
      }, SHOW_DELAY_MS);
    };

    const requestHide = () => {
      if (hasPendingWork()) return;
      clearTimer(showTimer);

      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - visibleSince.current));
      clearTimer(hideTimer);
      hideTimer.current = setTimeout(() => {
        hideTimer.current = null;
        if (!hasPendingWork()) {
          visibleRef.current = false;
          setVisible(false);
        }
      }, remaining);
    };

    const originalFetch = window.fetch.bind(window);
    const trackedFetch: typeof window.fetch = async (...args) => {
      pendingCount.current += 1;
      requestShow();
      try {
        return await originalFetch(...args);
      } finally {
        pendingCount.current = Math.max(0, pendingCount.current - 1);
        requestHide();
      }
    };
    window.fetch = trackedFetch;

    const trackNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) return;

      navigationPending.current = true;
      requestShow();
    };

    const finishNavigation = () => {
      navigationPending.current = false;
      requestHide();
    };

    document.addEventListener("click", trackNavigation, true);
    window.addEventListener("gisp:navigation-complete", finishNavigation);

    return () => {
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
      document.removeEventListener("click", trackNavigation, true);
      window.removeEventListener("gisp:navigation-complete", finishNavigation);
      clearTimer(showTimer);
      clearTimer(hideTimer);
    };
  }, []);

  useEffect(() => {
    window.dispatchEvent(new Event("gisp:navigation-complete"));
  }, [locationKey]);

  return (
    <div
      className={`global-activity ${visible ? "global-activity--visible" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span className="global-activity__bar" />
      <span className="global-activity__message">
        <span className="global-activity__spinner" aria-hidden="true">
          <LoaderCircle size={18} />
        </span>
        กำลังดำเนินการ…
      </span>
    </div>
  );
}
