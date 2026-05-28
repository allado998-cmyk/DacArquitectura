import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { AppNav } from "@/components/app-nav";
import { formatDataCa } from "@/lib/format";
import { createPropostaAction, deletePropostaAction } from "./actions";

export const dynamic = "force-dynamic";

interface PropostaRow {
  id: number;
  data: string;
  projecte_nom: string | null;
  client_nom: string | null;
}

export default async function HonorarisListPage() {
  await requireUser();

  const rows = (await sql`
    select p.id,
           to_char(p.data, 'YYYY-MM-DD') as data,
           pr.nom as projecte_nom,
           c.nom as client_nom
    from public.propostes p
    left join public.projectes pr on pr.id = p.projecte_id
    left join public.clients c on c.id = p.client_id
    order by p.id desc
  `) as unknown as PropostaRow[];

  return (
    <>
      <AppNav current="honoraris" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Honoraris</h1>
            <p className="text-sm text-[var(--color-muted)]">Propostes d'honoraris.</p>
          </div>
          <form action={createPropostaAction}>
            <button className="btn-primary" type="submit">Nova proposta</button>
          </form>
        </div>

        {rows.length === 0 ? (
          <div className="card text-sm text-[var(--color-muted)]">
            Encara no hi ha cap proposta. Crea'n una de nova per començar.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Núm.</th>
                  <th className="th">Data</th>
                  <th className="th">Projecte</th>
                  <th className="th">Client</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td font-mono">{r.id}</td>
                    <td className="td">{formatDataCa(r.data)}</td>
                    <td className="td">{r.projecte_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                    <td className="td">{r.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                    <td className="td text-right whitespace-nowrap">
                      <Link href={`/honoraris/${r.id}`} className="text-[var(--color-accent)] hover:underline mr-3">Obrir</Link>
                      <form action={deletePropostaAction} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="text-red-700 hover:underline text-sm"
                        >
                          Eliminar
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
