"use client";

import { useState, useTransition } from "react";
import {
  addClientContacteAction,
  createClientAction,
  createConcepteAltraAction,
  createConcepteDirectaAction,
  deleteClientAction,
  deleteClientContacteAction,
  deleteConcepteAltraAction,
  deleteConcepteDirectaAction,
  updateClientAction,
  updateClientContacteAction,
  updateConcepteAltraAction,
  updateConcepteDirectaAction,
  type ClientPatch,
} from "./actions";
import type {
  Client,
  ClientContacte,
  ConcepteAltraDespesa,
  ConcepteDespesaDirecta,
} from "@/types/db";
import { formatEurPrecise } from "@/lib/format";

type Tab = "clients" | "directes" | "altres";

export function ParametersView({
  clients,
  conceptesDirectes,
  conceptesAltres,
}: {
  clients: Client[];
  conceptesDirectes: ConcepteDespesaDirecta[];
  conceptesAltres: ConcepteAltraDespesa[];
}) {
  const [tab, setTab] = useState<Tab>("clients");

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="clients" onClick={setTab}>Clients ({clients.length})</TabBtn>
        <TabBtn current={tab} value="directes" onClick={setTab}>Despeses Directes ({conceptesDirectes.length})</TabBtn>
        <TabBtn current={tab} value="altres" onClick={setTab}>Altres Despeses ({conceptesAltres.length})</TabBtn>
      </div>

      {tab === "clients" && <ClientsPanel rows={clients} />}
      {tab === "directes" && <ConceptesDirectesPanel rows={conceptesDirectes} />}
      {tab === "altres" && <ConceptesAltresPanel rows={conceptesAltres} />}
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

function ClientsPanel({ rows }: { rows: Client[] }) {
  const [nom, setNom] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          startTransition(() => createClientAction(nom));
          setNom("");
        }}
        className="flex gap-2 max-w-xl"
      >
        <input className="input" placeholder="Nom del nou client" value={nom} onChange={(e) => setNom(e.target.value)} />
        <button className="btn-primary" type="submit">+ Afegir</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Cap client encara.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <ClientCard key={c.id} row={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({ row }: { row: Client }) {
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState(row.nom);
  const [nif, setNif] = useState(row.nif ?? "");
  const [carrer, setCarrer] = useState(row.carrer ?? "");
  const [ciutat, setCiutat] = useState(row.ciutat ?? "");
  const [codiPostal, setCodiPostal] = useState(row.codi_postal ?? "");
  const [, startTransition] = useTransition();

  function persist() {
    if (!nom.trim()) return;
    const patch: ClientPatch = { nom, nif, carrer, ciutat, codi_postal: codiPostal };
    if (
      nom !== row.nom ||
      nif !== (row.nif ?? "") ||
      carrer !== (row.carrer ?? "") ||
      ciutat !== (row.ciutat ?? "") ||
      codiPostal !== (row.codi_postal ?? "")
    ) {
      startTransition(() => updateClientAction(row.id, patch));
    }
  }

  const contactes = row.contactes ?? [];

  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white">
      <div className="flex items-center gap-3 p-3">
        <button type="button" className="text-[var(--color-muted)] text-xs w-4" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"}
        </button>
        <input
          className="input max-w-sm font-medium"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={persist}
        />
        <span className="text-sm text-[var(--color-muted)]">{nif || "Sense NIF/CIF"}</span>
        <span className="ml-auto text-xs text-[var(--color-muted)]">
          {contactes.length} contacte{contactes.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          className="text-red-700 hover:underline text-sm"
          onClick={() => {
            if (confirm(`Eliminar "${row.nom}"?`)) {
              startTransition(() => deleteClientAction(row.id));
            }
          }}
        >
          Eliminar
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--color-line)] p-4 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Contactes</h4>
              <button
                type="button"
                className="btn-ghost px-2.5 py-1 text-sm"
                onClick={() => startTransition(() => addClientContacteAction(row.id))}
              >
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
        </div>
      )}
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
        <button
          type="button"
          className="text-red-700 hover:underline text-sm"
          onClick={() => startTransition(() => deleteClientContacteAction(row.id))}
        >
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
  const [, startTransition] = useTransition();

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

      <div className="table-wrap max-w-3xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Concepte</th>
              <th className="th w-32">€ / hora per defecte</th>
              <th className="th w-20">Actiu</th>
              <th className="th w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <ConcepteDirectaRow key={c.id} row={c} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Canviar el preu aquí no modifica propostes ja creades — només els valors per defecte de les noves línies.
        Desactivar amaga el concepte als nous formularis sense esborrar línies existents.
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
  const [, startTransition] = useTransition();

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

      <div className="table-wrap max-w-4xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Concepte</th>
              <th className="th w-40">€ / unitat per defecte</th>
              <th className="th w-20">Actiu</th>
              <th className="th w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
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
