"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createNoteAction, deleteNoteAction, updateNoteAction } from "./actions";

export interface NoteItem {
  id: number;
  title: string;
  content: string;
  updated: string;
}

const COLORS = [
  { name: "Negre", value: "#1a1a1a" },
  { name: "Vermell", value: "#dc2626" },
  { name: "Taronja", value: "#ea580c" },
  { name: "Verd", value: "#16a34a" },
  { name: "Blau", value: "#2563eb" },
  { name: "Lila", value: "#7c3aed" },
];

// Memoised editor: only re-renders if its (stable) props change, so toolbar /
// status / list re-renders never reconcile (wipe) the contentEditable DOM.
const Editor = memo(function Editor({
  editorRef,
  initial,
  onInput,
  onBlur,
  onClick,
  onSelect,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  initial: string;
  onInput: () => void;
  onBlur: () => void;
  onClick: (e: React.MouseEvent) => void;
  onSelect: () => void;
}) {
  useEffect(() => {
    const el = editorRef.current;
    if (el) el.innerHTML = initial || "";
  }, [editorRef, initial]);

  return (
    <div
      ref={editorRef}
      className="note-editor flex-1 overflow-auto px-4 py-4 text-[16px] leading-relaxed focus:outline-none sm:px-6"
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onBlur={onBlur}
      onClick={onClick}
      onKeyUp={onSelect}
      onMouseUp={onSelect}
      data-placeholder="Comença a escriure…"
    />
  );
});

