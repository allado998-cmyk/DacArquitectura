import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ActaView } from "./acta-view";
import type { Acta } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ActaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const rows = (await sql`
    select id, num, tipus, expedient_id, dedicacio_id, acta_num,
           to_char(data, 'YYYY-MM-DD') as data, hora, lloc,
           projecte, referencia, ubicacio, client,
           assistents, temes, propera_visita,
           to_char(propera_data, 'YYYY-MM-DD') as propera_data, propera_hora, signatures,
           sig_do, sig_de, sig_adj_empresa, sig_adj_persona, sig_prom_empresa, sig_prom_persona
    from public.acta where id = ${id}
  `) as unknown as Acta[];
  if (rows.length === 0) notFound();
  const acta = rows[0];

  const [expedients, contactes] = await Promise.all([
    sql`select id, num_expedient, projecte from public.expedients order by num_expedient desc` as unknown as Promise<
      { id: number; num_expedient: string; projecte: string | null }[]
    >,
    // All contacts in the database (Base de Dades), with their client for context.
    sql`
      select ct.nom, ct.telefon, ct.mail, c.nom as client_nom
      from public.client_contactes ct
      left join public.clients c on c.id = ct.client_id
      where coalesce(ct.nom, '') <> ''
      order by ct.nom
    ` as unknown as Promise<{ nom: string | null; telefon: string | null; mail: string | null; client_nom: string | null }[]>,
  ]);

  return (
    <>
      <AppNav current="actes" />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <ActaView acta={acta} expedients={expedients} contactes={contactes} />
      </main>
    </>
  );
}
