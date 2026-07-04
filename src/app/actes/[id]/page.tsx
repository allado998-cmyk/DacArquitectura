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
           sig_do, sig_de, sig_adj_empresa, sig_adj_persona, sig_prom_empresa, sig_prom_persona
    from public.acta where id = ${id}
  `) as unknown as Acta[];
  if (rows.length === 0) notFound();
  const acta = rows[0];

  const [expedients, contactes] = await Promise.all([
    sql`select id, num_expedient, projecte from public.expedients order by num_expedient desc` as unknown as Promise<
      { id: number; num_expedient: string; projecte: string | null }[]
    >,
    acta.expedient_id
      ? (sql`
          select ct.nom, ct.telefon, ct.mail
          from public.client_contactes ct
          join public.expedients e on e.client_id = ct.client_id
          where e.id = ${acta.expedient_id}
          order by ct.ordre, ct.id
        ` as unknown as Promise<{ nom: string | null; telefon: string | null; mail: string | null }[]>)
      : Promise.resolve([] as { nom: string | null; telefon: string | null; mail: string | null }[]),
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
