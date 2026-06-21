import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { NotesView } from "./notes-view";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  await requireUser();
  const rows = (await sql`select content from public.note where id = 1`) as { content: string }[];
  const content = rows[0]?.content ?? "";

  return (
    <>
      <AppNav current="notes" />
      <main className="mx-auto w-full max-w-4xl px-3 sm:px-6 py-4 sm:py-8">
        <NotesView initial={content} />
      </main>
    </>
  );
}
