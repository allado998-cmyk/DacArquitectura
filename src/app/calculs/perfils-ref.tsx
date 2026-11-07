"use client";

// "Perfils i soldadures": the catalogue tables David consults while
// calculating (steel profiles, fillet-weld throats and steel grades). Shown as
// a tab of Càlculs and in a side panel of the calculation editor, where the
// profiles in use are highlighted.

import { useEffect, useRef, useState } from "react";
import { FAMILIES, SOLDADURA, soldaduraPer, type PerfilFamily } from "@/lib/calculs/perfils";
import { ACER_GRADES, ACER_PROPS, fmt } from "@/lib/calculs/common";
import { parseLocaleNumber } from "@/lib/format";

const EXTRA_TABS = [
  { key: "soldadura", title: "Soldadures" },
  { key: "acer", title: "Acer" },
];

function familyOf(name: string): string | null {
  return FAMILIES.find((f) => f.rows.some((r) => r.name === name))?.key ?? null;
}

// The search ignores case, spaces and dashes: "ipe200" and "IPE-200" find "IPE 200".
const squash = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");
function matchRows(f: PerfilFamily, q: string) {
  const needle = squash(q);
  return needle ? f.rows.filter((r) => squash(r.name).includes(needle)) : f.rows;
}

// Numbers as printed in the catalogue: keep the decimals the value has.
function cell(v: number | null): string {
  if (v == null) return "—";
  const dec = Math.min(4, (String(v).split(".")[1] ?? "").length);
  return fmt(v, dec);
}

export function PerfilsRef({ highlight = [], initial }: { highlight?: string[]; initial?: string }) {
  const first = initial ?? (highlight.length ? familyOf(highlight[0]) : null) ?? FAMILIES[0]?.key ?? "soldadura";
  const [tab, setTab] = useState<string>(first);
  const [q, setQ] = useState("");

  const fam = FAMILIES.find((f) => f.key === tab) ?? null;

  // A profile that isn't in the open table but is in another one (searching
  // "IPE" with HEB open) switches to the first table that has it.
  function search(v: string) {
    setQ(v);
    if (!v.trim() || (fam && matchRows(fam, v).length)) return;
    const other = FAMILIES.find((f) => matchRows(f, v).length);
    if (other) setTab(other.key);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FAMILIES.map((f) => (
          <Chip key={f.key} active={tab === f.key} onClick={() => setTab(f.key)} marked={f.rows.some((r) => highlight.includes(r.name))}>
            {f.title.replace(/^Perfils /, "")}
          </Chip>
        ))}
        <span className="mx-1 self-center text-[var(--color-line)]">|</span>
        {EXTRA_TABS.map((t) => (
          <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.title}
          </Chip>
        ))}
      </div>

      {fam && <FamilyTable fam={fam} q={q} onSearch={search} onSwitch={setTab} highlight={highlight} />}
      {tab === "soldadura" && <Soldadures />}
      {tab === "acer" && <Acer />}
    </div>
  );
}

