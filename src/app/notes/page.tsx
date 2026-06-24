import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { NotesApp, type NoteItem } from "./notes-view";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  await requireUser();
  const notes = (await sql`
    select id, title, content, to_char(updated_at, 'DD/MM/YYYY') as updated
    from public.notes
    order by updated_at desc, id desc
  `) as unknown as NoteItem[];

  return (
    <>
      <AppNav current="notes" />
      <main className="mx-auto w-full max-w-6xl px-3 sm:px-6 py-4 sm:py-6">
        <NotesApp initialNotes={notes} />
      </main>
    </>
  );
}
