import { requireUser } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { FILES, ZIP, dataHoraBcn, nomDescarrega, nomFitxer, parseFitxer, type Manifest } from "@/lib/descarregues/cataleg";
import { llegirManifest } from "@/lib/descarregues/magatzem";
import { fmtMida } from "@/lib/fitxers-shared";

export const dynamic = "force-dynamic";

// The PDFs of every list, made by the cron (src/lib/descarregues). This page
// only reads the index of the last run from the file store: no database.
export default async function DescarreguesPage() {
  const user = await requireUser();
  const manifest = await llegirManifest(user === "demo" ? "demo" : "dac");

  return (
    <>
      <AppNav current="descarregues" />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Descàrregues</h1>
            <p className="text-sm text-[var(--color-muted)]">
              Les llistes i estadístiques en PDF, com les del botó «PDF» de cada pàgina (sense cap filtre a part de l&apos;any).
              Es generen soles cada dilluns, dimecres i divendres a primera hora del matí, i cada vegada substitueixen les anteriors.
            </p>
          </div>
          {manifest && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <a href={`/descarregues/${manifest.carpeta}/${ZIP}`} className="btn-primary gap-2" title="Tots els PDF en un sol fitxer zip, per carpetes">
                <ZipIcon /> Global (ZIP)
              </a>
              <span className="text-xs text-[var(--color-muted)] tabular-nums">
                Gravat el {dataHoraBcn(manifest.generat)} · {fmtMida(manifest.zip.bytes)}
              </span>
            </div>
          )}
        </div>

        {manifest ? (
          <Llista manifest={manifest} />
        ) : (
          <div className="card text-sm text-[var(--color-muted)]">
            Encara no s&apos;ha generat cap fitxer. Es generen sols cada dilluns, dimecres i divendres a primera hora del matí.
          </div>
        )}
      </main>
    </>
  );
}

function Llista({ manifest }: { manifest: Manifest }) {
  const fitxer = new Map(manifest.fitxers.map((f) => [f.nom, f]));
  const gravat = dataHoraBcn(manifest.generat);
  return (
    <ul className="divide-y divide-[var(--color-line)] rounded-lg border border-[var(--color-line)] bg-white">
      {FILES.map((row) => {
        // The files of this row: every year's (newest first), the current year's, or the only one.
        const anys =
          row.anys === "tots"
            ? manifest.fitxers
                .map((f) => parseFitxer(f.nom))
                .flatMap((p) => (p?.llista === row.llista && p.any != null ? [p.any] : []))
                .sort((a, b) => b - a)
            : [row.anys === "actual" ? manifest.anyActual : null];
        const items = anys
          .map((any) => ({ any, f: fitxer.get(nomFitxer(row.llista, any)) }))
          .filter((x): x is { any: number | null; f: Manifest["fitxers"][number] } => !!x.f);
        return (
          <li key={`${row.llista}-${row.anys}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)_9rem] sm:items-center sm:gap-4">
            <div className="text-sm font-medium">
              {row.titol}
              {row.anys === "actual" && <span className="font-normal text-[var(--color-muted)]"> ({manifest.anyActual})</span>}
              {row.anys === "tots" && <div className="text-xs font-normal text-[var(--color-muted)]">Un PDF per any</div>}
            </div>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              {items.length === 0 && <span className="text-sm text-[var(--color-muted)]">—</span>}
              {items.map(({ any, f }) => (
                <a
                  key={f.nom}
                  href={`/descarregues/${manifest.carpeta}/${f.nom}`}
                  className="btn-ghost btn-sm gap-1.5 tabular-nums"
                  title={`${nomDescarrega(row.llista, any)} · ${fmtMida(f.bytes)}`}
                >
                  <PdfIcon /> {row.anys === "tots" ? any : "PDF"}
                </a>
              ))}
            </div>
            <div className="text-xs text-[var(--color-muted)] tabular-nums sm:text-right">{items.length > 0 && <>Gravat el {gravat}</>}</div>
          </li>
        );
      })}
    </ul>
  );
}

function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}

function ZipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
    </svg>
  );
}
