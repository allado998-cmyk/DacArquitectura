"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type ClientOpt = { id: number; nom: string; ciutat: string | null };

// The acta's «Client»: a dropdown of the clients of Base de Dades with a search,
// as the studio asked. Typing filters by name or city; ↑ ↓ and Enter pick one.
// The field stays free text, so a client who isn't in Base de Dades can still be written.
export function ClientPicker({
  id,
  value,
  clients,
  onChange,
  onCommit,
}: {
  id?: string;
  value: string;
  clients: ClientOpt[];
  onChange: (v: string) => void; // every keystroke
  onCommit: (v: string) => void; // a client picked from the list, or the field left
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(""); // "" right after opening: every client
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const sorted = useMemo(() => [...clients].sort((a, b) => a.nom.localeCompare(b.nom, "ca")), [clients]);
  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ca");
    return q ? sorted.filter((c) => `${c.nom} ${c.ciutat ?? ""}`.toLocaleLowerCase("ca").includes(q)) : sorted;
  }, [sorted, query]);

  // Keep the highlighted client in sight while moving with the arrows.
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    setQuery("");
    const current = sorted.findIndex((c) => c.nom === value.trim());
    setActive(current >= 0 ? current : 0);
    setOpen(true);
  }
  function pick(c: ClientOpt) {
    onChange(c.nom);
    onCommit(c.nom);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        className="input pr-9"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Tria o cerca un client…"
        value={value}
        onFocus={openList}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) openList();
            else setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => {
          setOpen(false);
          onCommit(inputRef.current?.value ?? value);
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Mostrar els clients"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (open) setOpen(false);
          else if (document.activeElement === inputRef.current) openList();
          else inputRef.current?.focus();
        }}
      >
        ▾
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Clients"
          className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-auto rounded-md border border-[var(--color-line)] bg-white py-1 text-sm shadow-lg"
          onMouseDown={(e) => e.preventDefault()} // its scrollbar must not take the focus (that would close it)
        >
          {matches.length === 0 && (
            <li className="px-3 py-1.5 text-[var(--color-muted)]">Cap client amb aquest nom a Base de Dades: es desarà tal com l&apos;has escrit.</li>
          )}
          {matches.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-[var(--color-accent-soft)]" : ""} ${c.nom === value.trim() ? "font-medium text-[var(--color-accent)]" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(c)}
            >
              {c.nom}
              {c.ciutat && <span className="text-xs font-normal text-[var(--color-muted)]"> · {c.ciutat}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
