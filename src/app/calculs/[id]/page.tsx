import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { CalculView, type ClientOpt, type ExpedientOpt } from "./calcul-view";
import type { CalculEstructural } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CalculDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const rows = (await sql`
    select id, num, tipus, expedient_id, client_id, referencia, projecte, adreca, ciutat, client,
           arquitecte, situacio, element, to_char(data, 'YYYY-MM-DD') as data, versio, dades
    from public.calcul_estructural where id = ${id}
  `) as unknown as CalculEstructural[];
  if (rows.length === 0) notFound();

  const [expedients, clients] = await Promise.all([
    sql`
      select e.id, e.num_expedient, e.projecte, e.adreca, e.ciutat, e.client_id, c.nom as client_nom
      from public.expedients e left join public.clients c on c.id = e.client_id
      order by e.num_expedient desc
    ` as unknown as Promise<ExpedientOpt[]>,
    sql`select id, nom, ciutat from public.clients order by nom` as unknown as Promise<ClientOpt[]>,
  ]);

  return (
    <>
      <AppNav current="calculs" />
      <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-8">
        <CalculView calcul={rows[0]} expedients={expedients} clients={clients} />
      </main>
    </>
  );
}
