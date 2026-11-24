import { requireUser } from "@/lib/auth";
import { loadHonorarisLlista } from "@/lib/honoraris-llista";
import { AppNav } from "@/components/app-nav";
import { createIteAction, createPropostaAction } from "./actions";
import { HonorarisListView, type PropostaListRow } from "./honoraris-list-view";

export const dynamic = "force-dynamic";

export default async function HonorarisListPage() {
  await requireUser();

  const rows: PropostaListRow[] = await loadHonorarisLlista();

  return (
    <>
      <AppNav current="honoraris" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Honoraris</h1>
            <p className="text-sm text-[var(--color-muted)]">Càlcul d&apos;honoraris.</p>
          </div>
          <div className="flex items-center gap-2">
            <form action={createPropostaAction}>
              <button className="btn-primary" type="submit">Nou càlcul</button>
            </form>
            <form action={createIteAction}>
              <button className="btn-primary" type="submit" style={{ backgroundColor: "#16a34a", borderColor: "#16a34a" }}>Nou càlcul ITE</button>
            </form>
          </div>
        </div>

        <HonorarisListView rows={rows} />
      </main>
    </>
  );
}
