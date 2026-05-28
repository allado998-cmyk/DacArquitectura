"use client";

import { useState, useTransition } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="card space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="label" htmlFor="usuari">Usuari</label>
        <input id="usuari" name="usuari" type="text" autoComplete="username" required className="input" defaultValue="adri" />
      </div>
      <div>
        <label className="label" htmlFor="password">Contrasenya</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Entrant…" : "Entrar"}
      </button>
    </form>
  );
}
