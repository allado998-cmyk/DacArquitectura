import type { Metadata } from "next";
import { runAsActingUser } from "@/lib/acting-user";
import { readActaUploadToken, UPLOAD_LINK_TTL_S } from "@/lib/upload-link";
import { actaReasonLabel } from "@/lib/acta-doc";
import { sql } from "@/lib/db";
import { UploadView, type UploadActa } from "./upload-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pujar fotos a l'acta",
  robots: { index: false, follow: false },
};

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt="DAC arquitectura" className="mx-auto mb-6 h-10 w-auto" />
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      <p className="text-sm text-[var(--color-muted)]">{text}</p>
    </main>
  );
}

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const link = await readActaUploadToken(token);
  if (!link) {
    return <Message title="Enllaç caducat" text={`Els enllaços per pujar fotos duren ${UPLOAD_LINK_TTL_S / 3600} hores. Demana'n un de nou a l'assistent.`} />;
  }

  const acta = await runAsActingUser(link.user, async () => {
    const rows = (await sql`
      select a.id, a.num, a.tipus, to_char(a.data, 'DD/MM/YYYY') as data, a.projecte, e.num_expedient,
             jsonb_array_length(coalesce(a.fotografies,'[]'::jsonb)) as fotos,
             jsonb_array_length(coalesce(a.documents,'[]'::jsonb)) as documents,
             jsonb_array_length(coalesce(a.audios,'[]'::jsonb)) as audios
      from public.acta a left join public.expedients e on e.id = a.expedient_id
      where a.id = ${link.actaId}
    `) as {
      id: number;
      num: string | null;
      tipus: string;
      data: string | null;
      projecte: string | null;
      num_expedient: string | null;
      fotos: number;
      documents: number;
      audios: number;
    }[];
    return rows[0] ?? null;
  });
  if (!acta) return <Message title="Acta no trobada" text="Aquesta acta ja no existeix." />;

  const view: UploadActa = {
    num: acta.num ?? `#${acta.id}`,
    motiu: actaReasonLabel(acta.tipus),
    data: acta.data,
    projecte: acta.projecte,
    expedient: acta.num_expedient,
    demo: link.user === "demo",
    counts: { fotos: acta.fotos, documents: acta.documents, audios: acta.audios },
  };
  return <UploadView token={raw} acta={view} />;
}
