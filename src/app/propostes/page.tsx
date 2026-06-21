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
    select d.id, d.num, to_char(d.data, 'YYYY-MM-DD') as data, d.descripcio, d.adreca, d.ciutat,
           d.codi_postal, d.client_id, d.calcul_id, d.estat, d.created_at, d.updated_at,
           c.nom as client_nom,
           coalesce((select sum(preu) from public.proposta_doc_servei where doc_id = d.id), 0)::text as total
    from public.proposta_doc d
    left join public.clients c on c.id = d.client_id
    order by d.num desc nulls last, d.id desc
  `) as unknown as (PropostaDoc & { client_nom: string | null; total: string })[];

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
