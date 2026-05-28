import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const { next } = await searchParams;

  if (session.user) {
    redirect(next && next.startsWith("/") ? next : "/honoraris");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">DacArquitectura</h1>
        <p className="text-sm text-[var(--color-muted)] mb-6">Inicia sessió per continuar.</p>
        <LoginForm next={next ?? "/honoraris"} />
      </div>
    </main>
  );
}
