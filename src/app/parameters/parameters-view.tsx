"use client";

import { useState, useTransition } from "react";
import {
  createClientAction,
  createConcepteAltraAction,
  createConcepteDirectaAction,
  createProjecteAction,
  deleteClientAction,
  deleteConcepteAltraAction,
  deleteConcepteDirectaAction,
  deleteProjecteAction,
  updateClientAction,
  updateConcepteAltraAction,
  updateConcepteDirectaAction,
  updateProjecteAction,
} from "./actions";
import type {
  Client,
  ConcepteAltraDespesa,
  ConcepteDespesaDirecta,
  Projecte,
} from "@/types/db";
import { formatEurPrecise } from "@/lib/format";

type Tab = "projectes" | "clients" | "directes" | "altres";

export function ParametersView({
  projectes,
  clients,
  conceptesDirectes,
  conceptesAltres,
}: {
  projectes: Projecte[];
  clients: Client[];
  conceptesDirectes: ConcepteDespesaDirecta[];
  conceptesAltres: ConcepteAltraDespesa[];
}) {
  const [tab, setTab] = useState<Tab>("projectes");

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-6 border-b border-[var(--color-line)]">
        <TabBtn current={tab} value="projectes" onClick={setTab}>Projectes ({projectes.length})</TabBtn>
        <TabBtn current={tab} value="clients" onClick={setTab}>Clients ({clients.length})</TabBtn>
        <TabBtn current={tab} value="directes" onClick={setTab}>Despeses Directes ({conceptesDirectes.length})</TabBtn>
        <TabBtn current={tab} value="altres" onClick={setTab}>Altres Despeses ({conceptesAltres.length})</TabBtn>
      </div>

      {tab === "projectes" && <ProjectesPanel rows={projectes} />}
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
// Projectes
// ============================================================================

function ProjectesPanel({ rows }: { rows: Projecte[] }) {
  const [nom, setNom] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = nom;
          if (!value.trim()) return;
          startTransition(() => createProjecteAction(value));
          setNom("");
        }}
        className="flex gap-2 max-w-xl"
      >
        <input
          className="input"
          placeholder="Nom del projecte"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <button className="btn-primary" type="submit">+ Afegir</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Cap projecte encara.</p>
      ) : (
        <div className="table-wrap max-w-3xl">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th w-32"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <ProjecteRow key={p.id} row={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjecteRow({ row }: { row: Projecte }) {
  const [nom, setNom] = useState(row.nom);
  const [, startTransition] = useTransition();
  return (
    <tr>
      <td className="td">
        <input
          className="input"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => {
            if (nom !== row.nom && nom.trim()) {
              startTransition(() => updateProjecteAction(row.id, nom));
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
              startTransition(() => deleteProjecteAction(row.id));
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
// Clients
// ============================================================================

function ClientsPanel({ rows }: { rows: Client[] }) {
  const [nom, setNom] = useState("");
  const [contacte, setContacte] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          startTransition(() => createClientAction(nom, contacte));
          setNom("");
          setContacte("");
        }}
        className="grid gap-2 sm:grid-cols-3 max-w-2xl"
      >
        <input className="input" placeholder="Nom del client" value={nom} onChange={(e) => setNom(e.target.value)} />
        <input className="input" placeholder="Contacte (opcional)" value={contacte} onChange={(e) => setContacte(e.target.value)} />
        <button className="btn-primary" type="submit">+ Afegir</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Cap client encara.</p>
      ) : (
        <div className="table-wrap max-w-4xl">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Nom</th>
                <th className="th">Contacte</th>
                <th className="th w-32"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <ClientRow key={c.id} row={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ClientRow({ row }: { row: Client }) {
  const [nom, setNom] = useState(row.nom);
  const [contacte, setContacte] = useState(row.contacte ?? "");
  const [, startTransition] = useTransition();

  function persist() {
    if (!nom.trim()) return;
    if (nom !== row.nom || contacte !== (row.contacte ?? "")) {
      startTransition(() => updateClientAction(row.id, nom, contacte));
    }
  }

  return (
    <tr>
      <td className="td"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} /></td>
      <td className="td"><input className="input" value={contacte} onChange={(e) => setContacte(e.target.value)} onBlur={persist} /></td>
      <td className="td text-right">
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
      </td>
    </tr>
  );
}

// ============================================================================
// Concepte Despesa Directa
// ============================================================================

function ConceptesDirectesPanel({ rows }: { rows: ConcepteDespesaDirecta[] }) {
  const [nom, setNom] = useState("");
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nom.trim()) return;
          startTransition(() => createConcepteDirectaAction(nom));
          setNom("");
        }}
        className="flex gap-2 max-w-xl"
      >
        <input className="input" placeholder="Nou concepte (ex: Visita d'obra)" value={nom} onChange={(e) => setNom(e.target.value)} />
        <button className="btn-primary" type="submit">+ Afegir</button>
      </form>

      <div className="table-wrap max-w-3xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Concepte</th>
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
        Desactivar amaga el concepte als nous formularis sense esborrar línies existents.
      </p>
    </div>
  );
}

function ConcepteDirectaRow({ row }: { row: ConcepteDespesaDirecta }) {
  const [nom, setNom] = useState(row.nom);
  const [actiu, setActiu] = useState(row.actiu);
  const [, startTransition] = useTransition();

  function persist() {
    if (!nom.trim()) return;
    if (nom !== row.nom || actiu !== row.actiu) {
      startTransition(() => updateConcepteDirectaAction(row.id, nom, actiu));
    }
  }

  return (
    <tr>
      <td className="td"><input className="input" value={nom} onChange={(e) => setNom(e.target.value)} onBlur={persist} /></td>
      <td className="td">
        <input
          type="checkbox"
          checked={actiu}
          onChange={(e) => {
            setActiu(e.target.checked);
            startTransition(() => updateConcepteDirectaAction(row.id, nom, e.target.checked));
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
        <input
          type="number"
          step="0.0001"
          className="input text-right"
          value={preu}
          onChange={(e) => setPreu(e.target.value)}
          onBlur={persist}
        />
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
