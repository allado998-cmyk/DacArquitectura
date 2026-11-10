"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Cataleg } from "@/lib/ite/cataleg";
import type { IteObj } from "@/lib/ite/xml";

export interface IteCtx {
  iteId: number;
  doc: IteObj;
  // Always applied to the latest report (uploads finish in any order).
  update: (fn: (d: IteObj) => IteObj) => void;
  cataleg: Cataleg;
}

export const IteContext = createContext<IteCtx | null>(null);

export function useIte(): IteCtx {
  const c = useContext(IteContext);
  if (!c) throw new Error("useIte outside IteContext");
  return c;
}

// A text box that keeps what is being typed and stores it when the box is
// left (and, for long texts, after a pause), so trailing spaces, half-typed
// numbers like "18," and fast typing all behave.
export function useDraft(value: string, commit: (v: string) => void, idleMs = 0) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return {
    value: draft,
    onFocus: () => { focused.current = true; },
    onChange: (v: string) => {
      setDraft(v);
      if (idleMs > 0) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(v), idleMs);
      }
    },
    onBlur: () => {
      focused.current = false;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (draft !== value) commit(draft);
    },
  };
}
