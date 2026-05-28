import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { ParametersView } from "./parameters-view";
import type {
  Projecte,
  Client,
  ConcepteDespesaDirecta,
  ConcepteAltraDespesa,
} from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  await requireUser();

  const [projectes, clients, conceptesDirectes, conceptesAltres] = await Promise.all([
    sql`select id, nom, created_at from public.projectes order by nom` as unknown as Promise<Projecte[]>,
    sql`select id, nom, contacte, created_at from public.clients order by nom` as unknown as Promise<Client[]>,
    sql`select id, nom, preu_hora_default::text as preu_hora_default, actiu, ordre from public.concepte_despesa_directa order by ordre, nom` as unknown as Promise<ConcepteDespesaDirecta[]>,
    sql`select id, nom, preu_unitat_default::text as preu_unitat_default, actiu, ordre from public.concepte_altra_despesa order by ordre, nom` as unknown as Promise<ConcepteAltraDespesa[]>,
  ]);

  return (
    <>
      <AppNav current="parameters" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Paràmetres</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">
          Gestiona projectes, clients i catàlegs de despeses.
        </p>
        <ParametersView
          projectes={projectes}
          clients={clients}
          conceptesDirectes={conceptesDirectes}
          conceptesAltres={conceptesAltres}
        />
      </main>
    </>
  );
}
