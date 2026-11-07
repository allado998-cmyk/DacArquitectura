"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createClientFullAction,
  createConcepteAltraAction,
  createConcepteDirectaAction,
  createContacteAction,
  createTascaAction,
  createTipologiaAction,
  updateIteTarifaAction,
  updateTascaAction,
  deleteClientAction,
  deleteClientContacteAction,
  reorderClientContactesAction,
  deleteConcepteAltraAction,
  deleteConcepteDirectaAction,
  deleteTascaAction,
  deleteTipologiaAction,
  setContacteClientAction,
  updateClientAction,
  updateClientContacteAction,
  updateConcepteAltraAction,
  updateConcepteDirectaAction,
  type ClientPatch,
  type ContactePatch,
} from "./actions";
import type {
  Client,
  ClientContacte,
  ClientStats,
  ConcepteAltraDespesa,
  ConcepteDespesaDirecta,
  IteTarifa,
  Tasca,
  Tipologia,
} from "@/types/db";
import { formatEur, formatEurPrecise } from "@/lib/format";
import { openListPdf } from "@/lib/pdf";
import { confirmaTelefons, telefonAvis, telefonsAmbAvis } from "@/lib/telefon";
import { Modal } from "@/components/modal";
import { Combobox, type ComboOption } from "@/components/combobox";
import { KpiCard } from "@/components/charts";

type Tab = "clients" | "contactes" | "directes" | "altres" | "tipologies" | "tasques" | "ite";

const EMPTY_STATS: Omit<ClientStats, "client_id"> = { n: 0, oberts: 0, pressupost_total: "0", pressupost_obert: "0" };

function ParamPdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" />
    </svg>
  );
}

export function ParametersView({
  clients,
  clientStats,
  conceptesDirectes,
  conceptesAltres,
  tipologies,
  contactes,
  tasques,
  iteTarifa,
}: {
  clients: Client[];
  clientStats: ClientStats[];
  conceptesDirectes: ConcepteDespesaDirecta[];
  conceptesAltres: ConcepteAltraDespesa[];
  tipologies: Tipologia[];
  contactes: ClientContacte[];
  tasques: Tasca[];
  iteTarifa: IteTarifa;
}) {
  const [tab, setTab] = useState<Tab>("clients");
  // The active tab's count reflects its filtered/shown rows.
  const [shown, setShown] = useState<number | null>(null);
  function changeTab(v: Tab) { setShown(null); setTab(v); }
  const cnt = (t: Tab, total: number) => (tab === t ? shown ?? total : total);

  const statsByClient = useMemo(() => {
    const map = new Map<number, ClientStats>();
    for (const s of clientStats) map.set(s.client_id, s);
    return map;
  }, [clientStats]);

  const contactesByClient = useMemo(() => {
    const map = new Map<number, ClientContacte[]>();
    for (const k of contactes) {
      if (k.client_id == null) continue;
      const list = map.get(k.client_id);
      if (list) list.push(k);
      else map.set(k.client_id, [k]);
    }
    for (const list of map.values()) list.sort((a, b) => a.ordre - b.ordre || a.id - b.id);
    return map;
  }, [contactes]);

  const ciutats = useMemo(
    () => Array.from(new Set(clients.map((c) => (c.ciutat ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [clients],
  );

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="clients" onClick={changeTab}>Clients ({cnt("clients", clients.length)})</TabBtn>
        <TabBtn current={tab} value="contactes" onClick={changeTab}>Contactes ({cnt("contactes", contactes.length)})</TabBtn>
        <TabBtn current={tab} value="tipologies" onClick={changeTab}>Tipologies ({cnt("tipologies", tipologies.length)})</TabBtn>
        <TabBtn current={tab} value="tasques" onClick={changeTab}>Tasques ({cnt("tasques", tasques.length)})</TabBtn>
        <TabBtn current={tab} value="directes" onClick={changeTab}>Despeses Directes ({cnt("directes", conceptesDirectes.length)})</TabBtn>
        <TabBtn current={tab} value="altres" onClick={changeTab}>Altres Despeses ({cnt("altres", conceptesAltres.length)})</TabBtn>
        <TabBtn current={tab} value="ite" onClick={changeTab}>Tarifa ITE</TabBtn>
      </div>

      {tab === "clients" && <ClientsPanel rows={clients} contactes={contactes} contactesByClient={contactesByClient} ciutats={ciutats} statsByClient={statsByClient} onCount={setShown} />}
      {tab === "contactes" && <ContactesPanel rows={contactes} clients={clients} onCount={setShown} />}
      {tab === "tipologies" && <TipologiesPanel rows={tipologies} onCount={setShown} />}
      {tab === "tasques" && <TasquesPanel rows={tasques} onCount={setShown} />}
      {tab === "directes" && <ConceptesDirectesPanel rows={conceptesDirectes} onCount={setShown} />}
      {tab === "altres" && <ConceptesAltresPanel rows={conceptesAltres} onCount={setShown} />}
      {tab === "ite" && <IteTarifaPanel tarifa={iteTarifa} />}
      <datalist id={PROFESSIONS_LIST}>
        {professioOptionsOf(contactes).map(([key, p]) => <option key={key} value={p} />)}
      </datalist>
    </div>
  );
}

// ============================================================================
// Tarifa ITE (price tiers used by the ITE càlcul)
// ============================================================================

function IteTarifaPanel({ tarifa }: { tarifa: IteTarifa }) {
  const [p1, setP1] = useState(tarifa.preu_1);
  const [p2, setP2] = useState(tarifa.preu_2);
  const [p3, setP3] = useState(tarifa.preu_3);
  const [inc, setInc] = useState(tarifa.increment);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateIteTarifaAction({
        preu_1: parseFloat(p1) || 0,
        preu_2: parseFloat(p2) || 0,
        preu_3: parseFloat(p3) || 0,
        increment: parseFloat(inc) || 0,
      });
      setSaved(true);
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-[var(--color-muted)]">
        Preus base del càlcul ITE segons el total d&apos;entitats equivalents (D):
        <br />si D &lt; 6 → Preu 1; si D &lt; 11 → Preu 2; si D ≥ 11 → Preu 3 + increment × (D − 10).
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <IteTarifaField label="Preu 1 (menys de 6 entitats)" hint="Per defecte 650 €" value={p1} onChange={setP1} />
        <IteTarifaField label="Preu 2 (de 6 a 10 entitats)" hint="Per defecte 750 €" value={p2} onChange={setP2} />
        <IteTarifaField label="Preu 3 (11 o més entitats)" hint="Base per a 11+ entitats. Per defecte 850 €" value={p3} onChange={setP3} />
        <IteTarifaField label="Increment per entitat (per sobre de 10)" hint="Per defecte 15 €" value={inc} onChange={setInc} />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save}>Desar tarifa</button>
        {saved && <span className="text-sm text-green-700">Desat ✓</span>}
      </div>
    </div>
  );
}

function IteTarifaField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" step="1" min="0" className="input text-right" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="text-sm text-[var(--color-muted)]">€</span>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>
    </div>
  );
}

