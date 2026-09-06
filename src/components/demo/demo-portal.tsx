"use client";

import { useEffect, useState } from "react";
import { DemoExperience } from "./demo-experience";
import { DemoLauncher } from "./demo-launcher";
import { PrototypeProvider } from "./prototype-context";
import { PrototypeWorkspace } from "./prototype-workspace";

type Mode = "launcher" | "overview" | "prototype";

function readMode(): Mode {
  if (typeof window === "undefined") return "launcher";
  const mode = new URLSearchParams(window.location.search).get("mode");
  return mode === "overview" || mode === "prototype" ? mode : "launcher";
}

export function DemoPortal() {
  const [mode, setMode] = useState<Mode>("launcher");

  useEffect(() => {
    window.requestAnimationFrame(() => setMode(readMode()));
    const onPopState = () => setMode(readMode());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = (next: Mode) => {
    const url = next === "launcher" ? window.location.pathname : `${window.location.pathname}?mode=${next}`;
    window.history.pushState({}, "", url);
    setMode(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (mode === "overview") return <div><button type="button" onClick={() => navigate("launcher")} className="fixed bottom-4 right-4 z-[70] rounded-full bg-ink px-4 py-3 text-xs font-bold text-white shadow-xl">เปลี่ยนโหมด</button><DemoExperience /></div>;
  if (mode === "prototype") return <PrototypeProvider><PrototypeWorkspace onExit={() => navigate("launcher")} /></PrototypeProvider>;
  return <DemoLauncher onSelect={navigate} />;
}

