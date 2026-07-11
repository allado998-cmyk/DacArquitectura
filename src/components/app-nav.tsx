import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

export function AppNav({ current }: { current?: "honoraris" | "parameters" | "expedients" | "dedicacio" | "propostes" | "planificacio" | "facturacio" | "notes" | "actes" }) {
  return (
    <header className="border-b border-[var(--color-line)] bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="DAC arquitectura" className="h-7 sm:h-8 w-auto" />
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm [&>a]:shrink-0">
          <Link
            href="/expedients"
            className={`px-3 py-1.5 rounded-md ${current === "expedients" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Expedients
          </Link>
          <Link
            href="/planificacio"
            className={`px-3 py-1.5 rounded-md ${current === "planificacio" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Planificació
          </Link>
          <Link
            href="/dedicacio"
            className={`px-3 py-1.5 rounded-md ${current === "dedicacio" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Dedicació
          </Link>
          <Link
            href="/actes"
            className={`px-3 py-1.5 rounded-md ${current === "actes" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Actes
          </Link>
          <Link
            href="/honoraris"
            className={`px-3 py-1.5 rounded-md ${current === "honoraris" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Honoraris
          </Link>
          <Link
            href="/propostes"
            className={`px-3 py-1.5 rounded-md ${current === "propostes" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Propostes
          </Link>
          <Link
            href="/facturacio"
            className={`px-3 py-1.5 rounded-md ${current === "facturacio" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Facturació
          </Link>
          <Link
            href="/parameters"
            className={`px-3 py-1.5 rounded-md ${current === "parameters" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Base de Dades
          </Link>
          <Link
            href="/notes"
            className={`px-3 py-1.5 rounded-md ${current === "notes" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Notes
          </Link>
        </nav>
        <form action={logoutAction} className="ml-auto">
          <button className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]" type="submit">
            Sortir
          </button>
        </form>
      </div>
    </header>
  );
}
