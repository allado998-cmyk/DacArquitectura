import { z } from "zod";
import { sql } from "@/lib/db";
import { createNoteAction, updateNoteAction } from "@/app/notes/actions";
import { id, longText, registerAction, shortText, stripHtml, type Plan } from "../core";
import { callAction } from "../shared";

interface NoteRow {
  id: number;
  title: string;
  content: string;
  updated: string;
}

async function getNote(idv: number): Promise<NoteRow | null> {
  const rows = (await sql`select id, title, content, to_char(updated_at,'YYYY-MM-DD HH24:MI') as updated from public.notes where id = ${idv}`) as NoteRow[];
  return rows[0] ?? null;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
}

// The notes editor stores HTML. Plain text from the chat becomes paragraphs.
function toHtml(text: string): string {
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// Reads -----------------------------------------------------------------------

registerAction({
  kind: "read",
  name: "list_notes",
  domain: "notes",
  description: "Notes del bloc de notes amb títol, data i un extracte.",
  schema: z.object({ q: shortText.optional() }),
  async run(a) {
    const like = a.q ? `%${a.q.trim()}%` : null;
    const rows = (await sql`
      select id, title, content, to_char(updated_at,'YYYY-MM-DD HH24:MI') as updated from public.notes
      where ${like}::text is null or title ilike ${like} or content ilike ${like}
      order by updated_at desc, id desc`) as NoteRow[];
    return { notes: rows.map((n) => ({ id: n.id, title: n.title, updated: n.updated, extracte: stripHtml(n.content, 160) })) };
  },
});

registerAction({
  kind: "read",
  name: "get_note",
  domain: "notes",
  description: "Contingut d'una nota (text pla, sense format).",
  schema: z.object({ id }),
  async run(a) {
    const n = await getNote(a.id);
    if (!n) return { error: `No hi ha cap nota amb id ${a.id}.` };
    return { id: n.id, title: n.title, updated: n.updated, text: stripHtml(n.content, 20000) };
  },
});

// Changes ---------------------------------------------------------------------

registerAction({
  kind: "change",
  name: "create_note",
  domain: "notes",
  description: "Crea una nota amb títol i contingut (text pla; els paràgrafs es conserven).",
  schema: z.object({ title: shortText.min(1), content: longText.optional() }),
  async plan(a): Promise<Plan> {
    return { summary: `Crear la nota «${a.title}»${a.content ? ` (${a.content.length} caràcters)` : ""}.`, details: { title: a.title, content: a.content?.slice(0, 500) } };
  },
  async commit(a) {
    const r = await callAction(() => createNoteAction());
    const newId = r.value;
    if (!newId) throw new Error("No s'ha pogut crear la nota.");
    await callAction(() => updateNoteAction(newId, { title: a.title, content: a.content ? toHtml(a.content) : "" }));
    return { id: newId, title: a.title, url: "/notes" };
  },
});

registerAction({
  kind: "change",
  name: "update_note",
  domain: "notes",
  description: "Canvia el títol d'una nota, substitueix el contingut (content) o hi afegeix text al final (append).",
  schema: z.object({ id, title: shortText.optional(), content: longText.optional(), append: longText.optional() }),
  async plan(a): Promise<Plan> {
    const n = await getNote(a.id);
    if (!n) return { summary: "Modificar nota", errors: [`No hi ha cap nota amb id ${a.id}.`] };
    const errors: string[] = [];
    if (a.title === undefined && a.content === undefined && a.append === undefined) errors.push("No s'ha indicat cap canvi.");
    if (a.content !== undefined && a.append !== undefined) errors.push("Indica content o append, no tots dos.");
    const warnings = a.content !== undefined ? ["Es substituirà tot el contingut actual de la nota."] : [];
    return {
      summary: `Modificar la nota «${n.title}»: ${[a.title !== undefined && "títol", a.content !== undefined && "contingut", a.append !== undefined && "afegir text"].filter(Boolean).join(", ")}.`,
      details: { actual: stripHtml(n.content, 300), title: a.title, content: a.content?.slice(0, 500), append: a.append?.slice(0, 500) },
      errors,
      warnings,
    };
  },
  async commit(a) {
    const n = await getNote(a.id);
    if (!n) throw new Error("Nota no trobada.");
    const patch: { title?: string; content?: string } = {};
    if (a.title !== undefined) patch.title = a.title;
    if (a.content !== undefined) patch.content = toHtml(a.content);
    else if (a.append !== undefined) patch.content = `${n.content}${toHtml(a.append)}`;
    await callAction(() => updateNoteAction(a.id, patch));
    const saved = await getNote(a.id);
    return saved ? { id: saved.id, title: saved.title, text: stripHtml(saved.content, 500) } : { id: a.id };
  },
});
