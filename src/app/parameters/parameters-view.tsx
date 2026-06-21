"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addClientContacteAction,
  createClientFullAction,
  createConcepteAltraAction,
  createConcepteDirectaAction,
  createContacteAction,
  createTascaAction,
  createTipologiaAction,
  deleteClientAction,
  deleteClientContacteAction,
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
} from "./actions";
import type {
  Client,
  ClientContacte,
  ClientStats,
  ConcepteAltraDespesa,
  ConcepteDespesaDirecta,
  Tasca,
  Tipologia,
} from "@/types/db";
import { formatEur, formatEurPrecise } from "@/lib/format";
import { openListPdf } from "@/lib/pdf";
import { Modal } from "@/components/modal";
import { Combobox, type ComboOption } from "@/components/combobox";
import { KpiCard } from "@/components/charts";

type Tab = "clients" | "contactes" | "directes" | "altres" | "tipologies" | "tasques";

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
}: {
  clients: Client[];
  clientStats: ClientStats[];
  conceptesDirectes: ConcepteDespesaDirecta[];
  conceptesAltres: ConcepteAltraDespesa[];
  tipologies: Tipologia[];
  contactes: ClientContacte[];
  tasques: Tasca[];
}) {
  const [tab, setTab] = useState<Tab>("clients");

  const statsByClient = useMemo(() => {
    const map = new Map<number, ClientStats>();
    for (const s of clientStats) map.set(s.client_id, s);
    return map;
  }, [clientStats]);

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="clients" onClick={setTab}>Clients ({clients.length})</TabBtn>
        <TabBtn current={tab} value="contactes" onClick={setTab}>Contactes ({contactes.length})</TabBtn>
        <TabBtn current={tab} value="tipologies" onClick={setTab}>Tipologies ({tipologies.length})</TabBtn>
        <TabBtn current={tab} value="tasques" onClick={setTab}>Tasques ({tasques.length})</TabBtn>
        <TabBtn current={tab} value="directes" onClick={setTab}>Despeses Directes ({conceptesDirectes.length})</TabBtn>
        <TabBtn current={tab} value="altres" onClick={setTab}>Altres Despeses ({conceptesAltres.length})</TabBtn>
      </div>

      {tab === "clients" && <ClientsPanel rows={clients} statsByClient={statsByClient} />}
      {tab === "contactes" && <ContactesPanel rows={contactes} clients={clients} />}
      {tab === "tipologies" && <TipologiesPanel rows={tipologies} />}
      {tab === "tasques" && <TasquesPanel rows={tasques} />}
      {tab === "directes" && <ConceptesDirectesPanel rows={conceptesDirectes} />}
      {tab === "altres" && <ConceptesAltresPanel rows={conceptesAltres} />}
    </div>
  );
}

// ============================================================================
// Contactes (flat list across all clients + standalone)
// ============================================================================

