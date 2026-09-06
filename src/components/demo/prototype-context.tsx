"use client";

import { createContext, use, useEffect, useMemo, useReducer, useRef } from "react";
import {
  createPrototypeState,
  PROTOTYPE_STORAGE_KEY,
  prototypeReducer,
  type PrototypeAction,
  type PrototypeState,
} from "@/demo";

type PrototypeContextValue = {
  state: PrototypeState;
  act: (action: PrototypeAction extends infer T ? T extends PrototypeAction ? Omit<T, "at"> : never : never) => void;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(prototypeReducer, undefined, createPrototypeState);
  const skipFirstWrite = useRef(true);

  useEffect(() => {
    const raw = window.localStorage.getItem(PROTOTYPE_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PrototypeState;
      window.requestAnimationFrame(() =>
        dispatch({ type: "HYDRATE", state: parsed, at: new Date().toISOString() }),
      );
    } catch {
      window.localStorage.removeItem(PROTOTYPE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    window.localStorage.setItem(PROTOTYPE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo<PrototypeContextValue>(
    () => ({
      state,
      act: (action) => dispatch({ ...action, at: new Date().toISOString() } as PrototypeAction),
    }),
    [state],
  );

  return <PrototypeContext value={value}>{children}</PrototypeContext>;
}

export function usePrototype() {
  const value = use(PrototypeContext);
  if (!value) throw new Error("usePrototype must be used inside PrototypeProvider");
  return value;
}
