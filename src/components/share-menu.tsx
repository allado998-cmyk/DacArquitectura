"use client";

// «Compartir», next to a sheet's «PDF» (tickets #41 and #42): the sheet as text
// (the same information as the PDF, src/lib/doc-text.ts) by e-mail, WhatsApp,
// copied to paste anywhere, or through the device's own share menu where the
// browser has one (phones, Windows, Mac).

import { useEffect, useRef, useState } from "react";
import { docText } from "@/lib/doc-text";
import type { PdfDoc } from "@/lib/llistats/doc";

// Chrome and Edge on Windows silently drop a link to another app (mailto:,
// whatsapp:) longer than 2,048 characters. A longer sheet also goes to the
// clipboard: the e-mail opens with a line asking to paste it, and WhatsApp, which
// may open without it on a computer, gets it pasted.
const MAX_LINK = 2000;

interface Shared {
  plain: string;
  mailto: string;
  mailLong: boolean; // the text did not fit in the e-mail link: it is copied
  waText: string; // with *bold*, as WhatsApp shows it
  whatsapp: string;
  waLong: boolean; // the WhatsApp app on a computer may not get the text: it is copied too
}

const paste = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘V" : "Ctrl+V");
const mailto = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;

function build(doc: PdfDoc, subject: string): Shared {
  const plain = docText(doc);
  const full = mailto(subject, plain);
  const mailLong = full.length > MAX_LINK;
  const waText = docText(doc, { whatsapp: true });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(waText)}`;
  return {
    plain,
    mailto: mailLong ? mailto(subject, `Enganxa aquí la fitxa (${paste()}): s'ha copiat en clicar «Correu electrònic».`) : full,
    mailLong,
    waText,
    whatsapp,
    waLong: whatsapp.length > MAX_LINK,
  };
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function ShareMenu({ doc, subject }: { doc: () => PdfDoc; subject: string }) {
  const [shared, setShared] = useState<Shared | null>(null); // open when set
  const [note, setNote] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  // Closes on a click outside and on Escape (which then leaves the window open).
  useEffect(() => {
    if (!shared) return;
    const down = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setShared(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setShared(null);
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key, true);
    };
  }, [shared]);

  const toggle = () => {
    setNote(null);
    setShared((s) => (s ? null : build(doc(), subject)));
  };
  // After a link's click has been followed (the link stays in the page until then).
  const closeSoon = () => setTimeout(() => setShared(null), 0);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-paper)]";

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        className="btn-ghost btn-sm inline-flex items-center gap-1.5"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={shared != null}
        title="Comparteix aquesta fitxa per correu, WhatsApp o una altra aplicació"
      >
        <ShareIcon /> Compartir
      </button>
      {shared && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-[var(--color-line)] bg-white p-1 shadow-lg">
          <a
            role="menuitem"
            className={item}
            href={shared.mailto}
            onClick={() => {
              if (!shared.mailLong) return void closeSoon();
              void copy(shared.plain).then((ok) =>
                setNote(ok ? `La fitxa és massa llarga per posar-la al correu: s'ha copiat. Enganxa-la al missatge (${paste()}).` : "La fitxa és massa llarga per posar-la al correu. Fes servir «Copiar el text»."),
              );
            }}
          >
            <MailIcon /> Correu electrònic
          </a>
          <a
            role="menuitem"
            className={item}
            href={shared.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!shared.waLong) return void closeSoon();
              void copy(shared.waText).then((ok) => ok && setNote(`Si WhatsApp s'obre sense el text, enganxa'l (${paste()}): ja està copiat.`));
            }}
          >
            <WhatsAppIcon /> WhatsApp
          </a>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => void copy(shared.plain).then((ok) => setNote(ok ? `Text copiat: enganxa'l on vulguis (${paste()}).` : "No s'ha pogut copiar el text."))}
          >
            <CopyIcon /> Copiar el text
          </button>
          {canShare && (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                const text = shared.plain;
                setShared(null);
                navigator.share({ title: subject, text }).catch(() => {}); // cancelled: nothing to do
              }}
            >
              <MoreIcon /> Altres aplicacions…
            </button>
          )}
          {note && <p className="px-3 pt-1 pb-2 text-xs text-[var(--color-muted)]" role="status">{note}</p>}
        </div>
      )}
    </div>
  );
}

const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function ShareIcon() {
  return (
    <svg {...svg} width={15} height={15}>
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98" /><path d="m15.41 6.51-6.82 3.98" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...svg} className="shrink-0 text-[var(--color-muted)]">
      <rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg {...svg} className="shrink-0" stroke="#25D366">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg {...svg} className="shrink-0 text-[var(--color-muted)]">
      <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg {...svg} className="shrink-0 text-[var(--color-muted)]">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><path d="m16 6-4-4-4 4" /><path d="M12 2v13" />
    </svg>
  );
}