function Chip({ active, marked, onClick, children }: { active: boolean; marked?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium ${
        active ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : "border-[var(--color-line)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]"
      }`}
    >
      {children}
      {marked && !active && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] align-middle" />}
    </button>
  );
}

function FamilyTable({
  fam,
  q,
  onSearch,
  onSwitch,
  highlight,
}: {
  fam: PerfilFamily;
  q: string;
  onSearch: (s: string) => void;
  onSwitch: (key: string) => void;
  highlight: string[];
}) {
  const rows = matchRows(fam, q);
  // Other tables with the same search, e.g. "200" is also an HEB and an HEA.
  const elsewhere = q.trim() ? FAMILIES.filter((f) => f.key !== fam.key).map((f) => ({ f, n: matchRows(f, q).length })).filter((x) => x.n > 0) : [];

  // Header bands: consecutive columns sharing a group.
  const groups: { group: string; span: number }[] = [];
  for (const c of fam.columns) {
    const last = groups[groups.length - 1];
    if (last && last.group === c.group) last.span++;
    else groups.push({ group: c.group, span: 1 });
  }
  const hasAvail = fam.rows.some((r) => r.avail);

  // Bring the highlighted profile into view when the table opens.
  const hlRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    hlRef.current?.scrollIntoView({ block: "center" });
  }, [fam.key]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input w-64" placeholder="Cercar perfil… (p. ex. IPE 200)" value={q} onChange={(e) => onSearch(e.target.value)} />
        <span className="text-xs text-[var(--color-muted)]">{rows.length} de {fam.rows.length}</span>
        {elsewhere.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-muted)]">
            També a:
            {elsewhere.map(({ f, n }) => (
              <button key={f.key} type="button" className="rounded-full border border-[var(--color-line)] bg-white px-2 py-0.5 text-[var(--color-ink)] hover:bg-[var(--color-accent-soft)]" onClick={() => onSwitch(f.key)}>
                {f.title.replace(/^Perfils /, "")} ({n})
              </button>
            ))}
          </span>
        )}
        {fam.image && (
          <a href={fam.image} target="_blank" rel="noreferrer" className="ml-auto text-sm text-[var(--color-accent)] hover:underline">
            Veure la taula original ↗
          </a>
        )}
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="w-max min-w-full border-collapse text-xs tabular-nums">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[var(--color-accent)] text-white">
              <th rowSpan={2} className="sticky left-0 z-10 bg-[var(--color-accent)] px-3 py-1.5 text-left font-semibold">Perfil</th>
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className="border-l border-white/20 px-2 py-1 text-center font-medium">
                  {g.group}
                </th>
              ))}
              {hasAvail && <th rowSpan={2} className="border-l border-white/20 px-2 py-1" />}
            </tr>
            <tr className="bg-[#2d6352] text-white">
              {fam.columns.map((c) => (
                <th key={c.key} className="border-l border-white/10 px-2 py-1 text-right font-medium" title={fam.legend.find((l) => l.sym === c.label)?.desc}>
                  <div>{c.label}</div>
                  <div className="text-[10px] font-normal opacity-80">{c.unit}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hl = highlight.includes(r.name);
              return (
                <tr key={r.name} ref={hl ? hlRef : undefined} className={hl ? "bg-amber-100" : "odd:bg-white even:bg-[var(--color-paper)]"}>
                  <td className={`sticky left-0 whitespace-nowrap px-3 py-1 font-semibold ${hl ? "bg-amber-100" : "bg-inherit"}`}>
                    {r.name}
                    {r.extra && <span className="ml-1 text-[var(--color-muted)]" title={fam.note}>*</span>}
                  </td>
                  {r.v.map((v, i) => (
                    <td key={i} className="whitespace-nowrap px-2 py-1 text-right">{cell(v)}</td>
                  ))}
                  {hasAvail && <td className="px-2 py-1 text-center text-[var(--color-muted)]">{r.avail ?? ""}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="text-sm text-[var(--color-muted)]">Cap perfil amb «{q.trim()}».</p>}
      {fam.note && <p className="text-xs text-[var(--color-muted)]">* {fam.note}</p>}
      {fam.legend.length > 0 && (
        <dl className="grid gap-x-6 gap-y-0.5 text-xs text-[var(--color-muted)] sm:grid-cols-2">
          {fam.legend.map((l, i) => (
            <div key={i} className="flex gap-2">
              <dt className="w-10 shrink-0 font-semibold text-[var(--color-ink)]">{l.sym}</dt>
              <dd>{l.desc}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function Soldadures() {
  const [t, setT] = useState("");
  const tNum = parseLocaleNumber(t);
  const hit = Number.isFinite(tNum) ? soldaduraPer(tNum) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Gruix de la peça (mm)</label>
          <input className="input w-40" inputMode="decimal" placeholder="p. ex. 10" value={t} onChange={(e) => setT(e.target.value)} />
        </div>
        {t.trim() !== "" && (
          <p className="pb-2 text-sm">
            {hit ? (
              <>
                Gola <b>a</b>: mínima <b>{fmt(hit.aMin, 1)} mm</b> · màxima <b>{fmt(hit.aMax, 1)} mm</b>
              </>
            ) : (
              <span className="text-[var(--color-muted)]">Fora de la taula (4,0 – 36,0 mm).</span>
            )}
          </p>
        )}
        <a href="/calculs/perfils/soldadura.jpg" target="_blank" rel="noreferrer" className="ml-auto pb-2 text-sm text-[var(--color-accent)] hover:underline">
          Veure la taula original ↗
        </a>
      </div>
      <p className="text-sm font-medium">Valors límit de la gola d&apos;una soldadura en angle</p>
      {/* As wide as its content, so each thickness sits close to its throats. */}
      <div className="max-h-[60vh] w-fit max-w-full overflow-auto rounded-lg border border-[var(--color-line)] bg-white">
        <table className="text-sm tabular-nums">
          <thead className="sticky top-0 bg-[var(--color-accent)] text-white">
            <tr>
              <th className="px-3 py-1.5 text-left font-semibold">Gruix de la peça (mm)</th>
              <th className="px-3 py-1.5 text-right font-semibold">Gola màxima (mm)</th>
              <th className="px-3 py-1.5 text-right font-semibold">Gola mínima (mm)</th>
            </tr>
          </thead>
          <tbody>
            {SOLDADURA.map((s, i) => {
              const hl = hit === s;
              return (
                <tr key={i} className={hl ? "bg-amber-100" : "odd:bg-white even:bg-[var(--color-paper)]"}>
                  <td className="px-3 py-1">{fmt(s.tMin, 1)} – {fmt(s.tMax, 1)}</td>
                  <td className="px-3 py-1 text-right">{fmt(s.aMax, 1)}</td>
                  <td className="px-3 py-1 text-right">{fmt(s.aMin, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Acer() {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">CTE DB SE-A · Acers en xapes i perfils</p>
        <div className="table-wrap">
          <table className="table-compact text-sm tabular-nums">
            <thead>
              <tr>
                <th className="th">Designació</th>
                <th className="th text-right">fy · t ≤ 16</th>
                <th className="th text-right">fy · 16 &lt; t ≤ 40</th>
                <th className="th text-right">fy · 40 &lt; t ≤ 63</th>
                <th className="th text-right">fu · 3 ≤ t ≤ 100</th>
              </tr>
            </thead>
            <tbody>
              {ACER_GRADES.map((g) => (
                <tr key={g.nom}>
                  <td className="td font-semibold">{g.nom}</td>
                  <td className="td text-right">{g.fy16}</td>
                  <td className="td text-right">{g.fy40}</td>
                  <td className="td text-right">{g.fy63}</td>
                  <td className="td text-right">{g.fu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">Tensions en N/mm²; t = gruix nominal en mm.</p>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <Prop label="Mòdul d'elasticitat E" value={`${fmt(ACER_PROPS.E, 0)} N/mm²`} />
        <Prop label="Mòdul de rigidesa G" value={`${fmt(ACER_PROPS.G, 0)} N/mm²`} />
        <Prop label="Coeficient de Poisson ν" value={fmt(ACER_PROPS.nu, 1)} />
        <Prop label="Coef. de dilatació tèrmica α" value={ACER_PROPS.alpha} />
        <Prop label="Densitat ρ" value={`${fmt(ACER_PROPS.rho, 0)} kg/m³`} />
        <Prop label="Coef. parcial γM0 (CTE DB SE-A)" value="1,05" />
      </div>
    </div>
  );
}

function Prop({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-white px-3 py-2">
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}
