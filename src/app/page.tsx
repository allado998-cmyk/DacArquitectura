import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await requireUser();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <div className="mb-10 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="DAC arquitectura" className="h-20 w-auto mb-6" />
          <p className="text-[var(--color-muted)]">Eines internes per a la gestió del despatx.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/expedients" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Expedients</h2>
            <p className="text-sm text-[var(--color-muted)]">Registre d'expedients i estadístiques.</p>
          </Link>
          <Link href="/planificacio" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Planificació</h2>
            <p className="text-sm text-[var(--color-muted)]">Planificador temporal dels expedients oberts.</p>
          </Link>
          <Link href="/dedicacio" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Dedicació</h2>
            <p className="text-sm text-[var(--color-muted)]">Registre d'hores dedicades per expedient.</p>
          </Link>
          <Link href="/honoraris" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Honoraris</h2>
            <p className="text-sm text-[var(--color-muted)]">Càlcul d'honoraris.</p>
          </Link>
          <Link href="/propostes" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Propostes</h2>
            <p className="text-sm text-[var(--color-muted)]">Propostes d'honoraris (document) per al client.</p>
          </Link>
          <Link href="/facturacio" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Facturació</h2>
            <p className="text-sm text-[var(--color-muted)]">Factures i seguiment de cobraments.</p>
          </Link>
          <Link href="/parameters" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Base de Dades</h2>
            <p className="text-sm text-[var(--color-muted)]">Clients i catàlegs de despeses.</p>
          </Link>
        </div>
      </main>
    </>
  );
}
