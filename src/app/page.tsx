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
        <h1 className="text-3xl font-semibold tracking-tight mb-2">DacArquitectura</h1>
        <p className="text-[var(--color-muted)] mb-10">Eines internes per a la gestió del despatx.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/honoraris" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Honoraris</h2>
            <p className="text-sm text-[var(--color-muted)]">Crear i gestionar propostes d'honoraris.</p>
          </Link>
          <Link href="/parameters" className="card hover:shadow-sm transition">
            <h2 className="text-lg font-semibold mb-1">Paràmetres</h2>
            <p className="text-sm text-[var(--color-muted)]">Projectes, clients i catàlegs de despeses.</p>
          </Link>
        </div>
      </main>
    </>
  );
}