function ContactesPanel({ rows, clients }: { rows: ClientContacte[]; clients: Client[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ClientContacte | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  const clientOpts: ComboOption[] = clients.map((c) => ({ id: c.id, label: c.nom }));

  const q = query.trim().toLowerCase();
  const filtered = (q
    ? rows.filter((r) => `${r.nom ?? ""} ${r.telefon ?? ""} ${r.mail ?? ""} ${r.comentari ?? ""} ${r.client_nom ?? ""}`.toLowerCase().includes(q))
    : rows
  ).slice().sort((a, b) => (a.nom ?? "￿").localeCompare(b.nom ?? "￿", "ca"));

  function exportPdf() {
    openListPdf({
      title: "Contactes",
      subtitle: q ? `Cerca: "${query.trim()}" · ${filtered.length} de ${rows.length}` : `${rows.length} contactes`,
      landscape: false,
      columns: [{ label: "Nom" }, { label: "Telèfon" }, { label: "Mail" }, { label: "Comentari" }, { label: "Client" }],
      rows: filtered.map((c) => [c.nom ?? "—", c.telefon ?? "—", c.mail ?? "—", c.comentari ?? "—", c.client_nom ?? "—"]),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Cercar contacte…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn-ghost ml-auto inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF dels contactes mostrats"><ParamPdfIcon /> PDF</button>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>+ Nou contacte</button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap contacte encara." : "Cap resultat."}</p>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th w-40">Telèfon</th>
                <th className="th">Mail</th>
                <th className="th">Comentari</th>
                <th className="th w-56">Client</th>
                <th className="th w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-[var(--color-paper)]" onClick={() => setEditing(c)}>
                  <td className="td font-medium">{c.nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td tabular-nums">{c.telefon ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td">{c.mail ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td text-[var(--color-muted)]">{c.comentari ?? ""}</td>
                  <td className="td">{c.client_nom ?? <span className="text-[var(--color-muted)]">—</span>}</td>
                  <td className="td whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="text-[var(--color-accent)] hover:underline text-sm mr-3" onClick={() => setEditing(c)}>Editar</button>
                    <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => { if (confirm("Eliminar aquest contacte?")) startTransition(() => deleteClientContacteAction(c.id)); }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContacteFormModal
        open={creating || editing != null}
        contacte={editing}
        clientOpts={clientOpts}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
    </div>
  );
}

function ContacteFormModal({
  open,
  contacte,
  clientOpts,
  onClose,
}: {
  open: boolean;
  contacte: ClientContacte | null;
  clientOpts: ComboOption[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={<h3 className="text-base font-semibold">{contacte ? "Editar contacte" : "Nou contacte"}</h3>}>
      {open && <ContacteForm key={contacte?.id ?? "new"} contacte={contacte} clientOpts={clientOpts} onClose={onClose} />}
    </Modal>
  );
}

function ContacteForm({
  contacte,
  clientOpts,
  onClose,
}: {
  contacte: ClientContacte | null;
  clientOpts: ComboOption[];
  onClose: () => void;
}) {
  const [nom, setNom] = useState(contacte?.nom ?? "");
  const [telefon, setTelefon] = useState(contacte?.telefon ?? "");
  const [mail, setMail] = useState(contacte?.mail ?? "");
  const [comentari, setComentari] = useState(contacte?.comentari ?? "");
  const [clientId, setClientId] = useState<number | null>(contacte?.client_id ?? null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!nom.trim() && !telefon.trim() && !mail.trim() && !comentari.trim()) return;
    startTransition(async () => {
      if (contacte) {
        await updateClientContacteAction(contacte.id, { nom, telefon, mail, comentari });
        if ((clientId ?? null) !== (contacte.client_id ?? null)) await setContacteClientAction(contacte.id, clientId);
      } else {
        await createContacteAction({ nom, telefon, mail, comentari, clientId });
      }
      onClose();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom del contacte" /></Field>
        <Field label="Telèfon"><input className="input" value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="Telèfon" /></Field>
        <Field label="Mail"><input className="input" type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="correu@exemple.cat" /></Field>
        <Field label="Client"><Combobox options={clientOpts} value={clientId} onChange={setClientId} placeholder="Cerca client…" emptyLabel="Sense client" overlay /></Field>
        <div className="sm:col-span-2">
          <Field label="Comentari (opcional)"><input className="input" value={comentari} onChange={(e) => setComentari(e.target.value)} placeholder="Notes lliures…" /></Field>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel·lar</button>
      </div>
    </div>
  );
}

// ============================================================================
// Tipologies
// ============================================================================

function TipologiesPanel({ rows }: { rows: Tipologia[] }) {
  const [nom, setNom] = useState("");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((t) => t.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

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

function TasquesPanel({ rows }: { rows: Tasca[] }) {
  const [nom, setNom] = useState("");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((t) => t.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

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
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] bg-white px-3 py-2">
              <span className="text-sm">{t.nom}</span>
              <button
                type="button"
                className="text-red-700 hover:underline text-sm"
                onClick={() => {
                  if (confirm(`Eliminar la tasca "${t.nom}"?`)) {
                    startTransition(() => deleteTascaAction(t.id));
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
        Les tasques apareixen com a suggeriments en registrar la dedicació.
      </p>
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
  statsByClient,
}: {
  rows: Client[];
  statsByClient: Map<number, ClientStats>;
}) {
  const [query, setQuery] = useState("");
  // Track the OPEN client by id and re-derive from rows, so it reflects fresh
  // server data (e.g. a contact just added) without needing to reopen.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = rows.find((c) => c.id === editingId) ?? null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (c) => c.nom.toLowerCase().includes(q) || (c.ciutat ?? "").toLowerCase().includes(q),
      )
    : rows;

  const ciutats = useMemo(
    () => Array.from(new Set(rows.map((c) => (c.ciutat ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ca")),
    [rows],
  );

  function exportPdf() {
    openListPdf({
      title: "Clients",
      subtitle: q ? `Cerca: "${query.trim()}" · ${filtered.length} de ${rows.length}` : `${rows.length} clients`,
      landscape: false,
      columns: [{ label: "Nom" }, { label: "NIF/CIF" }, { label: "Ciutat" }, { label: "CP" }, { label: "Exp.", align: "right" }, { label: "Oberts", align: "right" }],
      rows: filtered.map((c) => {
        const s = statsByClient.get(c.id);
        return [c.nom, c.nif ?? "—", c.ciutat ?? "—", c.codi_postal ?? "—", String(s?.n ?? 0), String(s?.oberts ?? 0)];
      }),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Cercar client…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="btn-ghost ml-auto inline-flex items-center gap-1.5" onClick={exportPdf} title="Genera un PDF dels clients mostrats"><ParamPdfIcon /> PDF</button>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>+ Nou client</button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap client encara." : "Cap resultat."}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const s = statsByClient.get(c.id);
            return (
              <div
                key={c.id}
                onClick={() => setEditingId(c.id)}
                className="cursor-pointer rounded-xl border border-[var(--color-line)] bg-white p-4 text-left shadow-sm transition hover:border-[var(--color-accent)] hover:shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.nom}</div>
                    <div className="text-xs text-[var(--color-muted)] truncate">{c.ciutat ?? "—"}</div>
                  </div>
                  <button type="button" className="shrink-0 text-sm text-[var(--color-accent)] hover:underline" onClick={(e) => { e.stopPropagation(); setEditingId(c.id); }}>Editar</button>
                </div>
                <div className="mt-3 flex gap-4 text-sm">
                  <span><span className="font-semibold tabular-nums">{s?.n ?? 0}</span> <span className="text-[var(--color-muted)]">exp.</span></span>
                  <span><span className="font-semibold tabular-nums text-[var(--color-accent)]">{s?.oberts ?? 0}</span> <span className="text-[var(--color-muted)]">oberts</span></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ClientFormModal
        open={creating || editing != null}
        client={editing}
        stats={editing ? statsByClient.get(editing.id) : undefined}
        ciutats={ciutats}
        onClose={() => { setCreating(false); setEditingId(null); }}
      />
    </div>
  );
}

function ClientFormModal({
  open,
  client,
  stats,
  ciutats,
  onClose,
}: {
  open: boolean;
  client: Client | null;
  stats?: ClientStats;
  ciutats: string[];
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
          stats={client ? stats ?? { client_id: client.id, ...EMPTY_STATS } : null}
          ciutats={ciutats}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function ClientForm({
  client,
  stats,
  ciutats,
  onClose,
}: {
  client: Client | null;
  stats: ClientStats | null;
  ciutats: string[];
  onClose: () => void;
}) {
  const [nom, setNom] = useState(client?.nom ?? "");
  const [nif, setNif] = useState(client?.nif ?? "");
  const [carrer, setCarrer] = useState(client?.carrer ?? "");
  const [ciutat, setCiutat] = useState(client?.ciutat ?? "");
  const [codiPostal, setCodiPostal] = useState(client?.codi_postal ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    if (!nom.trim()) return;
    const patch: ClientPatch = { nom, nif, carrer, ciutat, codi_postal: codiPostal };
    startTransition(async () => {
      if (client) await updateClientAction(client.id, patch);
      else await createClientFullAction(patch);
      onClose();
    });
  }

  const contactes = client?.contactes ?? [];

  return (
    <div className="space-y-6">
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

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Desant…" : "Desar"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel·lar</button>
      </div>

      {client && <ClientContactesSection client={client} contactes={contactes} onDeleted={onClose} />}
    </div>
  );
}

function ClientContactesSection({ client, contactes, onDeleted }: { client: Client; contactes: ClientContacte[]; onDeleted: () => void }) {
  const [, startTransition] = useTransition();
  return (
    <div className="border-t border-[var(--color-line)] pt-5">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Contactes</h4>
        <button type="button" className="btn-ghost px-2.5 py-1 text-sm" onClick={() => startTransition(() => addClientContacteAction(client.id))}>
          + Afegir contacte
        </button>
      </div>
      {contactes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Cap contacte encara.</p>
      ) : (
        <div className="space-y-2">
          {contactes.map((ct) => (
            <ContacteRow key={ct.id} row={ct} />
          ))}
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

function ContacteRow({ row }: { row: ClientContacte }) {
  const [nom, setNom] = useState(row.nom ?? "");
  const [telefon, setTelefon] = useState(row.telefon ?? "");
  const [mail, setMail] = useState(row.mail ?? "");
  const [comentari, setComentari] = useState(row.comentari ?? "");
  const [, startTransition] = useTransition();

  function persist() {
    if (nom !== (row.nom ?? "") || telefon !== (row.telefon ?? "") || mail !== (row.mail ?? "") || comentari !== (row.comentari ?? "")) {
      startTransition(() => updateClientContacteAction(row.id, { nom, telefon, mail, comentari }));
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-12 items-center">
      <input className="input sm:col-span-3" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} />
      <input className="input sm:col-span-2" placeholder="Telèfon" value={telefon} onChange={(e) => setTelefon(e.target.value)} onBlur={persist} />
      <input className="input sm:col-span-3" placeholder="Mail" type="email" value={mail} onChange={(e) => setMail(e.target.value)} onBlur={persist} />
      <input className="input sm:col-span-3" placeholder="Comentari (opcional)" value={comentari} onChange={(e) => setComentari(e.target.value)} onBlur={persist} />
      <div className="sm:col-span-1 text-right">
        <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => { if (confirm("Eliminar aquest contacte?")) startTransition(() => deleteClientContacteAction(row.id)); }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Concepte Despesa Directa
// ============================================================================

function ConceptesDirectesPanel({ rows }: { rows: ConcepteDespesaDirecta[] }) {
  const [nom, setNom] = useState("");
  const [preu, setPreu] = useState("28.27");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((c) => c.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

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

function ConceptesAltresPanel({ rows }: { rows: ConcepteAltraDespesa[] }) {
  const [nom, setNom] = useState("");
  const [preu, setPreu] = useState("0");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = (q ? rows.filter((c) => c.nom.toLowerCase().includes(q)) : rows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, "ca"));

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
