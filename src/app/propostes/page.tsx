import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { createPropostaDocAction } from "./actions";
import { PropostesListView } from "./propostes-list-view";
import type { PropostaDoc } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function PropostesPage() {
  await requireUser();

  const rows = (await sql`
    select id, num, to_char(data, 'YYYY-MM-DD') as data, descripcio, adreca, ciutat, estat, created_at, updated_at
    from public.proposta_doc
    order by num desc nulls last, id desc
  `) as unknown as PropostaDoc[];

  return (
    <>
      <AppNav current="propostes" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Propostes</h1>
            <p className="text-sm text-[var(--color-muted)]">Propostes d&apos;honoraris per al client.</p>
          </div>
          <form action={createPropostaDocAction}>
            <button className="btn-primary" type="submit">Nova proposta</button>
          </form>
        </div>

        <PropostesListView rows={rows} />
      </main>
    </>
  );
}
