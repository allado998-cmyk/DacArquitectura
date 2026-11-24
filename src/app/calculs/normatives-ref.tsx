"use client";

// Càlculs › Normatives: one standard on actions in buildings, shown as its PDF
// (see src/lib/calculs/normatives.ts). From laptop width up the document is
// embedded in the page; on a phone or tablet, where browsers don't show a PDF
// inside a page, a button opens it.

import { NORMATIVES, type NormativaKey } from "@/lib/calculs/normatives";

export function NormativaDoc({ k }: { k: NormativaKey }) {
  const d = NORMATIVES.find((x) => x.key === k)!;
  const href = `/calculs/normatives/${d.fitxer}`;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold leading-tight">{d.titol}</h2>
            {d.estat && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  d.estat === "vigent" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "bg-[var(--color-paper)] text-[var(--color-muted)]"
                }`}
              >
                {d.estat === "vigent" ? "Vigent" : "Derogada"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{d.origen}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={href} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            Obrir en una pestanya nova
          </a>
          <a href={`${href}?descarregar`} className="btn-ghost btn-sm">
            Descarregar
          </a>
        </div>
      </div>
      <iframe
        key={d.key}
        src={`${href}#view=FitH`}
        title={d.titol}
        className="hidden h-[calc(100vh-13rem)] min-h-[32rem] w-full rounded-lg border border-[var(--color-line)] bg-white lg:block"
      />
      <div className="card text-sm lg:hidden">
        <a href={href} target="_blank" rel="noreferrer" className="btn-primary">
          Obrir el PDF
        </a>
      </div>
    </div>
  );
}
