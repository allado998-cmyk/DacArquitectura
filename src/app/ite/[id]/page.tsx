import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { loadCataleg, loadIte } from "@/lib/ite/server";
import { IteView } from "./ite-view";

export const dynamic = "force-dynamic";

export default async function IteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [ite, cataleg, expedients, clients, contactes] = await Promise.all([
    loadIte(id),
    loadCataleg(),
    sql`select id, num_expedient, projecte, client_id from public.expedients order by num_expedient desc` as unknown as Promise<
      { id: number; num_expedient: string; projecte: string | null; client_id: number | null }[]
    >,
    sql`select id, nom, nif, carrer, ciutat, codi_postal from public.clients order by nom` as unknown as Promise<
      { id: number; nom: string; nif: string | null; carrer: string | null; ciutat: string | null; codi_postal: string | null }[]
    >,
    sql`
      select id, client_id, nom, telefon, mail from public.client_contactes
      where coalesce(nom, '') <> '' or coalesce(telefon, '') <> '' or coalesce(mail, '') <> ''
      order by nom
    ` as unknown as Promise<{ id: number; client_id: number | null; nom: string | null; telefon: string | null; mail: string | null }[]>,
  ]);
  if (!ite) notFound();

  return (
    <>
      <AppNav current="ite" />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <IteView ite={ite} cataleg={cataleg} expedients={expedients} clients={clients} contactes={contactes} />
      </main>
    </>
  );
}
