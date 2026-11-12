"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteIteAction, removeIteFitxersAction, saveIteAction } from "../actions";
import type { Cataleg } from "@/lib/ite/cataleg";
import { LIST_PATHS, listOf, mediaRefs, SINGLE_MEDIA, validateIte } from "@/lib/ite/model";
import { SECTIONS, type SectionKey } from "@/lib/ite/schema";
import type { IteRow } from "@/lib/ite/server";
import type { IteObj } from "@/lib/ite/xml";
import { GroupView, Pendents } from "./fields";
import { IteContext, type IteCtx } from "./ite-context";
import { SingleMedia } from "./media";
import {
  CadastrePanel,
  ConservacioResum,
  DeficienciesEditor,
  EnvolupantsEditor,
  ExportPanel,
  MesuresEditor,
  PlantesEditor,
  PropietatDesDeClient,
  TecnicDespatxButton,
  VinclesPanel,
  type ClientOpt,
  type ContacteOpt,
  type ExpedientOpt,
} from "./sections";

type SaveState = "desat" | "pendent" | "desant" | "error";

const media = (path: string) => SINGLE_MEDIA.find((m) => m.path === path)!;

export function IteView({ ite, cataleg, expedients, clients, contactes }: { ite: IteRow; cataleg: Cataleg; expedients: ExpedientOpt[]; clients: ClientOpt[]; contactes: ContacteOpt[] }) {
  const [doc, setDoc] = useState<IteObj>(ite.dades);
  const [state, setState] = useState<SaveState>("desat");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionKey>("dades");
  const [links, setLinks] = useState({ expedientId: ite.expedient_id, clientId: ite.client_id });

  // Autosave: one save at a time, a second one queued if the report changed meanwhile.
  const latest = useRef(doc);
  const savedRefs = useRef(new Set(mediaRefs(ite.dades)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const schedule = useCallback((ms = 1000) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), ms);
  }, []);

  const flush = useCallback(async () => {
    if (saving.current) { schedule(500); return; }
    const d = latest.current;
    saving.current = true;
    setState("desant");
    try {
      await saveIteAction(ite.id, d);
      setSaveError(null);
      // Files no longer in the saved report leave the store.
      const now = new Set(mediaRefs(d));
      const gone = [...savedRefs.current].filter((r) => !now.has(r));
      savedRefs.current = now;
      if (gone.length) void removeIteFitxersAction(ite.id, gone);
      setState(latest.current === d ? "desat" : "pendent");
      if (latest.current !== d) schedule(300);
    } catch (e) {
      setState("error");
      setSaveError(e instanceof Error ? e.message : String(e));
      schedule(5000);
    } finally {
      saving.current = false;
    }
  }, [ite.id, schedule]);
  useEffect(() => { flushRef.current = flush; }, [flush]);

  const update = useCallback((fn: (d: IteObj) => IteObj) => {
    setDoc((prev) => {
      const next = fn(prev);
      latest.current = next;
      return next;
    });
    setState("pendent");
    schedule();
  }, [schedule]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (state !== "desat") { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  // The section in the address bar (#deficiencies), so a reload stays put.
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.key === h)) setSection(h as SectionKey);
  }, []);
  function go(k: SectionKey) {
    setSection(k);
    history.replaceState(null, "", `#${k}`);
    window.scrollTo({ top: 0 });
  }

  const ctx: IteCtx = useMemo(() => ({ iteId: ite.id, doc, update, cataleg }), [ite.id, doc, update, cataleg]);
  const check = useMemo(() => validateIte(doc, cataleg), [doc, cataleg]);
  const counts: Partial<Record<SectionKey, number>> = {
    envolupant: listOf(doc, LIST_PATHS.envolupants).length,
    deficiencies: listOf(doc, LIST_PATHS.deficiencies).length,
  };
  const sec = SECTIONS.find((s) => s.key === section)!;
  const nom = typeof doc.nom === "string" ? doc.nom : "";

  return (
    <IteContext.Provider value={ctx}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <Link href="/ite" className="text-sm text-[var(--color-muted)] hover:underline">← Tots els informes</Link>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight sm:text-2xl" title={nom}>{nom || "Informe ITE"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs ${state === "error" ? "text-red-700" : "text-[var(--color-muted)]"}`} title={saveError ?? undefined}>
              {state === "desat" ? "Desat" : state === "desant" ? "Desant…" : state === "pendent" ? "Canvis per desar…" : "No s'ha pogut desar; reintentant…"}
            </span>
            <button type="button" className="btn-primary" onClick={() => go("exportar")}>
              Portal i PDF{check.errors.length ? ` (${check.errors.length} errors)` : ""}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="lg:sticky lg:top-4 lg:self-start">
            <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {SECTIONS.map((s) => (
                <button key={s.key} type="button" onClick={() => go(s.key)}
                  className={`shrink-0 rounded-md px-3 py-2 text-left text-sm ${section === s.key ? "bg-[var(--color-accent)] text-white" : "hover:bg-[var(--color-accent-soft)]"}`}>
                  {s.title}{counts[s.key] !== undefined ? <span className={section === s.key ? "text-white/80" : "text-[var(--color-muted)]"}> ({counts[s.key]})</span> : null}
                </button>
              ))}
            </div>
          </nav>

          <section className="min-w-0 space-y-5">
            <h2 className="text-lg font-semibold">{sec.title}</h2>

            {section === "dades" && (
              <>
                <VinclesPanel expedientId={links.expedientId} clientId={links.clientId} expedients={expedients} clients={clients} onChange={(e, c) => setLinks({ expedientId: e, clientId: c })} />
                <GroupView g={sec.groups[0]} />
                <GroupView g={sec.groups[1]} />
                <CadastrePanel />
                <PropietatDesDeClient key={links.clientId ?? 0} clientId={links.clientId} clients={clients} contactes={contactes} />
                <GroupView g={sec.groups[2]} />
                <div className="flex justify-end"><TecnicDespatxButton /></div>
                <GroupView g={sec.groups[3]} />
              </>
            )}

            {section === "descripcio" && (
              <>
                <GroupView g={sec.groups[0]} />
                <PlantesEditor />
                <GroupView g={sec.groups[1]} />
                <GroupView g={sec.groups[2]} />
                <SingleMedia {...media("edifici.edificiDescripcio.croquis")} />
              </>
            )}

            {section === "envolupant" && <EnvolupantsEditor />}

            {section === "sistemes" && (
              <>
                {sec.groups.map((g) => <GroupView key={g.title} g={g} />)}
                <div className="grid gap-4 md:grid-cols-2">
                  <SingleMedia {...media("edifici.edificiInstalacions.aaFotoComptadors")} />
                  <SingleMedia {...media("edifici.edificiInstalacions.ieQcpFoto")} />
                </div>
              </>
            )}

            {section === "deficiencies" && <DeficienciesEditor />}

            {section === "accessibilitat" && sec.groups.map((g) => <GroupView key={g.title} g={g} />)}

            {section === "conservacio" && (
              <>
                <ConservacioResum />
                {sec.groups.map((g) => <GroupView key={g.title} g={g} />)}
                <SingleMedia {...media("recomanacionsPdf")} />
              </>
            )}

            {section === "sostenibilitat" && (
              <>
                {sec.groups.map((g) => <GroupView key={g.title} g={g} />)}
                <MesuresEditor />
              </>
            )}

            {section === "exportar" && <ExportPanel />}

            <Pendents items={sec.pendents} />

            {section === "exportar" && (
              <form action={deleteIteAction} className="flex justify-end pt-4">
                <input type="hidden" name="id" value={ite.id} />
                <button className="btn-danger" type="submit" onClick={(e) => { if (!confirm("Eliminar aquest informe i totes les seves fotos?")) e.preventDefault(); }}>Eliminar informe</button>
              </form>
            )}
          </section>
        </div>
      </div>
    </IteContext.Provider>
  );
}
