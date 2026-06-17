"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";

const FORMES = ["diamond", "circle", "square", "triangle", "star"];
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#facc15";

export async function addFitaAction(input: {
  expedientId: number;
  tipusId: number | null;
  novaNom: string;
  forma: string;
  color: string;
  data: string;
}) {
  await requireUser();
  if (!input.expedientId || !/^\d{4}-\d{2}-\d{2}$/.test(input.data)) return;

  let tipusId = input.tipusId;
  if (!tipusId) {
    const nom = input.novaNom.trim();
    if (!nom) return;
    const forma = FORMES.includes(input.forma) ? input.forma : "diamond";
    const color = COLOR_RE.test(input.color) ? input.color : DEFAULT_COLOR;
    const rows = (await sql`
      insert into public.fita_tipus (nom, forma, color) values (${nom}, ${forma}, ${color})
      on conflict (nom) do update set forma = excluded.forma, color = excluded.color
      returning id
    `) as { id: number }[];
    tipusId = rows[0]?.id ?? null;
  }
  if (!tipusId) return;

  await sql`insert into public.expedient_fita (expedient_id, tipus_id, data) values (${input.expedientId}, ${tipusId}, ${input.data})`;
  revalidatePath("/planificacio");
}

export async function updateFitaTipusColorAction(tipusId: number, color: string) {
  await requireUser();
  if (!tipusId || !COLOR_RE.test(color)) return;
  await sql`update public.fita_tipus set color = ${color} where id = ${tipusId}`;
  revalidatePath("/planificacio");
}

export async function deleteFitaAction(id: number) {
  await requireUser();
  await sql`delete from public.expedient_fita where id = ${id}`;
  revalidatePath("/planificacio");
}
