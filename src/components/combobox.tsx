"use client";

import { useEffect, useRef, useState } from "react";

export interface ComboOption {
  id: number;
  label: string;
  sub?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Cerca…",
  emptyLabel = "—",
  allowEmpty = true,
}: {
  options: ComboOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) => o.label.toLowerCase().includes(q) || (o.sub ?? "").toLowerCase().includes(q),
      )
    : options;

  function pick(id: number | null) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`truncate ${selected ? "" : "text-[var(--color-muted)]"}`}>
          {selected ? selected.label : emptyLabel}
        </span>
        <span className="text-[var(--color-muted)] text-xs">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-56 rounded-md border border-[var(--color-line)] bg-white shadow-lg">
          <div className="border-b border-[var(--color-line)] p-2">
            <input
              autoFocus
              className="input"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1 text-sm">
            {allowEmpty && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-[var(--color-muted)] hover:bg-[var(--color-accent-soft)]"
                  onClick={() => pick(null)}
                >
                  {emptyLabel}
                </button>
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className={`flex w-full flex-col px-3 py-1.5 text-left hover:bg-[var(--color-accent-soft)] ${
                    o.id === value ? "font-medium text-[var(--color-accent)]" : ""
                  }`}
                  onClick={() => pick(o.id)}
                >
                  <span>{o.label}</span>
                  {o.sub && <span className="text-xs text-[var(--color-muted)]">{o.sub}</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-1.5 text-[var(--color-muted)]">Cap resultat.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
