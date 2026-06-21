"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveNoteAction } from "./actions";

type SaveState = "idle" | "saving" | "saved";

const COLORS = [
  { name: "Negre", value: "#1a1a1a" },
  { name: "Vermell", value: "#dc2626" },
  { name: "Taronja", value: "#ea580c" },
  { name: "Verd", value: "#16a34a" },
  { name: "Blau", value: "#2563eb" },
  { name: "Lila", value: "#7c3aed" },
];

export function NotesView({ initial }: { initial: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<SaveState>("idle");
  const [showColors, setShowColors] = useState(false);

  // Set the content ONCE, imperatively. The contentEditable is never managed by
  // React after this (no dangerouslySetInnerHTML), so re-renders never wipe it.
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initial || "";
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* older browsers */ }
  }, [initial]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = useCallback(() => {
    const html = ref.current?.innerHTML ?? "";
    setState("saving");
    saveNoteAction(html).then(() => setState("saved")).catch(() => setState("idle"));
  }, []);

  const scheduleSave = useCallback(() => {
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }, [save]);

  function exec(cmd: string, value?: string) {
    ref.current?.focus();
    document.execCommand(cmd, false, value);
    scheduleSave();
  }

  function insertCheckbox() {
    ref.current?.focus();
    document.execCommand("insertHTML", false, '<span class="chk" contenteditable="false" data-done="0">☐</span>&nbsp;');
    scheduleSave();
  }

  function onEditorClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el.classList?.contains("chk")) {
      const done = el.getAttribute("data-done") === "1";
      el.setAttribute("data-done", done ? "0" : "1");
      el.textContent = done ? "☐" : "☑";
      scheduleSave();
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-[var(--color-muted)]">Bloc de notes. Es desa automàticament.</p>
        </div>
        <span className="shrink-0 text-xs text-[var(--color-muted)] inline-flex items-center gap-1">
          {state === "saving" ? "Desant…" : state === "saved" ? (<><CheckIcon /> Desat</>) : ""}
        </span>
      </div>

      {/* Toolbar — sticky so it stays reachable on mobile while scrolling */}
      <div className="sticky top-0 z-10 -mx-3 flex flex-wrap items-center gap-1 border border-[var(--color-line)] bg-white/95 px-3 py-2 backdrop-blur sm:mx-0 sm:rounded-t-xl">
        <Group>
          <TBtn label="Títol gran" onClick={() => exec("formatBlock", "<h1>")}><span className="text-base font-bold">T1</span></TBtn>
          <TBtn label="Títol" onClick={() => exec("formatBlock", "<h2>")}><span className="font-bold">T2</span></TBtn>
          <TBtn label="Text normal" onClick={() => exec("formatBlock", "<p>")}>¶</TBtn>
        </Group>
        <Group>
          <TBtn label="Negreta" onClick={() => exec("bold")}><b>B</b></TBtn>
          <TBtn label="Cursiva" onClick={() => exec("italic")}><i>I</i></TBtn>
          <TBtn label="Subratllat" onClick={() => exec("underline")}><u>U</u></TBtn>
          <TBtn label="Ratllat" onClick={() => exec("strikeThrough")}><s>S</s></TBtn>
        </Group>
        <Group>
          <TBtn label="Llista" onClick={() => exec("insertUnorderedList")}>•</TBtn>
          <TBtn label="Llista numerada" onClick={() => exec("insertOrderedList")}>1.</TBtn>
          <TBtn label="Casella" onClick={insertCheckbox}>☐</TBtn>
        </Group>
        <Group>
          <div className="relative">
            <TBtn label="Color del text" onClick={() => setShowColors((v) => !v)}>
              <span className="text-base">A</span>
              <span className="ml-0.5 inline-block h-1 w-3 rounded-sm" style={{ background: "linear-gradient(90deg,#dc2626,#2563eb,#16a34a)" }} />
            </TBtn>
            {showColors && (
              <div className="absolute left-0 top-10 z-20 flex gap-1.5 rounded-lg border border-[var(--color-line)] bg-white p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
                {COLORS.map((c) => (
                  <button key={c.value} type="button" title={c.name} className="h-6 w-6 rounded-full border border-[var(--color-line)]" style={{ backgroundColor: c.value }} onClick={() => { exec("foreColor", c.value); setShowColors(false); }} />
                ))}
              </div>
            )}
          </div>
          <TBtn label="Subratllat groc" onClick={() => exec("hiliteColor", "#fef08a")}><span className="rounded-sm bg-[#fef08a] px-1">H</span></TBtn>
        </Group>
        <Group>
          <TBtn label="Treure format" onClick={() => exec("removeFormat")}>✕</TBtn>
        </Group>
      </div>

      <div
        ref={ref}
        className="note-editor min-h-[60vh] rounded-b-xl border border-t-0 border-[var(--color-line)] bg-white px-4 py-4 text-[16px] leading-relaxed shadow-sm focus:outline-none sm:px-6"
        contentEditable
        suppressContentEditableWarning
        onInput={scheduleSave}
        onBlur={save}
        onClick={onEditorClick}
        data-placeholder="Comença a escriure les teves notes…"
      />
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 border-r border-[var(--color-line)] pr-1.5 mr-1 last:border-r-0 last:mr-0 last:pr-0">{children}</div>;
}

function TBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
  );
}
