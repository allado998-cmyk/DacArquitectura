"use client";

import { useMemo } from "react";
import { catId, catLabel, categoriaDeTipus, CATALEG_LABELS, type Cataleg } from "@/lib/ite/cataleg";
import { fieldValue, getAt, withField } from "@/lib/ite/model";
import { TRI_OPTIONS, type FieldDef, type GroupDef } from "@/lib/ite/schema";
import { isObj, type IteObj } from "@/lib/ite/xml";
import { useDraft, useIte } from "./ite-context";

// Options of a code list; the current value is kept even if the list does not
// have it (a report imported before the list learnt it).
export function catOptions(cataleg: Cataleg, cat: string, current: IteObj | string | undefined): { value: string; label: string; group?: string }[] {
  const list = cataleg[cat] ?? [];
  const opts = list.map((o) => ({ value: catId(o), label: catLabel(o), group: cat === "tipus_deficiencia" ? groupOfTipus(cataleg, o) : undefined }));
  const curId = isObj(current) ? catId(current) : typeof current === "string" ? current : "";
  if (curId && !opts.some((o) => o.value === curId)) opts.push({ value: curId, label: isObj(current) ? catLabel(current) : `(id ${curId})`, group: undefined });
  return opts;
}

function groupOfTipus(cataleg: Cataleg, tipus: IteObj): string {
  const c = categoriaDeTipus(cataleg, tipus);
  return c ? catLabel(c) : "Altres";
}

export function CatSelect({ cat, value, onChange, className = "input", placeholder = "—" }: { cat: string; value: IteObj | string | undefined; onChange: (id: string) => void; className?: string; placeholder?: string }) {
  const { cataleg } = useIte();
  const opts = useMemo(() => catOptions(cataleg, cat, value), [cataleg, cat, value]);
  const cur = isObj(value) ? catId(value) : typeof value === "string" ? value : "";
  const groups = Array.from(new Set(opts.map((o) => o.group).filter(Boolean))) as string[];
  return (
    <select className={className} value={cur} onChange={(e) => onChange(e.target.value)} title={CATALEG_LABELS[cat]}>
      <option value="">{placeholder}</option>
      {groups.length
        ? groups.map((g) => (
            <optgroup key={g} label={g}>
              {opts.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          ))
        : opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      {groups.length > 0 && opts.filter((o) => !o.group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TextField({ f }: { f: FieldDef }) {
  const { doc, update, cataleg } = useIte();
  const value = fieldValue(doc, f);
  const multiline = f.kind === "textarea";
  const d = useDraft(value, (v) => update((x) => withField(x, f, v, cataleg)), multiline ? 1200 : 0);
  if (multiline) {
    const rows = Math.min(18, Math.max(4, Math.ceil(d.value.length / 110) + (d.value.match(/\n/g)?.length ?? 0)));
    return <textarea className="input" rows={rows} value={d.value} onFocus={d.onFocus} onChange={(e) => d.onChange(e.target.value)} onBlur={d.onBlur} />;
  }
  const numeric = f.kind === "int" || f.kind === "double";
  return (
    <div className="flex items-center gap-2">
      <input
        className={`input ${numeric ? "text-right tabular-nums" : ""}`}
        inputMode={f.kind === "int" ? "numeric" : f.kind === "double" ? "decimal" : undefined}
        maxLength={f.max}
        value={d.value}
        onFocus={d.onFocus}
        onChange={(e) => d.onChange(e.target.value)}
        onBlur={d.onBlur}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {f.unit && <span className="shrink-0 text-sm text-[var(--color-muted)]">{f.unit}</span>}
    </div>
  );
}

export function FieldInput({ f }: { f: FieldDef }) {
  const { doc, update, cataleg } = useIte();
  const value = fieldValue(doc, f);
  const set = (v: string) => update((x) => withField(x, f, v, cataleg));

  switch (f.kind) {
    case "bool":
      return (
        <label className="flex items-start gap-2 text-sm leading-snug">
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]" checked={value === "true"} onChange={(e) => set(e.target.checked ? "true" : "false")} />
          <span>{f.label}</span>
        </label>
      );
    case "tri":
      return (
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-sm">
          {TRI_OPTIONS.map((o) => (
            <button key={o.value} type="button" onClick={() => set(value === o.value ? "" : o.value)}
              className={`px-3 py-1.5 ${value === o.value ? "bg-[var(--color-accent)] text-white" : "bg-white text-[var(--color-muted)] hover:text-[var(--color-ink)]"}`}>
              {o.label}
            </button>
          ))}
        </div>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {f.options?.map((o) => (
            <label key={o.value} className="flex items-start gap-2 leading-snug">
              <input type="radio" className="mt-0.5 accent-[var(--color-accent)]" checked={value === o.value} onChange={() => set(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
          {value && <button type="button" className="text-xs text-[var(--color-muted)] hover:underline" onClick={() => update((x) => withField(x, { ...f, kind: "text" }, "", cataleg))}>treure</button>}
        </div>
      );
    case "date":
      return <input type="date" className="input" value={value} onChange={(e) => set(e.target.value)} />;
    case "cat":
      return <CatSelect cat={f.cat ?? ""} value={getAt(doc, f.path) as IteObj | string | undefined} onChange={set} />;
    default:
      return <TextField f={f} />;
  }
}

export function GroupView({ g }: { g: GroupDef }) {
  if (g.layout === "checks") {
    return (
      <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
        <legend className="px-1 text-sm font-semibold">{g.title}</legend>
        {g.note && <p className="mb-2 text-xs text-[var(--color-muted)]">{g.note}</p>}
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {g.fields.map((f) => <FieldInput key={f.path} f={f} />)}
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset className="rounded-lg border border-[var(--color-line)] p-4">
      <legend className="px-1 text-sm font-semibold">{g.title}</legend>
      {g.note && <p className="mb-3 text-xs text-[var(--color-muted)]">{g.note}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {g.fields.map((f) =>
          f.kind === "bool" ? (
            <div key={f.path} className={f.wide ? "sm:col-span-2" : ""}><FieldInput f={f} /></div>
          ) : (
            <div key={f.path} className={f.wide || f.kind === "textarea" ? "sm:col-span-2" : ""}>
              <label className="label">{f.label}{f.required && <span className="text-red-700"> *</span>}</label>
              <FieldInput f={f} />
              {f.help && <p className="mt-1 text-xs text-[var(--color-muted)]">{f.help}</p>}
            </div>
          ),
        )}
      </div>
    </fieldset>
  );
}

export function Pendents({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-xs text-[var(--color-muted)]">
      <p className="font-medium">Encara no es pot omplir aquí (falta veure com ho desa el portal en un informe que ho tingui):</p>
      <ul className="mt-1 list-disc pl-5">{items.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="mt-1">Es pot completar al portal després d&apos;importar.</p>
    </div>
  );
}
