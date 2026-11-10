"use server";

import { requireUser } from "@/lib/auth";
import { newPathname } from "@/lib/fitxers";

// Where the browser should upload a new file for this acta, expedient or ITE.
// The server picks it so the area (real or demo) always matches the logged-in user.
export async function newUploadPathAction(kind: "acta" | "expedient" | "ite", id: number, name: string): Promise<string> {
  await requireUser();
  if (!Number.isInteger(id) || id <= 0) throw new Error("Identificador invàlid.");
  return newPathname(kind === "acta" ? `actes/${id}` : kind === "ite" ? `ite/${id}` : `expedients/${id}`, name);
}