// ============================================================================
// Shared by the Clients and Contactes tables
// ============================================================================

// Case- and accent-insensitive text, so "nuria" finds "Núria" and "collegi" "Col·legi".
const fold = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\p{M}·]/gu, "").toLowerCase();

const byNom = (a: { nom: string | null }, b: { nom: string | null }) => (a.nom ?? "￿").localeCompare(b.nom ?? "￿", "ca");

const dash = <span className="text-[var(--color-muted)]">—</span>;

const EXPEDIENTS_OPTIONS: [string, string][] = [["oberts", "Amb oberts"], ["tancats", "Només tancats"], ["cap", "Sense expedients"]];
const AMB_SENSE: [string, string][] = [["amb", "Amb"], ["sense", "Sense"]];
const TELEFON_OPTIONS: [string, string][] = [...AMB_SENSE, ["incorrecte", "Incorrecte"]];
const optionLabel = (options: [string, string][], value: string) => options.find(([v]) => v === value)?.[1];

function matchesExpedients(s: ClientStats | undefined, filter: string) {
  const n = s?.n ?? 0;
  const oberts = s?.oberts ?? 0;
  if (filter === "oberts") return oberts > 0;
  if (filter === "tancats") return n > 0 && oberts === 0;
  if (filter === "cap") return n === 0;
  return true;
}

const matchesAmbSense = (has: boolean, filter: string) => !filter || (filter === "amb") === has;

const contacteAvisos = (c: ClientContacte) => telefonsAmbAvis([c.telefon, ...c.telefons_extra]);

// ⚠ after a phone in a table, with what's wrong as its tooltip.
function AvisTelefons({ telefons }: { telefons: (string | null | undefined)[] }) {
  const text = telefonsAmbAvis(telefons).join("\n");
  if (!text) return null;
  return <span className="ml-1.5 cursor-help text-amber-700" title={text} role="img" aria-label={text}>⚠</span>;
}

// A contact's phones and mail as table cells: Telèfon 1 is the main phone,
// Telèfon 2 the next one, with "+N" for any more (they're in the contact's page).
function ContacteCells({ contacte: c }: { contacte: ClientContacte }) {
  const [tel2, ...mes] = c.telefons_extra;
  return (
    <>
      <td className="td whitespace-nowrap tabular-nums">{c.telefon ?? dash}<AvisTelefons telefons={[c.telefon]} /></td>
      <td className="td whitespace-nowrap tabular-nums">
        {tel2 ?? dash}
        <AvisTelefons telefons={[tel2, ...mes]} />
        {mes.length > 0 && <span className="ml-1.5 text-xs text-[var(--color-muted)]" title={mes.join("\n")}>+{mes.length}</span>}
      </td>
      <td className="td whitespace-nowrap">{c.mail ?? dash}</td>
    </>
  );
}

