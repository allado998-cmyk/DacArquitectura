"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addClientContacteAction,
  createClientAction,
  createConcepteAltraAction,
  createConcepteDirectaAction,
  createContacteAction,
  createTipologiaAction,
  deleteClientAction,
  deleteClientContacteAction,
  deleteConcepteAltraAction,
  deleteConcepteDirectaAction,
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
  Tipologia,
} from "@/types/db";
import { formatEur, formatEurPrecise } from "@/lib/format";
import { Modal } from "@/components/modal";
import { Combobox, type ComboOption } from "@/components/combobox";
import { KpiCard } from "@/components/charts";

type Tab = "clients" | "contactes" | "directes" | "altres" | "tipologies";

const EMPTY_STATS: Omit<ClientStats, "client_id"> = { n: 0, oberts: 0, pressupost_total: "0", pressupost_obert: "0" };

export function ParametersView({
  clients,
  clientStats,
  conceptesDirectes,
  conceptesAltres,
  tipologies,
  contactes,
}: {
  clients: Client[];
  clientStats: ClientStats[];
  conceptesDirectes: ConcepteDespesaDirecta[];
  conceptesAltres: ConcepteAltraDespesa[];
  tipologies: Tipologia[];
  contactes: ClientContacte[];
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
        <TabBtn current={tab} value="directes" onClick={setTab}>Despeses Directes ({conceptesDirectes.length})</TabBtn>
        <TabBtn current={tab} value="altres" onClick={setTab}>Altres Despeses ({conceptesAltres.length})</TabBtn>
      </div>

      {tab === "clients" && <ClientsPanel rows={clients} statsByClient={statsByClient} />}
      {tab === "contactes" && <ContactesPanel rows={contactes} clients={clients} />}
      {tab === "tipologies" && <TipologiesPanel rows={tipologies} />}
      {tab === "directes" && <ConceptesDirectesPanel rows={conceptesDirectes} />}
      {tab === "altres" && <ConceptesAltresPanel rows={conceptesAltres} />}
    </div>
  );
}

// ============================================================================
// Contactes (flat list across all clients + standalone)
// ============================================================================

