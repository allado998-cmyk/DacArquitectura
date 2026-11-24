"use client";

// "Límits fletxes": the deformation limits David consults (from his
// spreadsheet), as a tab of Càlculs › Referència next to "Perfils i
// soldadures": the summary table, a calculator, the limits for usual spans and
// the standards they come from.

import { useState } from "react";
import {
  CANVIS_CRITERI,
  CRITERIS,
  FLETXES_DEFAULT,
  LLUMS,
  NORMATIVA,
  NORMATIVA_ESTAT,
  PER_LLUM,
  QUADRE,
  QUADRE_COLUMNES,
  QUADRE_SUBTITOL,
  QUADRE_TITOL,
  REGLES,
  adoptat,
  type Material,
} from "@/lib/calculs/fletxes";
import { fmt } from "@/lib/calculs/common";
import { parseLocaleNumber } from "@/lib/format";

const TABS = [
  { key: "quadre", title: "Quadre resum" },
  { key: "calculadora", title: "Calculadora" },
  { key: "llums", title: "Taula per llums" },
  { key: "normativa", title: "Normativa" },
];

/** Millimetres: whole numbers as they are, the rest with one decimal. */
function mmText(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return fmt(r, Number.isInteger(r) ? 0 : 1);
}

export function FletxesRef() {
  const [tab, setTab] = useState("quadre");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tab === t.key ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"
            }`}
          >
            {t.title}
          </button>
        ))}
      </div>
      {tab === "quadre" && <Quadre />}
      {tab === "calculadora" && <Calculadora />}
      {tab === "llums" && <PerLlums />}
      {tab === "normativa" && <Normativa />}
    </div>
  );
}

function Quadre() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{QUADRE_TITOL}</p>
        <p className="text-xs text-[var(--color-muted)]">{QUADRE_SUBTITOL}</p>
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[60rem] border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-accent)] text-white">
              <th className="px-2 py-1.5 text-left font-semibold">#</th>
              {QUADRE_COLUMNES.map((c) => (
                <th key={c} className={`border-l border-white/20 px-2 py-1.5 text-left font-semibold ${c === "Criteri a adoptar" ? "bg-[#2d6352]" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUADRE.map((r, i) => (
              <tr key={i} className="align-top odd:bg-white even:bg-[var(--color-paper)]">
                <td className="px-2 py-1.5 font-semibold tabular-nums">{i + 1}</td>
                {r.map((cell, j) => (
                  <td
                    key={j}
                    className={`whitespace-pre-line px-2 py-1.5 ${j === 0 ? "font-medium" : ""} ${j >= 3 && j <= 6 ? "tabular-nums" : ""} ${
                      j === 6 ? "font-semibold text-[var(--color-accent)]" : ""
                    } ${j === 7 ? "text-[var(--color-muted)]" : ""}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <p className="mb-1 text-sm font-medium">Regles de càlcul comunes</p>
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {REGLES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Calculadora() {
  const [L, setL] = useState(String(FLETXES_DEFAULT.L));
  const [H, setH] = useState(String(FLETXES_DEFAULT.H));
  const [h, setHp] = useState(String(FLETXES_DEFAULT.h));
  const [material, setMaterial] = useState<Material>(FLETXES_DEFAULT.material);
  const [fletxa, setFletxa] = useState<Record<number, string>>({});

  const x = { L: parseLocaleNumber(L), H: parseLocaleNumber(H), h: parseLocaleNumber(h), material };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="fl-L">Llum de càlcul L (m)</label>
          <input id="fl-L" className="input w-32" inputMode="decimal" value={L} onChange={(e) => setL(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fl-H">Alçada total de l&apos;edifici H (m)</label>
          <input id="fl-H" className="input w-32" inputMode="decimal" value={H} onChange={(e) => setH(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fl-h">Alçada de planta h (m)</label>
          <input id="fl-h" className="input w-32" inputMode="decimal" value={h} onChange={(e) => setHp(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="fl-mat">Material de l&apos;element</label>
          <select id="fl-mat" className="input w-36" value={material} onChange={(e) => setMaterial(e.target.value as Material)}>
            <option value="formigo">Formigó</option>
            <option value="acer">Acer</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-[var(--color-muted)]">Voladís: L = 2 × longitud. Escriu la fletxa calculada d&apos;un criteri per comprovar si compleix.</p>
      <div className="overflow-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[52rem] border-collapse text-xs tabular-nums">
          <thead>
            <tr className="bg-[var(--color-accent)] text-white">
              <th className="px-2 py-1.5 text-left font-semibold">#</th>
              <th className="px-2 py-1.5 text-left font-semibold">Criteri</th>
              <th className="px-2 py-1.5 text-right font-semibold">Límit relatiu (mm)</th>
              <th className="px-2 py-1.5 text-right font-semibold">Límit absolut (mm)</th>
              <th className="bg-[#2d6352] px-2 py-1.5 text-right font-semibold">Límit adoptat (mm)</th>
              <th className="px-2 py-1.5 text-right font-semibold">Fletxa calculada (mm)</th>
              <th className="px-2 py-1.5 text-center font-semibold">Compleix?</th>
              <th className="px-2 py-1.5 text-left font-semibold">Regla</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIS.map((c) => {
              const lim = adoptat(c, x);
              const f = parseLocaleNumber(fletxa[c.n] ?? "");
              const checked = Number.isFinite(f) && Number.isFinite(lim);
              const ok = checked && f <= lim + 1e-9;
              return (
                <tr key={c.n} className={c.n >= 6 && c.n <= 7 ? "bg-[var(--color-paper)]" : "bg-white"}>
                  <td className="border-t border-[var(--color-line)] px-2 py-1 font-semibold">{c.n}</td>
                  <td className="border-t border-[var(--color-line)] px-2 py-1">{c.criteri}</td>
                  <td className="border-t border-[var(--color-line)] px-2 py-1 text-right">{mmText(c.relatiu(x))}</td>
                  <td className="border-t border-[var(--color-line)] px-2 py-1 text-right">{c.absolut ? mmText(c.absolut(x)) : "—"}</td>
                  <td className="border-t border-[var(--color-line)] bg-[var(--color-accent-soft)] px-2 py-1 text-right font-bold text-[var(--color-accent)]">{mmText(lim)}</td>
                  <td className="border-t border-[var(--color-line)] px-2 py-1 text-right">
                    <input
                      className="input h-7 w-24 px-2 py-0 text-right text-xs"
                      inputMode="decimal"
                      aria-label={`Fletxa calculada, criteri ${c.n}`}
                      value={fletxa[c.n] ?? ""}
                      onChange={(e) => setFletxa((s) => ({ ...s, [c.n]: e.target.value }))}
                    />
                  </td>
                  <td className="border-t border-[var(--color-line)] px-2 py-1 text-center">
                    {checked ? (
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>{ok ? "Compleix" : "No compleix"}</span>
                    ) : (
                      ""
                    )}
                  </td>
                  <td className="border-t border-[var(--color-line)] px-2 py-1 text-[var(--color-muted)]">{c.regla}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">Files 6–7: criteri del projectista, no normatiu.</p>
    </div>
  );
}

function PerLlums() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Fletxes admissibles (mm) per a llums habituals</p>
        <p className="text-xs text-[var(--color-muted)]">Criteri adoptat (el més restrictiu). Per a una altra llum, fes servir la calculadora.</p>
      </div>
      <div className="w-fit max-w-full overflow-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="border-collapse text-xs tabular-nums">
          <thead>
            <tr className="bg-[var(--color-accent)] text-white">
              <th className="px-3 py-1.5 text-left font-semibold">Criteri \ Llum L (m)</th>
              {LLUMS.map((L) => (
                <th key={L} className="border-l border-white/20 px-3 py-1.5 text-right font-semibold">{L}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PER_LLUM.map((r) => (
              <tr key={r.criteri} className="odd:bg-white even:bg-[var(--color-paper)]">
                <td className="whitespace-nowrap px-3 py-1 font-medium">{r.criteri}</td>
                {LLUMS.map((L) => (
                  <td key={L} className="px-3 py-1 text-right">{mmText(r.f(L))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-muted)]">{CANVIS_CRITERI}</p>
    </div>
  );
}

function Normativa() {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Normativa de referència</p>
        <p className="text-xs text-[var(--color-muted)]">{NORMATIVA_ESTAT}</p>
      </div>
      <div className="table-wrap">
        <table className="table-compact text-sm">
          <thead>
            <tr>
              <th className="th">Àmbit</th>
              <th className="th">Norma</th>
              <th className="th">Estat</th>
              <th className="th">Observacions</th>
            </tr>
          </thead>
          <tbody>
            {NORMATIVA.map((n) => (
              <tr key={n.norma}>
                <td className="td">{n.ambit}</td>
                <td className="td font-semibold">{n.norma}</td>
                <td className={`td whitespace-nowrap ${n.estat.startsWith("Derogada") ? "text-[var(--color-muted)]" : "text-green-800"}`}>{n.estat}</td>
                <td className="td text-[var(--color-muted)]">{n.obs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
