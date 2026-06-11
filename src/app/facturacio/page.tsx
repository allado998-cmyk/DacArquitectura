import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { createFacturaAction, nextFacturaNum } from "./actions";
import { FacturacioView, type ClientOpt, type ExpedientOpt, type Invoiced } from "./facturacio-view";
import { todayIso } from "@/lib/format";
import type { Factura, FacturaSuplit } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function FacturacioPage() {
  await requireUser();

  const [factures, suplits, clients, expedients, invoiced, suplitSugg, suggestedNum] = await Promise.all([
    sql`
      select f.id, f.num, f.estat, to_char(f.data, 'YYYY-MM-DD') as data, f.client_id, c.nom as client_nom, c.nif,
             f.expedient_id, e.num_expedient as expedient_num, e.projecte as expedient_projecte,
             f.preu::text as preu, f.pagada,
             coalesce((select sum(import) from public.factura_suplit where factura_id = f.id), 0)::text as suplits_total
      from public.factura f
      left join public.clients c on c.id = f.client_id
      left join public.expedients e on e.id = f.expedient_id
      order by (f.estat = 'propera') desc, f.num desc nulls last, f.id desc
    ` as unknown as Promise<Factura[]>,
    sql`select id, factura_id, descripcio, import::text as import, ordre from public.factura_suplit order by ordre, id` as unknown as Promise<FacturaSuplit[]>,
    sql`select id, nom, nif from public.clients order by nom` as unknown as Promise<ClientOpt[]>,
    sql`select id, num_expedient, projecte, pressupost::text as pressupost from public.expedients order by num_expedient desc` as unknown as Promise<ExpedientOpt[]>,
    sql`select expedient_id, coalesce(sum(preu),0)::text as total from public.factura where expedient_id is not null group by expedient_id` as unknown as Promise<Invoiced[]>,
    sql`select distinct descripcio from public.factura_suplit where descripcio is not null and descripcio <> '' order by descripcio` as unknown as Promise<{ descripcio: string }[]>,
    nextFacturaNum(),
  ]);

  return (
    <>
      <AppNav current="facturacio" />
      <main className="mx-auto w-full max-w-[1600px] px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Facturació</h1>
            <p className="text-sm text-[var(--color-muted)]">Factures emeses i seguiment de cobraments.</p>
          </div>
          <form action={createFacturaAction}>
            <button className="btn-primary" type="submit">Nova factura</button>
          </form>
        </div>

        <FacturacioView
          factures={factures}
          suplits={suplits}
          clients={clients}
          expedients={expedients}
          invoiced={invoiced}
          suplitSuggestions={suplitSugg.map((s) => s.descripcio)}
          suggestedNum={suggestedNum}
          today={todayIso()}
        />
      </main>
    </>
  );
}