export function NotesApp({ initialNotes }: { initialNotes: NoteItem[] }) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [selectedId, setSelectedId] = useState<number | null>(initialNotes[0]?.id ?? null);
  const [mobileView, setMobileView] = useState<"list" | "editor">("list");
  const [showColors, setShowColors] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const setStatus = useCallback((t: string) => { if (statusRef.current) statusRef.current.textContent = t; }, []);

  useEffect(() => {
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* older */ }
    return () => {
      if (contentTimer.current) clearTimeout(contentTimer.current);
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, []);

  // Reflect the current selection's formatting in the toolbar.
  const refreshActive = useCallback(() => {
    const sel = document.getSelection();
    const ed = editorRef.current;
    if (!ed || !sel || sel.rangeCount === 0 || !ed.contains(sel.anchorNode)) return;
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
      insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      insertOrderedList: document.queryCommandState("insertOrderedList"),
    });
    let b = "";
    try { b = (document.queryCommandValue("formatBlock") || "").toLowerCase(); } catch { /* */ }
    setBlock(b);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const persist = useCallback((id: number, patch: { title?: string; content?: string }) => {
    updateNoteAction(id, patch).then(() => setStatus("Desat ✓")).catch(() => setStatus("No s'ha pogut desar"));
  }, [setStatus]);

  const scheduleSave = useCallback(() => {
    const id = selectedId;
    if (id == null) return;
    setStatus("Desant…");
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => persist(id, { content: editorRef.current?.innerHTML ?? "" }), 700);
  }, [selectedId, persist, setStatus]);

  const saveNow = useCallback(() => {
    const id = selectedId;
    if (id == null) return;
    if (contentTimer.current) { clearTimeout(contentTimer.current); contentTimer.current = null; }
    persist(id, { content: editorRef.current?.innerHTML ?? "" });
  }, [selectedId, persist]);

  // Save current note's content to local state + server before switching away.
  const flush = useCallback(() => {
    const id = selectedId;
    const ed = editorRef.current;
    if (id == null || !ed) return;
    if (contentTimer.current) { clearTimeout(contentTimer.current); contentTimer.current = null; }
    const html = ed.innerHTML;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content: html } : n)));
    persist(id, { content: html });
  }, [selectedId, persist]);

  function selectNote(id: number) {
    if (id === selectedId) { setMobileView("editor"); return; }
    flush();
    setSelectedId(id);
    setMobileView("editor");
  }

  async function createNote() {
    flush();
    setStatus("Creant…");
    const id = await createNoteAction();
    if (!id) return;
    const today = new Date().toLocaleDateString("ca-ES");
    setNotes((prev) => [{ id, title: "Nota nova", content: "", updated: today }, ...prev]);
    setSelectedId(id);
    setMobileView("editor");
    setStatus("Desat ✓");
  }

  function removeNote(id: number) {
    if (!confirm("Eliminar aquesta nota?")) return;
    deleteNoteAction(id);
    setNotes((prev) => {
      const rest = prev.filter((n) => n.id !== id);
      if (id === selectedId) setSelectedId(rest[0]?.id ?? null);
      return rest;
    });
  }

  function renameNote(value: string) {
    const id = selectedId;
    if (id == null) return;
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title: value } : n)));
    setStatus("Desant…");
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => persist(id, { title: value }), 600);
  }

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    refreshActive();
    scheduleSave();
  }, [refreshActive, scheduleSave]);

  const insertCheckbox = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, '<span class="chk" contenteditable="false" data-done="0">☐</span>&nbsp;');
    scheduleSave();
  }, [scheduleSave]);

  const onEditorClick = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.classList?.contains("chk")) {
      const done = el.getAttribute("data-done") === "1";
      el.setAttribute("data-done", done ? "0" : "1");
      el.textContent = done ? "☐" : "☑";
      scheduleSave();
    }
  }, [scheduleSave]);

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[420px] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-sm">
      {/* Sidebar */}
      <aside className={`w-full shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-paper)] sm:flex sm:w-72 ${mobileView === "editor" ? "hidden sm:flex" : "flex"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-line)] px-3 py-2.5">
          <span className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">Notes</span>
          <button type="button" className="btn-primary px-2.5 py-1 text-sm" onClick={createNote}>+ Nova</button>
        </div>
        <div className="flex-1 overflow-auto">
          {notes.length === 0 ? (
            <p className="p-4 text-sm text-[var(--color-muted)]">Cap nota encara. Crea&apos;n una.</p>
          ) : (
            notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => selectNote(n.id)}
                className={`block w-full border-b border-[var(--color-line)] px-3 py-2.5 text-left transition ${n.id === selectedId ? "bg-[var(--color-accent-soft)]" : "hover:bg-white"}`}
              >
                <div className="truncate text-sm font-medium text-[var(--color-ink)]">{n.title || "Sense títol"}</div>
                <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">{textPreview(n.content) || n.updated}</div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Editor pane */}
      <section className={`min-w-0 flex-1 flex-col ${mobileView === "list" ? "hidden sm:flex" : "flex"}`}>
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-2 py-2">
              <button type="button" className="btn-ghost px-2 py-1 sm:hidden" onClick={() => setMobileView("list")} aria-label="Tornar a la llista">←</button>
              <input
                className="min-w-0 flex-1 bg-transparent px-1 text-lg font-semibold focus:outline-none"
                value={selected.title}
                onChange={(e) => renameNote(e.target.value)}
                placeholder="Títol de la nota"
              />
              <span ref={statusRef} className="shrink-0 text-xs text-[var(--color-muted)]" />
              <button type="button" className="shrink-0 px-2 text-sm text-red-700 hover:underline" onClick={() => removeNote(selected.id)}>Eliminar</button>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-line)] bg-white px-2 py-1.5">
              <Group>
                <TBtn label="Títol gran" active={block === "h1"} onClick={() => exec("formatBlock", "<h1>")}><span className="text-base font-bold">T1</span></TBtn>
                <TBtn label="Títol" active={block === "h2"} onClick={() => exec("formatBlock", "<h2>")}><span className="font-bold">T2</span></TBtn>
                <TBtn label="Text normal" active={block === "p" || block === "div" || block === ""} onClick={() => exec("formatBlock", "<p>")}>¶</TBtn>
              </Group>
              <Group>
                <TBtn label="Negreta" active={active.bold} onClick={() => exec("bold")}><b>B</b></TBtn>
                <TBtn label="Cursiva" active={active.italic} onClick={() => exec("italic")}><i>I</i></TBtn>
                <TBtn label="Subratllat" active={active.underline} onClick={() => exec("underline")}><u>U</u></TBtn>
                <TBtn label="Ratllat" active={active.strikeThrough} onClick={() => exec("strikeThrough")}><s>S</s></TBtn>
              </Group>
              <Group>
                <TBtn label="Llista" active={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")}>•</TBtn>
                <TBtn label="Llista numerada" active={active.insertOrderedList} onClick={() => exec("insertOrderedList")}>1.</TBtn>
                <TBtn label="Casella" onClick={insertCheckbox}>☐</TBtn>
              </Group>
              <Group>
                <div className="relative">
                  <TBtn label="Color del text" onClick={() => setShowColors((v) => !v)}>
                    <span className="text-base">A</span>
                    <span className="ml-0.5 inline-block h-1 w-3 rounded-sm" style={{ background: "linear-gradient(90deg,#dc2626,#2563eb,#16a34a)" }} />
                  </TBtn>
                  {showColors && (
                    <div className="absolute left-0 top-10 z-30 flex gap-1.5 rounded-lg border border-[var(--color-line)] bg-white p-2 shadow-lg" onMouseDown={(e) => e.preventDefault()}>
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

            <Editor key={selected.id} editorRef={editorRef} initial={selected.content} onInput={scheduleSave} onBlur={saveNow} onClick={onEditorClick} onSelect={refreshActive} />
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-[var(--color-muted)]">
            <div>
              <p>No hi ha cap nota seleccionada.</p>
              <button type="button" className="btn-primary mt-3" onClick={createNote}>+ Crear una nota</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function textPreview(html: string) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 60);
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 border-r border-[var(--color-line)] pr-1.5 mr-1 last:mr-0 last:border-r-0 last:pr-0">{children}</div>;
}

function TBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm ${active ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"}`}
    >
      {children}
    </button>
  );
}
