"use server";

import { redirect } from "next/navigation";
import { getSession, type AppUser } from "@/lib/auth";

// "demo" is a sandbox account: same app, separate database with fake data.
function passwordFor(usuari: string): string | undefined {
  if (usuari === "adri") return process.env.ADRI_PASSWORD;
  if (usuari === "demo") return process.env.DEMO_PASSWORD;
  return undefined;
}

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const usuari = String(formData.get("usuari") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/honoraris");

  if (!process.env.ADRI_PASSWORD) {
    return { error: "Configuració incompleta: falta ADRI_PASSWORD." };
  }

  const expected = passwordFor(usuari);
  if (!expected || password !== expected) {
    return { error: "Usuari o contrasenya incorrectes." };
  }

  const session = await getSession();
  session.user = usuari as AppUser;
  await session.save();

  redirect(next.startsWith("/") ? next : "/honoraris");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