// Initial letter for the A–Z filter: "Àngel" → A, "«La Caixa»" → L; digits → #.
const LLETRES = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
function inicial(nom: string | null | undefined) {
  const c = fold(nom).replace(/^[^a-z0-9]+/, "").charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

// Letters with no rows under the other filters are greyed out. Clicking the
// chosen letter again shows them all.
function Abecedari({ value, onChange, presents }: { value: string; onChange: (v: string) => void; presents: Set<string> }) {
  return (
    <div>
      <div className="label">Inicial</div>
      <div className="flex flex-wrap overflow-hidden rounded-md border border-[var(--color-line)] bg-white" role="group" aria-label="Inicial">
        {LLETRES.map((l) => {
          const active = value === l;
          const has = presents.has(l);
          return (
            <button
              key={l}
              type="button"
              aria-pressed={active}
              disabled={!has && !active}
              title={l === "#" ? "Comença amb un número o un altre signe" : undefined}
              onClick={() => onChange(active ? "" : l)}
              className={`h-9 w-6 text-sm ${
                active
                  ? "bg-[var(--color-accent)] font-semibold text-white"
                  : has
                    ? "text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"
                    : "cursor-default text-[var(--color-muted)] opacity-35"
              }`}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Rgb = [number, number, number];
const VERD: Rgb = [31, 77, 63]; // --color-accent
const BLAU: Rgb = [3, 105, 161];

const linear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]: number[]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

// A count as a pill whose colour deepens with the value, relative to the
// largest in the table, so the busiest rows stand out. 0 stays plain.
function Heat({ n, max, rgb }: { n: number; max: number; rgb: Rgb }) {
  if (!n) return <span className="tabular-nums text-[var(--color-muted)]">0</span>;
  // Square root, so 1 and 3 still look different when the largest is 20.
  const t = 0.18 + 0.82 * Math.sqrt(n / Math.max(n, max));
  const bg = rgb.map((c) => Math.round(255 + (c - 255) * t));
  return (
    <span
      className="inline-block min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums"
      // White text only where it has enough contrast; dark text on the pale ones.
      style={{ backgroundColor: `rgb(${bg.join(",")})`, color: luminance(bg) < 0.19 ? "#fff" : "#111" }}
    >
      {n}
    </span>
  );
}

// Appears once the page has scrolled past the first rows.
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      className="fixed bottom-6 right-6 z-40 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white shadow-lg hover:opacity-90"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      ↑ Tornar a dalt
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "Tots",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  allLabel?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  );
}

// ============================================================================
// Contactes (flat list across all clients + standalone)
// ============================================================================

const SENSE_CLIENT = 0; // Client filter value for contacts with no client; real ids start at 1
const SENSE_PROFESSIO = "\u0000sense"; // Professió filter value for contacts with none

// Each profession once, however it was capitalised or accented: [folded, as first written].
function professioOptionsOf(rows: ClientContacte[]): [string, string][] {
  const seen = new Map<string, string>();
  for (const c of rows) {
    const p = c.professio?.trim();
    if (p && !seen.has(fold(p))) seen.set(fold(p), p);
  }
  return [...seen].sort((a, b) => a[1].localeCompare(b[1], "ca"));
}

function ContactesPanel({
  rows,
  clients,
  onCount,
}: {
  rows: ClientContacte[];
  clients: Client[];
  onCount: (n: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [lletra, setLletra] = useState("");
  const [fTelefon, setFTelefon] = useState("");
  const [fMail, setFMail] = useState("");
  const [fClient, setFClient] = useState<number | null>(null);
  const [fComentari, setFComentari] = useState("");
  const [fProfessio, setFProfessio] = useState("");
  // Track the OPEN contact by id and re-derive from rows, so it shows fresh
  // server data after saving and closes by itself once deleted.
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const open = rows.find((c) => c.id === openId) ?? null;

  const clientOpts: ComboOption[] = useMemo(() => clients.map((c) => ({ id: c.id, label: c.nom })), [clients]);
  const clientFilterOpts = useMemo(() => [{ id: SENSE_CLIENT, label: "Sense client" }, ...clientOpts], [clientOpts]);
  const professioOptions = useMemo(() => professioOptionsOf(rows), [rows]);

  const q = fold(query.trim());
  // Every filter but the letter; the letter bar greys out the letters with none.
  const base = rows.filter((c) => {
    if (fTelefon === "incorrecte" ? contacteAvisos(c).length === 0 : !matchesAmbSense(!!c.telefon, fTelefon)) return false;
    if (!matchesAmbSense(!!c.mail, fMail)) return false;
    if (fClient === SENSE_CLIENT ? c.client_id != null : fClient != null && c.client_id !== fClient) return false;
    if (!matchesAmbSense(!!c.comentari, fComentari)) return false;
    if (fProfessio && (fProfessio === SENSE_PROFESSIO ? !!c.professio?.trim() : fold(c.professio).trim() !== fProfessio)) return false;
    return !q || fold([c.nom, c.professio, c.telefon, ...c.telefons_extra, c.mail, ...c.mails_extra, c.comentari, c.client_nom].join(" ")).includes(q);
  });
  const presents = new Set(base.map((c) => inicial(c.nom)));
  const filtered = (lletra ? base.filter((c) => inicial(c.nom) === lletra) : base).sort(byNom);
  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  const hasFilters = fClient != null || !!(lletra || fProfessio || fTelefon || fMail || fComentari);
  function clearFilters() {
    setLletra("");
    setFProfessio("");
    setFTelefon("");
    setFMail("");
    setFClient(null);
    setFComentari("");
  }

  function exportPdf() {
    const applied = [
      q && `Cerca: "${query.trim()}"`,
      lletra && `Inicial ${lletra}`,
      fProfessio && (fProfessio === SENSE_PROFESSIO ? "Sense professió" : optionLabel(professioOptions, fProfessio)),
      fTelefon && (fTelefon === "incorrecte" ? "Telèfon incorrecte" : `${optionLabel(AMB_SENSE, fTelefon)} telèfon`),
      fMail && `${optionLabel(AMB_SENSE, fMail)} mail`,
      clientFilterOpts.find((o) => o.id === fClient)?.label,
      fComentari && `${optionLabel(AMB_SENSE, fComentari)} comentari`,
    ].filter(Boolean).join(" · ");
    openListPdf({
      title: "Contactes",
      subtitle: applied ? `${applied} · ${filtered.length} de ${rows.length}` : `${rows.length} contactes`,
      landscape: true,
      columns: [{ label: "Nom" }, { label: "Professió" }, { label: "Telèfon 1" }, { label: "Telèfon 2" }, { label: "Mail" }, { label: "Client" }],
      rows: filtered.map((c) => [c.nom ?? "—", c.professio ?? "—", c.telefon ?? "—", c.telefons_extra[0] ?? "—", c.mail ?? "—", c.client_nom ?? "—"]),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Nom, telèfon, mail, client…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Abecedari value={lletra} onChange={setLletra} presents={presents} />
        <FilterSelect label="Professió" allLabel="Totes" value={fProfessio} onChange={setFProfessio} options={[[SENSE_PROFESSIO, "Sense professió"], ...professioOptions]} />
        <FilterSelect label="Telèfon" value={fTelefon} onChange={setFTelefon} options={TELEFON_OPTIONS} />
        <FilterSelect label="Mail" value={fMail} onChange={setFMail} options={AMB_SENSE} />
        <div className="w-60">
          <label className="label">Client</label>
          <Combobox options={clientFilterOpts} value={fClient} onChange={setFClient} placeholder="Cerca client…" emptyLabel="Tots" />
        </div>
        <FilterSelect label="Comentari" value={fComentari} onChange={setFComentari} options={AMB_SENSE} />
        {hasFilters && <button type="button" className="btn-ghost" onClick={clearFilters}>Netejar</button>}
        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF dels contactes mostrats"><ParamPdfIcon /> PDF</button>
          <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setCreating(true)}>+ Nou contacte</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap contacte encara." : "Cap resultat."}</p>
      ) : (
        <div className="table-wrap table-sticky">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th">Professió</th>
                <th className="th">Telèfon 1</th>
                <th className="th">Telèfon 2</th>
                <th className="th">Mail</th>
                <th className="th">Client</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => setOpenId(c.id)}>
                  <td className="td whitespace-nowrap font-medium"><button type="button" className="text-left">{c.nom ?? "Sense nom"}</button></td>
                  <td className="td whitespace-nowrap">{c.professio ?? dash}</td>
                  <ContacteCells contacte={c} />
                  <td className="td whitespace-nowrap">{c.client_nom ?? dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BackToTop />

      <ContacteModal
        open={creating || open != null}
        contacte={open}
        clientOpts={clientOpts}
        onClose={() => { setCreating(false); setOpenId(null); }}
      />
    </div>
  );
}

function ContacteModal({
  open,
  contacte,
  presetClientId,
  clientOpts,
  onClose,
}: {
  open: boolean;
  contacte: ClientContacte | null;
  presetClientId?: number;
  clientOpts: ComboOption[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={<h3 className="text-base font-semibold">{contacte ? contacte.nom ?? "Sense nom" : "Nou contacte"}</h3>}>
      {open && <ContacteDetail key={contacte?.id ?? "new"} contacte={contacte} presetClientId={presetClientId} clientOpts={clientOpts} onClose={onClose} />}
    </Modal>
  );
}

// A contact's page: everything about it, with Editar and Eliminar. A new
// contact goes straight to the form.
function ContacteDetail({
  contacte,
  presetClientId,
  clientOpts,
  onClose,
}: {
  contacte: ClientContacte | null;
  presetClientId?: number;
  clientOpts: ComboOption[];
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(contacte == null);
  const [, startTransition] = useTransition();

  if (!contacte || editing) {
    return (
      <ContacteForm
        contacte={contacte}
        presetClientId={presetClientId}
        clientOpts={clientOpts}
        onDone={() => { if (contacte) setEditing(false); else onClose(); }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ContacteLinks label="Telèfons" scheme="tel" main={contacte.telefon} extras={contacte.telefons_extra} avis={telefonAvis} />
        <ContacteLinks label="Mails" scheme="mailto" main={contacte.mail} extras={contacte.mails_extra} />
        <div>
          <div className="label">Professió</div>
          <div className="text-sm">{contacte.professio ?? dash}</div>
        </div>
        <div>
          <div className="label">Client</div>
          <div className="text-sm">{contacte.client_nom ?? dash}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="label">Comentari</div>
          <p className="text-sm whitespace-pre-wrap">{contacte.comentari ?? dash}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => setEditing(true)}>Editar</button>
        <button
          type="button"
          className="btn-danger"
          onClick={() => {
            if (confirm("Eliminar aquest contacte?")) {
              startTransition(() => deleteClientContacteAction(contacte.id));
              onClose();
            }
          }}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

function ContacteLinks({
  label,
  scheme,
  main,
  extras,
  avis,
}: {
  label: string;
  scheme: "tel" | "mailto";
  main: string | null;
  extras: string[];
  avis?: (value: string) => string | null;
}) {
  const values = [main, ...extras].filter((v): v is string => !!v);
  return (
    <div>
      <div className="label">{label}</div>
      {values.length === 0 ? (
        <div className="text-sm">{dash}</div>
      ) : (
        <ul className="space-y-1 text-sm">
          {values.map((v, i) => (
            <li key={v}>
              <a className="break-all text-[var(--color-accent)] hover:underline" href={`${scheme}:${v.replace(/\s/g, "")}`}>{v}</a>
              {i === 0 && values.length > 1 && <span className="ml-2 text-xs text-[var(--color-muted)]">Principal</span>}
              {avis?.(v) && <p className="text-xs text-amber-700">⚠ {avis(v)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ContacteForm({
  contacte,
  presetClientId,
  clientOpts,
  onDone,
}: {
  contacte: ClientContacte | null;
  presetClientId?: number;
  clientOpts: ComboOption[];
  onDone: () => void;
}) {
  const [nom, setNom] = useState(contacte?.nom ?? "");
  const [telefons, setTelefons] = useState([contacte?.telefon ?? "", ...(contacte?.telefons_extra ?? [])]);
  const [mails, setMails] = useState([contacte?.mail ?? "", ...(contacte?.mails_extra ?? [])]);
  const [comentari, setComentari] = useState(contacte?.comentari ?? "");
  const [professio, setProfessio] = useState(contacte?.professio ?? "");
  const [clientId, setClientId] = useState<number | null>(contacte ? contacte.client_id : presetClientId ?? null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (![nom, professio, comentari, ...telefons, ...mails].some((v) => v.trim())) return;
    // Only the numbers typed here: a known odd one shouldn't ask on every save.
    const saved = [contacte?.telefon, ...(contacte?.telefons_extra ?? [])];
    if (!confirmaTelefons(telefons.filter((t) => !saved.includes(t.trim())))) return;
    const [telefon, ...telefonsExtra] = telefons;
    const [mail, ...mailsExtra] = mails;
    const patch = { nom, professio, telefon, mail, telefonsExtra, mailsExtra, comentari };
    startTransition(async () => {
      if (contacte) {
        await updateClientContacteAction(contacte.id, patch);
        if (clientId !== contacte.client_id) await setContacteClientAction(contacte.id, clientId);
      } else {
        await createContacteAction({ ...patch, clientId });
      }
      // Its own transition, or the page would come back before the fresh data does.
      startTransition(onDone);
    });
  }

  return (
    // Leaving a phone field can show its warning and push the buttons down, which
    // would lose the click. Buttons don't take the focus, so nothing moves mid-click.
    <div className="space-y-4" onMouseDown={(e) => { if ((e.target as HTMLElement).closest("button")) e.preventDefault(); }}>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="Nom"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom del contacte" /></Field>
        <Field label="Professió"><ProfessioInput value={professio} onChange={setProfessio} /></Field>
        <MultiValueField label="Telèfons" addLabel="+ Afegir telèfon" placeholder="Telèfon" values={telefons} onChange={setTelefons} avis={telefonAvis} />
        <MultiValueField label="Mails" addLabel="+ Afegir mail" placeholder="correu@exemple.cat" type="email" values={mails} onChange={setMails} />
        <Field label="Client"><Combobox options={clientOpts} value={clientId} onChange={setClientId} placeholder="Cerca client…" emptyLabel="Sense client" overlay /></Field>
        <div className="sm:col-span-2">
          <Field label="Comentari (opcional)"><textarea className="input" rows={3} value={comentari} onChange={(e) => setComentari(e.target.value)} placeholder="Notes lliures…" /></Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel·lar</button>
      </div>
    </div>
  );
}

// Free text, suggesting the professions already in use (the list is rendered
// once by ParametersView), so the filter doesn't split "Arquitecte" in two.
function ProfessioInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input className="input" list={PROFESSIONS_LIST} value={value} onChange={(e) => onChange(e.target.value)} placeholder="p. ex. Arquitecte" />;
}
const PROFESSIONS_LIST = "contacte-professions";

// A list of phones or mails. The first one is the main one, the one the tables
// show; the star on any other line moves it to the top.
function MultiValueField({
  label,
  addLabel,
  placeholder,
  type = "text",
  values,
  onChange,
  avis,
}: {
  label: string;
  addLabel: string;
  placeholder: string;
  type?: "text" | "email";
  values: string[];
  onChange: (values: string[]) => void;
  avis?: (value: string) => string | null;
}) {
  // Warnings wait until the user leaves the line, not on every digit typed.
  const [focused, setFocused] = useState<number | null>(null);
  const several = values.length > 1;
  return (
    <div>
      <label className="label">{label}</label>
      <div className="space-y-2">
        {values.map((v, i) => {
          const warning = i === focused ? null : avis?.(v);
          return (
            <div key={i}>
              <div className="flex items-center gap-1">
                <input
                  className="input min-w-0 flex-1"
                  type={type}
                  value={v}
                  placeholder={placeholder}
                  onFocus={() => setFocused(i)}
                  onBlur={() => setFocused(null)}
                  onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {several && (
                  <>
                    <button
                      type="button"
                      className={`shrink-0 px-1 text-base ${i === 0 ? "cursor-default text-[var(--color-accent)]" : "text-[var(--color-muted)] hover:text-[var(--color-accent)]"}`}
                      title={i === 0 ? "Principal" : "Fer principal"}
                      aria-label={i === 0 ? "Principal" : "Fer principal"}
                      disabled={i === 0}
                      onClick={() => onChange([v, ...values.filter((_, j) => j !== i)])}
                    >
                      {i === 0 ? "★" : "☆"}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 px-1 text-sm text-red-700 hover:underline"
                      aria-label="Treure"
                      onClick={() => onChange(values.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
              {warning && <p className="mt-1 text-xs text-amber-700">⚠ {warning}</p>}
            </div>
          );
        })}
      </div>
      <button type="button" className="mt-1 text-sm text-[var(--color-accent)] hover:underline" onClick={() => onChange([...values, ""])}>{addLabel}</button>
    </div>
  );
}

// ============================================================================
// Tipologies
// ============================================================================

function TipologiesPanel({ rows, onCount }: { rows: Tipologia[]; onCount: (n: number) => void }) {
  const [nom, setNom] = useState("");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((t) => t.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Cercar tipologia…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nom.trim()) return;
            startTransition(() => createTipologiaAction(nom));
            setNom("");
          }}
          className="flex gap-2 ml-auto"
        >
          <input className="input" placeholder="Nova tipologia" value={nom} onChange={(e) => setNom(e.target.value)} />
          <button className="btn-primary" type="submit">+ Afegir</button>
        </form>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap tipologia encara." : "Cap resultat."}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white px-3 py-2">
              <span className="text-sm">{t.nom}</span>
              <button
                type="button"
                className="text-red-700 hover:underline text-sm"
                onClick={() => {
                  if (confirm(`Eliminar la tipologia "${t.nom}"?`)) {
                    startTransition(() => deleteTipologiaAction(t.id));
                  }
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-[var(--color-muted)]">
        Eliminar una tipologia no esborra els expedients: només es desvincula.
      </p>
    </div>
  );
}

// ============================================================================
// Tasques (dedicació lookup)
// ============================================================================

function TasquesPanel({ rows, onCount }: { rows: Tasca[]; onCount: (n: number) => void }) {
  const [nom, setNom] = useState("");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((t) => t.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Cercar tasca…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nom.trim()) return;
            startTransition(() => createTascaAction(nom));
            setNom("");
          }}
          className="flex gap-2 ml-auto"
        >
          <input className="input" placeholder="Nova tasca" value={nom} onChange={(e) => setNom(e.target.value)} />
          <button className="btn-primary" type="submit">+ Afegir</button>
        </form>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap tasca encara." : "Cap resultat."}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TascaRow key={t.id} row={t} />
          ))}
        </div>
      )}
      <p className="text-xs text-[var(--color-muted)]">
        Les tasques apareixen com a suggeriments en registrar la dedicació. Edita el nom directament.
      </p>
    </div>
  );
}

function TascaRow({ row }: { row: Tasca }) {
  const [nom, setNom] = useState(row.nom);
  const [, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5">
      <input
        className="input flex-1 min-w-0"
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        onBlur={() => { if (nom.trim() && nom.trim() !== row.nom) startTransition(() => updateTascaAction(row.id, nom)); }}
      />
      <button
        type="button"
        className="shrink-0 text-red-700 hover:underline text-sm"
        onClick={() => { if (confirm(`Eliminar la tasca "${row.nom}"?`)) startTransition(() => deleteTascaAction(row.id)); }}
      >
        ✕
      </button>
    </div>
  );
}

function TabBtn({
  children,
  value,
  current,
  onClick,
}: {
  children: React.ReactNode;
  value: Tab;
  current: Tab;
  onClick: (v: Tab) => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`px-4 py-2 text-sm border-b-2 -mb-px ${
        active
          ? "border-[var(--color-accent)] text-[var(--color-accent)] font-medium"
          : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Clients
// ============================================================================

function ClientsPanel({
  rows,
  contactes,
  contactesByClient,
  ciutats,
  statsByClient,
  onCount,
}: {
  rows: Client[];
  contactes: ClientContacte[];
  contactesByClient: Map<number, ClientContacte[]>;
  ciutats: string[];
  statsByClient: Map<number, ClientStats>;
  onCount: (n: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [lletra, setLletra] = useState("");
  const [fCiutat, setFCiutat] = useState("");
  const [fExpedients, setFExpedients] = useState("");
  const [fContactes, setFContactes] = useState("");
  // Track the OPEN client and contact by id and re-derive from the rows, so
  // they reflect fresh server data (e.g. a contact just added) without reopening.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [contacteId, setContacteId] = useState<number | null>(null);
  const [creatingContacte, setCreatingContacte] = useState(false);
  const editing = rows.find((c) => c.id === editingId) ?? null;
  const openContacte = contactes.find((k) => k.id === contacteId) ?? null;
  const contacteOpen = creatingContacte || openContacte != null;

  const clientOpts: ComboOption[] = useMemo(() => rows.map((c) => ({ id: c.id, label: c.nom })), [rows]);

  // Colours scale against the largest across all clients, so they don't shift while filtering.
  const maxOberts = useMemo(() => Math.max(0, ...rows.map((c) => statsByClient.get(c.id)?.oberts ?? 0)), [rows, statsByClient]);
  const maxContactes = useMemo(() => Math.max(0, ...[...contactesByClient.values()].map((l) => l.length)), [contactesByClient]);

  const q = fold(query.trim());
  const contactHits = (c: Client) => (q ? (contactesByClient.get(c.id) ?? []).filter((k) => fold(k.nom).includes(q)) : []);
  // Every filter but the letter; the letter bar greys out the letters with none.
  const base = rows.filter((c) => {
    if (fCiutat && (c.ciutat ?? "").trim() !== fCiutat) return false;
    if (!matchesExpedients(statsByClient.get(c.id), fExpedients)) return false;
    if (!matchesAmbSense(contactesByClient.has(c.id), fContactes)) return false;
    return !q || fold(`${c.nom} ${c.ciutat ?? ""} ${c.nif ?? ""}`).includes(q) || contactHits(c).length > 0;
  });
  const presents = new Set(base.map((c) => inicial(c.nom)));
  const filtered = (lletra ? base.filter((c) => inicial(c.nom) === lletra) : base).sort(byNom);
  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  const hasFilters = !!(lletra || fCiutat || fExpedients || fContactes);
  function clearFilters() {
    setLletra("");
    setFCiutat("");
    setFExpedients("");
    setFContactes("");
  }

  function exportPdf() {
    const applied = [
      q && `Cerca: "${query.trim()}"`,
      lletra && `Inicial ${lletra}`,
      fCiutat,
      optionLabel(EXPEDIENTS_OPTIONS, fExpedients),
      fContactes && `${optionLabel(AMB_SENSE, fContactes)} contactes`,
    ].filter(Boolean).join(" · ");
    openListPdf({
      title: "Clients",
      subtitle: applied ? `${applied} · ${filtered.length} de ${rows.length}` : `${rows.length} clients`,
      landscape: false,
      columns: [{ label: "Nom" }, { label: "NIF/CIF" }, { label: "Ciutat" }, { label: "CP" }, { label: "Contactes", align: "right" }, { label: "Oberts", align: "right" }, { label: "Exp.", align: "right" }],
      rows: filtered.map((c) => {
        const s = statsByClient.get(c.id);
        return [c.nom, c.nif ?? "—", c.ciutat ?? "—", c.codi_postal ?? "—", String(contactesByClient.get(c.id)?.length ?? 0), String(s?.oberts ?? 0), String(s?.n ?? 0)];
      }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <label className="label">Cercar</label>
          <input className="input" placeholder="Client, contacte, NIF…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Abecedari value={lletra} onChange={setLletra} presents={presents} />
        <FilterSelect label="Ubicació" allLabel="Totes" value={fCiutat} onChange={setFCiutat} options={ciutats.map((c) => [c, c])} />
        <FilterSelect label="Expedients" value={fExpedients} onChange={setFExpedients} options={EXPEDIENTS_OPTIONS} />
        <FilterSelect label="Contactes" value={fContactes} onChange={setFContactes} options={AMB_SENSE} />
        {hasFilters && <button type="button" className="btn-ghost" onClick={clearFilters}>Netejar</button>}
        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF dels clients mostrats"><ParamPdfIcon /> PDF</button>
          <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setCreating(true)}>+ Nou client</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap client encara." : "Cap resultat."}</p>
      ) : (
        <div className="table-wrap table-sticky">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th w-40">NIF</th>
                <th className="th w-56">Ubicació</th>
                <th className="th w-32 text-center">Contactes</th>
                <th className="th w-40 text-center whitespace-nowrap">Expedients oberts</th>
                <th className="th w-40 text-center whitespace-nowrap">Expedients totals</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const s = statsByClient.get(c.id);
                const hits = contactHits(c);
                return (
                  <tr key={c.id} className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => setEditingId(c.id)}>
                    <td className="td whitespace-nowrap font-medium"><button type="button" className="text-left">{c.nom}</button></td>
                    <td className="td whitespace-nowrap tabular-nums">{c.nif ?? dash}</td>
                    <td className="td whitespace-nowrap">{c.ciutat ?? dash}</td>
                    {/* Centred, except while a search lists the matching contacts beside the count. */}
                    <td className={`td whitespace-nowrap ${hits.length ? "" : "text-center"}`}>
                      <Heat n={contactesByClient.get(c.id)?.length ?? 0} max={maxContactes} rgb={BLAU} />
                      {hits.length > 0 && <span className="ml-2 text-[var(--color-muted)]">{hits.map((k) => k.nom).join(", ")}</span>}
                    </td>
                    <td className="td text-center"><Heat n={s?.oberts ?? 0} max={maxOberts} rgb={VERD} /></td>
                    <td className="td text-center tabular-nums">{s?.n ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <BackToTop />

      <ClientFormModal
        open={creating || editing != null}
        client={editing}
        contactes={editing ? contactesByClient.get(editing.id) ?? [] : []}
        stats={editing ? statsByClient.get(editing.id) : undefined}
        ciutats={ciutats}
        onOpenContacte={setContacteId}
        onNewContacte={() => setCreatingContacte(true)}
        // Escape reaches both popups; only the contact one, on top, should close.
        onClose={() => { if (contacteOpen) return; setCreating(false); setEditingId(null); }}
      />
      <ContacteModal
        open={contacteOpen}
        contacte={openContacte}
        presetClientId={editing?.id}
        clientOpts={clientOpts}
        onClose={() => { setCreatingContacte(false); setContacteId(null); }}
      />
    </div>
  );
}

function ClientFormModal({
  open,
  client,
  contactes,
  stats,
  ciutats,
  onOpenContacte,
  onNewContacte,
  onClose,
}: {
  open: boolean;
  client: Client | null;
  contactes: ClientContacte[];
  stats?: ClientStats;
  ciutats: string[];
  onOpenContacte: (id: number) => void;
  onNewContacte: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={<h3 className="text-lg font-semibold tracking-tight">{client ? client.nom : "Nou client"}</h3>}
    >
      {open && (
        <ClientForm
          key={client?.id ?? "new"}
          client={client}
          contactes={contactes}
          stats={client ? stats ?? { client_id: client.id, ...EMPTY_STATS } : null}
          ciutats={ciutats}
          onOpenContacte={onOpenContacte}
          onNewContacte={onNewContacte}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ClientForm({
  client,
  contactes,
  stats,
  ciutats,
  onOpenContacte,
  onNewContacte,
  onClose,
}: {
  client: Client | null;
  contactes: ClientContacte[];
  stats: ClientStats | null;
  ciutats: string[];
  onOpenContacte: (id: number) => void;
  onNewContacte: () => void;
  onClose: () => void;
}) {
  const [nom, setNom] = useState(client?.nom ?? "");
  const [nif, setNif] = useState(client?.nif ?? "");
  const [carrer, setCarrer] = useState(client?.carrer ?? "");
  const [ciutat, setCiutat] = useState(client?.ciutat ?? "");
  const [codiPostal, setCodiPostal] = useState(client?.codi_postal ?? "");
  // A new client's contacts, typed in this same form and saved with it.
  const [drafts, setDrafts] = useState<ContacteDraft[]>([]);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!nom.trim()) return;
    if (!client && !confirmaTelefons(drafts.flatMap((d) => d.telefons))) return;
    const patch: ClientPatch = { nom, nif, carrer, ciutat, codi_postal: codiPostal };
    const contactes: ContactePatch[] = drafts.map(({ nom, professio, telefons: [telefon = "", ...telefonsExtra], mails: [mail = "", ...mailsExtra] }) => ({ nom, professio, telefon, mail, telefonsExtra, mailsExtra }));
    startTransition(async () => {
      if (client) await updateClientAction(client.id, patch);
      else await createClientFullAction(patch, contactes);
      onClose();
    });
  }

  return (
    // Leaving a phone field can show its warning and push the buttons down, which
    // would lose the click. Buttons don't take the focus, so nothing moves mid-click.
    <div className="space-y-6" onMouseDown={(e) => { if ((e.target as HTMLElement).closest("button")) e.preventDefault(); }}>
      {client && stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Expedients" value={String(stats.n)} accent="#1f4d3f" />
          <KpiCard label="Oberts" value={String(stats.oberts)} accent="#ef4444" />
          <KpiCard label="Pressupost total" value={formatEur(stats.pressupost_total)} accent="#0ea5e9" />
          <KpiCard label="Pressupost en obert" value={formatEur(stats.pressupost_obert)} accent="#a855f7" />
        </div>
      )}

      {/* Dades */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nom">
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom del client" />
        </Field>
        <Field label="NIF / CIF">
          <input className="input" value={nif} onChange={(e) => setNif(e.target.value)} />
        </Field>
        <Field label="Carrer">
          <input className="input" value={carrer} onChange={(e) => setCarrer(e.target.value)} />
        </Field>
        <Field label="Ciutat">
          <input className="input" list="client-ciutats" placeholder="Tria o escriu…" value={ciutat} onChange={(e) => setCiutat(e.target.value)} />
          <datalist id="client-ciutats">
            {ciutats.map((c) => <option key={c} value={c} />)}
          </datalist>
        </Field>
        <Field label="Codi postal">
          <input
            className="input"
            inputMode="numeric"
            pattern="\d*"
            maxLength={5}
            placeholder="08028"
            value={codiPostal}
            onChange={(e) => setCodiPostal(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
        </Field>
      </div>

      {!client && <NewClientContactes drafts={drafts} onChange={setDrafts} />}

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel·lar</button>
      </div>

      {client && <ClientContactesSection client={client} contactes={contactes} onOpen={onOpenContacte} onNew={onNewContacte} onDeleted={onClose} />}
    </div>
  );
}

interface ContacteDraft {
  key: number;
  nom: string;
  professio: string;
  telefons: string[];
  mails: string[];
}
let draftKey = 0;

// The contacts of a client that doesn't exist yet: they're saved with it.
function NewClientContactes({ drafts, onChange }: { drafts: ContacteDraft[]; onChange: (drafts: ContacteDraft[]) => void }) {
  const update = (key: number, patch: Partial<ContacteDraft>) => onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  return (
    <div className="border-t border-[var(--color-line)] pt-5">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Contactes</h4>
        <button type="button" className="btn-ghost px-2.5 py-1 text-sm" onClick={() => onChange([...drafts, { key: ++draftKey, nom: "", professio: "", telefons: [""], mails: [""] }])}>
          + Afegir contacte
        </button>
      </div>
      {drafts.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Cap contacte. Els pots afegir ara, i es desaran amb el client, o més endavant.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <div key={d.key} className="rounded-lg border border-[var(--color-line)] p-3">
              <div className="grid items-start gap-3 sm:grid-cols-3">
                <div className="space-y-3">
                  <Field label="Nom"><input className="input" value={d.nom} onChange={(e) => update(d.key, { nom: e.target.value })} placeholder="Nom del contacte" /></Field>
                  <Field label="Professió"><ProfessioInput value={d.professio} onChange={(professio) => update(d.key, { professio })} /></Field>
                </div>
                <MultiValueField label="Telèfons" addLabel="+ Afegir telèfon" placeholder="Telèfon" values={d.telefons} onChange={(telefons) => update(d.key, { telefons })} avis={telefonAvis} />
                <MultiValueField label="Mails" addLabel="+ Afegir mail" placeholder="correu@exemple.cat" type="email" values={d.mails} onChange={(mails) => update(d.key, { mails })} />
              </div>
              <button type="button" className="mt-2 text-sm text-red-700 hover:underline" onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}>
                Treure contacte
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientContactesSection({
  client,
  contactes,
  onOpen,
  onNew,
  onDeleted,
}: {
  client: Client;
  contactes: ClientContacte[];
  onOpen: (id: number) => void;
  onNew: () => void;
  onDeleted: () => void;
}) {
  const [, startTransition] = useTransition();
  // Local order while a reorder is being saved; reset whenever the server
  // sends the list again (it comes back sorted by the saved order).
  const [order, setOrder] = useState<number[] | null>(null);
  const idsKey = contactes.map((c) => c.id).join(",");
  useEffect(() => setOrder(null), [idsKey]);
  const list = order
    ? [...order.map((id) => contactes.find((c) => c.id === id)).filter((c): c is ClientContacte => !!c), ...contactes.filter((c) => !order.includes(c.id))]
    : contactes;

  function saveOrder(next: ClientContacte[]) {
    const ids = next.map((c) => c.id);
    setOrder(ids);
    startTransition(() => reorderClientContactesAction(client.id, ids));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    saveOrder(next);
  }
  function sortAZ() {
    saveOrder([...list].sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? "", "ca", { sensitivity: "base" })));
  }

  return (
    <div className="border-t border-[var(--color-line)] pt-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Contactes</h4>
        <div className="flex items-center gap-1">
          {list.length > 1 && (
            <button type="button" className="btn-ghost px-2.5 py-1 text-sm" onClick={sortAZ} title="Ordenar els contactes per nom">
              Ordenar A–Z
            </button>
          )}
          <button type="button" className="btn-ghost px-2.5 py-1 text-sm" onClick={onNew}>
            + Afegir contacte
          </button>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Cap contacte encara.</p>
      ) : (
        <div className="space-y-2">
          {list.length > 1 && <p className="text-xs text-[var(--color-muted)]">Fes servir les fletxes per canviar l&apos;ordre.</p>}
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Nom</th>
                  <th className="th">Professió</th>
                  <th className="th">Telèfon 1</th>
                  <th className="th">Telèfon 2</th>
                  <th className="th">Mail</th>
                  <th className="th w-20"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((ct, i) => (
                  <tr key={ct.id} className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => onOpen(ct.id)}>
                    <td className="td whitespace-nowrap font-medium"><button type="button" className="text-left">{ct.nom ?? "Sense nom"}</button></td>
                    <td className="td whitespace-nowrap">{ct.professio ?? dash}</td>
                    <ContacteCells contacte={ct} />
                    <td className="td whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn-ghost px-2 py-1 text-sm disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} title="Pujar" aria-label="Pujar">↑</button>
                      <button type="button" className="btn-ghost ml-1 px-2 py-1 text-sm disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === list.length - 1} title="Baixar" aria-label="Baixar">↓</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5">
        <button
          type="button"
          className="text-red-700 hover:underline text-sm"
          onClick={() => {
            if (confirm(`Eliminar "${client.nom}"?`)) {
              startTransition(() => deleteClientAction(client.id));
              onDeleted();
            }
          }}
        >
          Eliminar client
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

// ============================================================================
// Concepte Despesa Directa
// ============================================================================

function ConceptesDirectesPanel({ rows, onCount }: { rows: ConcepteDespesaDirecta[]; onCount: (n: number) => void }) {
  const [nom, setNom] = useState("");
  const [preu, setPreu] = useState("28.27");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((c) => c.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          const preuNum = parseFloat(preu);
          if (!Number.isFinite(preuNum)) return;
          startTransition(() => createConcepteDirectaAction(nom, preuNum));
          setNom("");
          setPreu("28.27");
        }}
        className="grid gap-2 sm:grid-cols-3 max-w-2xl"
      >
        <input className="input sm:col-span-2" placeholder="Nou concepte (ex: Visita d'obra)" value={nom} onChange={(e) => setNom(e.target.value)} />
        <input className="input" type="number" step="0.01" placeholder="€/h" value={preu} onChange={(e) => setPreu(e.target.value)} />
        <button className="btn-primary sm:col-span-3 sm:w-auto sm:justify-self-start" type="submit">+ Afegir</button>
      </form>

      <input className="input max-w-xs" placeholder="Cercar concepte…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="table-wrap max-w-3xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Concepte (A–Z)</th>
              <th className="th w-32">€ / hora per defecte</th>
              <th className="th w-20">Actiu</th>
              <th className="th w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <ConcepteDirectaRow key={c.id} row={c} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Canviar el preu aquí no modifica propostes ja creades — només els valors per defecte de les noves línies.
      </p>
    </div>
  );
}

function ConcepteDirectaRow({ row }: { row: ConcepteDespesaDirecta }) {
  const [nom, setNom] = useState(row.nom);
  const [preu, setPreu] = useState(row.preu_hora_default);
  const [actiu, setActiu] = useState(row.actiu);
  const [, startTransition] = useTransition();

  function persist() {
    if (!nom.trim()) return;
    const preuNum = parseFloat(preu);
    if (!Number.isFinite(preuNum)) return;
    if (nom !== row.nom || preu !== row.preu_hora_default || actiu !== row.actiu) {
      startTransition(() => updateConcepteDirectaAction(row.id, nom, preuNum, actiu));
    }
  }

  return (
    <tr>
      <td className="td"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} /></td>
      <td className="td">
        <input type="number" step="0.01" className="input text-right" value={preu} onChange={(e) => setPreu(e.target.value)} onBlur={persist} />
      </td>
      <td className="td">
        <input
          type="checkbox"
          checked={actiu}
          onChange={(e) => {
            setActiu(e.target.checked);
            const preuNum = parseFloat(preu);
            if (Number.isFinite(preuNum)) {
              startTransition(() => updateConcepteDirectaAction(row.id, nom, preuNum, e.target.checked));
            }
          }}
        />
      </td>
      <td className="td text-right">
        <button
          type="button"
          className="text-red-700 hover:underline text-sm"
          onClick={() => {
            if (confirm(`Eliminar "${row.nom}"?`)) {
              startTransition(() => deleteConcepteDirectaAction(row.id));
            }
          }}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}

// ============================================================================
// Concepte Altra Despesa
// ============================================================================

function ConceptesAltresPanel({ rows, onCount }: { rows: ConcepteAltraDespesa[]; onCount: (n: number) => void }) {
  const [nom, setNom] = useState("");
  const [preu, setPreu] = useState("0");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((c) => c.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));
  useEffect(() => onCount(filtered.length), [filtered.length, onCount]);

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          const preuNum = parseFloat(preu);
          if (!Number.isFinite(preuNum)) return;
          startTransition(() => createConcepteAltraAction(nom, preuNum));
          setNom("");
          setPreu("0");
        }}
        className="grid gap-2 sm:grid-cols-3 max-w-2xl"
      >
        <input className="input sm:col-span-2" placeholder="Nou concepte" value={nom} onChange={(e) => setNom(e.target.value)} />
        <input className="input" type="number" step="0.0001" placeholder="€/unitat" value={preu} onChange={(e) => setPreu(e.target.value)} />
        <button className="btn-primary sm:col-span-3 sm:w-auto sm:justify-self-start" type="submit">+ Afegir</button>
      </form>

      <input className="input max-w-xs" placeholder="Cercar concepte…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div className="table-wrap max-w-4xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Concepte (A–Z)</th>
              <th className="th w-40">€ / unitat per defecte</th>
              <th className="th w-20">Actiu</th>
              <th className="th w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <ConcepteAltraRow key={c.id} row={c} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Canviar el preu aquí no modifica propostes ja creades — només els valors per defecte de les noves línies.
      </p>
    </div>
  );
}

function ConcepteAltraRow({ row }: { row: ConcepteAltraDespesa }) {
  const [nom, setNom] = useState(row.nom);
  const [preu, setPreu] = useState(row.preu_unitat_default);
  const [actiu, setActiu] = useState(row.actiu);
  const [, startTransition] = useTransition();

  function persist() {
    if (!nom.trim()) return;
    const preuNum = parseFloat(preu);
    if (!Number.isFinite(preuNum)) return;
    if (nom !== row.nom || preu !== row.preu_unitat_default || actiu !== row.actiu) {
      startTransition(() => updateConcepteAltraAction(row.id, nom, preuNum, actiu));
    }
  }

  return (
    <tr>
      <td className="td"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} /></td>
      <td className="td">
        <input type="number" step="0.0001" className="input text-right" value={preu} onChange={(e) => setPreu(e.target.value)} onBlur={persist} />
        <div className="text-xs text-[var(--color-muted)] text-right mt-1">{formatEurPrecise(preu)}</div>
      </td>
      <td className="td">
        <input
          type="checkbox"
          checked={actiu}
          onChange={(e) => {
            setActiu(e.target.checked);
            const preuNum = parseFloat(preu);
            if (Number.isFinite(preuNum)) {
              startTransition(() => updateConcepteAltraAction(row.id, nom, preuNum, e.target.checked));
            }
          }}
        />
      </td>
      <td className="td text-right">
        <button
          type="button"
          className="text-red-700 hover:underline text-sm"
          onClick={() => {
            if (confirm(`Eliminar "${row.nom}"?`)) {
              startTransition(() => deleteConcepteAltraAction(row.id));
            }
          }}
        >
          Eliminar
        </button>
      </td>
    </tr>
  );
}
