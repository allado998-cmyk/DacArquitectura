import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

export function AppNav({ current }: { current?: "honoraris" | "parameters" }) {
  return (
    <header className="border-b border-[var(--color-line)] bg-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">DacArquitectura</Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/honoraris"
            className={`px-3 py-1.5 rounded-md ${current === "honoraris" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Honoraris
          </Link>
          <Link
            href="/parameters"
            className={`px-3 py-1.5 rounded-md ${current === "parameters" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-accent-soft)]"}`}
          >
            Paràmetres
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
