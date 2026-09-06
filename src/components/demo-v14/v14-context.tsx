"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { createV14State, V14_STORAGE_KEY, v14Reducer, type V14Action, type V14State, type WorkflowActionInput } from "@/demo";
import type { DemoRole } from "@/demo/types";

type WithoutAt<T> = T extends unknown ? Omit<T, "at"> : never;

type V14ContextValue = {
  state: V14State;
  act: (action: WithoutAt<V14Action>) => void;
  run: (actor: DemoRole, action: WorkflowActionInput) => void;
};

const V14Context = createContext<V14ContextValue | null>(null);

export function V14Provider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(v14Reducer, undefined, createV14State);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(V14_STORAGE_KEY);
    if (!raw) {
      queueMicrotask(() => setStorageReady(true));
      return;
    }
    try {
      const parsed = JSON.parse(raw) as V14State;
      dispatch({ type: "HYDRATE_V14", state: parsed, at: new Date().toISOString() });
    } catch {
      window.localStorage.removeItem(V14_STORAGE_KEY);
    } finally {
      queueMicrotask(() => setStorageReady(true));
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(V14_STORAGE_KEY, JSON.stringify(state));
  }, [state, storageReady]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== V14_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as V14State;
        if (parsed.revision !== state.revision) {
          dispatch({ type: "HYDRATE_V14", state: parsed, at: new Date().toISOString() });
        }
      } catch {
        // Ignore malformed browser-local demo state.
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [state.revision]);

  const act = useCallback((action: WithoutAt<V14Action>) => {
    dispatch({ ...action, at: new Date().toISOString() } as V14Action);
  }, []);

  const run = useCallback((actor: DemoRole, action: WorkflowActionInput) => {
    dispatch({ type: "RUN_WORKFLOW", actor, action, at: new Date().toISOString() });
  }, []);

  const value = useMemo(() => ({ state, act, run }), [state, act, run]);
  return (
    <V14Context.Provider value={value}>
      {storageReady ? children : <main className="v14-loading" aria-live="polite">กำลังเปิด Riverstone Demo 1.4…</main>}
    </V14Context.Provider>
  );
}

export function useV14() {
  const value = useContext(V14Context);
  if (!value) throw new Error("useV14 must be used inside V14Provider");
  return value;
}