function ContactesPanel({ rows, clients }: { rows: ClientContacte[]; clients: Client[] }) {
  const [nom, setNom] = useState("");
  const [telefon, setTelefon] = useState("");
  const [mail, setMail] = useState("");
  const [query, setQuery] = useState("");
  const [, startTransition] = useTransition();

  const clientOpts: ComboOption[] = clients.map((c) => ({ id: c.id, label: c.nom }));

  const q = query.trim().toLowerCase();
  const filtered = (q
    ? rows.filter((r) => `${r.nom ?? ""} ${r.telefon ?? ""} ${r.mail ?? ""} ${r.client_nom ?? ""}`.toLowerCase().includes(q))
    : rows
  ).slice().sort((a, b) => (a.nom ?? "￿").localeCompare(b.nom ?? "￿", "ca"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="Cercar contacte…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nom.trim() && !telefon.trim() && !mail.trim()) return;
            startTransition(() => createContacteAction({ nom, telefon, mail }));
            setNom("");
            setTelefon("");
            setMail("");
          }}
          className="ml-auto grid grid-cols-2 gap-2 sm:flex"
        >
          <input className="input" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          <input className="input" placeholder="Telèfon" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
          <input className="input" placeholder="Mail" value={mail} onChange={(e) => setMail(e.target.value)} />
          <button className="btn-primary" type="submit">+ Afegir</button>
        </form>
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
                <th className="th w-56">Client</th>
                <th className="th w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <ContacteFlatRow key={c.id} row={c} clientOpts={clientOpts} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContacteFlatRow({ row, clientOpts }: { row: ClientContacte; clientOpts: ComboOption[] }) {
  const [nom, setNom] = useState(row.nom ?? "");
  const [telefon, setTelefon] = useState(row.telefon ?? "");
  const [mail, setMail] = useState(row.mail ?? "");
  const [, startTransition] = useTransition();

  function persist() {
    if (nom !== (row.nom ?? "") || telefon !== (row.telefon ?? "") || mail !== (row.mail ?? "")) {
      startTransition(() => updateClientContacteAction(row.id, { nom, telefon, mail }));
    }
  }

  return (
    <tr>
      <td className="td"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} /></td>
      <td className="td"><input className="input" value={telefon} onChange={(e) => setTelefon(e.target.value)} onBlur={persist} /></td>
      <td className="td"><input className="input" type="email" value={mail} onChange={(e) => setMail(e.target.value)} onBlur={persist} /></td>
      <td className="td">
        <Combobox options={clientOpts} value={row.client_id} onChange={(v) => startTransition(() => setContacteClientAction(row.id, v))} placeholder="Cerca client…" emptyLabel="Sense client" overlay />
      </td>
      <td className="td text-right">
        <button type="button" className="text-red-700 hover:underline text-sm" onClick={() => { if (confirm("Eliminar aquest contacte?")) startTransition(() => deleteClientContacteAction(row.id)); }}>✕</button>
      </td>
    </tr>
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
  const [nom, setNom] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (c) => c.nom.toLowerCase().includes(q) || (c.ciutat ?? "").toLowerCase().includes(q),
      )
    : rows;

  const openClient = rows.find((c) => c.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Cercar client…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!nom.trim()) return;
            startTransition(() => createClientAction(nom));
            setNom("");
          }}
          className="flex gap-2 ml-auto"
        >
          <input className="input" placeholder="Nom del nou client" value={nom} onChange={(e) => setNom(e.target.value)} />
          <button className="btn-primary" type="submit">+ Afegir</button>
        </form>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">{rows.length === 0 ? "Cap client encara." : "Cap resultat."}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const s = statsByClient.get(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setOpenId(c.id)}
                className="rounded-xl border border-[var(--color-line)] bg-white p-4 text-left shadow-sm transition hover:border-[var(--color-accent)] hover:shadow"
              >
                <div className="font-medium truncate">{c.nom}</div>
                <div className="text-xs text-[var(--color-muted)] truncate">{c.ciutat ?? "—"}</div>
                <div className="mt-3 flex gap-4 text-sm">
                  <span><span className="font-semibold tabular-nums">{s?.n ?? 0}</span> <span className="text-[var(--color-muted)]">exp.</span></span>
                  <span><span className="font-semibold tabular-nums text-[var(--color-accent)]">{s?.oberts ?? 0}</span> <span className="text-[var(--color-muted)]">oberts</span></span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ClientModal client={openClient} stats={openClient ? statsByClient.get(openClient.id) : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ClientModal({
  client,
  stats,
  onClose,
}: {
  client: Client | null;
  stats?: ClientStats;
  onClose: () => void;
}) {
  return (
    <Modal
      open={client != null}
      onClose={onClose}
      wide
      title={client && <h3 className="text-lg font-semibold tracking-tight">{client.nom}</h3>}
    >
      {client && <ClientEditor key={client.id} client={client} stats={stats ?? { client_id: client.id, ...EMPTY_STATS }} onDeleted={onClose} />}
    </Modal>
  );
}

function ClientEditor({
  client,
  stats,
  onDeleted,
}: {
  client: Client;
  stats: ClientStats;
  onDeleted: () => void;
}) {
  const [nom, setNom] = useState(client.nom);
  const [nif, setNif] = useState(client.nif ?? "");
  const [carrer, setCarrer] = useState(client.carrer ?? "");
  const [ciutat, setCiutat] = useState(client.ciutat ?? "");
  const [codiPostal, setCodiPostal] = useState(client.codi_postal ?? "");
  const [, startTransition] = useTransition();

  function persist() {
    if (!nom.trim()) return;
    const patch: ClientPatch = { nom, nif, carrer, ciutat, codi_postal: codiPostal };
    if (
      nom !== client.nom ||
      nif !== (client.nif ?? "") ||
      carrer !== (client.carrer ?? "") ||
      ciutat !== (client.ciutat ?? "") ||
      codiPostal !== (client.codi_postal ?? "")
    ) {
      startTransition(() => updateClientAction(client.id, patch));
    }
  }

  const contactes = client.contactes ?? [];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Expedients" value={String(stats.n)} accent="#1f4d3f" />
        <KpiCard label="Oberts" value={String(stats.oberts)} accent="#ef4444" />
        <KpiCard label="Pressupost total" value={formatEur(stats.pressupost_total)} accent="#0ea5e9" />
        <KpiCard label="Pressupost en obert" value={formatEur(stats.pressupost_obert)} accent="#a855f7" />
      </div>

      {/* Dades */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nom">
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} />
        </Field>
        <Field label="NIF / CIF">
          <input className="input" value={nif} onChange={(e) => setNif(e.target.value)} onBlur={persist} />
        </Field>
        <Field label="Carrer">
          <input className="input" value={carrer} onChange={(e) => setCarrer(e.target.value)} onBlur={persist} />
        </Field>
        <Field label="Ciutat">
          <input className="input" value={ciutat} onChange={(e) => setCiutat(e.target.value)} onBlur={persist} />
        </Field>
        <Field label="Codi postal">
          <input className="input" value={codiPostal} onChange={(e) => setCodiPostal(e.target.value)} onBlur={persist} />
        </Field>
      </div>

      {/* Contactes */}
      <div>
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
      </div>

      <div className="border-t border-[var(--color-line)] pt-4">
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
  const [, startTransition] = useTransition();

  function persist() {
    if (nom !== (row.nom ?? "") || telefon !== (row.telefon ?? "") || mail !== (row.mail ?? "")) {
      startTransition(() => updateClientContacteAction(row.id, { nom, telefon, mail }));
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-12 items-center">
      <input className="input sm:col-span-4" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} />
      <input className="input sm:col-span-3" placeholder="Telèfon" value={telefon} onChange={(e) => setTelefon(e.target.value)} onBlur={persist} />
      <input className="input sm:col-span-4" placeholder="Mail" type="email" value={mail} onChange={(e) => setMail(e.target.value)} onBlur={persist} />
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
