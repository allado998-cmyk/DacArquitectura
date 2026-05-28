"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const usuari = String(formData.get("usuari") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/honoraris");

  const expected = process.env.ADRI_PASSWORD;
  if (!expected) {
    return { error: "Configuració incompleta: falta ADRI_PASSWORD." };
  }

  if (usuari !== "adri" || password !== expected) {
    return { error: "Usuari o contrasenya incorrectes." };
  }

  const session = await getSession();
  session.user = "adri";
  await session.save();

  redirect(next.startsWith("/") ? next : "/honoraris");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
