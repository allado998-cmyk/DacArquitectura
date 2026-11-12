// The ITE report as a document (PDF / Imprimir), in the order and with the
// numbers of the official model: 1–4 identification, 5 building data,
// 6 description, 7 construction systems, 8 deficiencies, 9 accessibility,
// 10 sustainability, 11 state of conservation; then the technician's
// signature and the recommendations PDF as an annex.
//
// Pure, so it can be tested: the browser part (photos, printing) is
// openItePdf in portal-client.ts. A working document: the official one is the
// portal's, once the report is closed there.
import { catLabel, categoriaDeTipus, visibles, type Cataleg } from "./cataleg";
import { codiDeficiencia, codiEnvolupant } from "./fotos";
import { fieldText, fieldValue, getAt, inspeccionsOf, LIST_PATHS, listOf, resumDeficiencies, valoracioFavorable } from "./model";
import { SECTIONS, type FieldDef, type GroupDef } from "./schema";
import { isObj, type IteObj, type IteVal } from "./xml";

export interface InformeOpts {
  logoUrl?: string;
  // A stored file (/fitxers/…) → the URL the print window loads; "" leaves it out.
  src?: (path: string) => string;
  annex?: string[]; // recommendations PDF, one image per page
  data?: Date; // date by the signature
}

const FONT = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";
const MESOS = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol", "agost", "setembre", "octubre", "novembre", "desembre"];
const GREY = "#7a7a72";
const BD = "1px solid #c9c9c9";

const str = (v: IteVal | undefined): string => (typeof v === "string" ? v : "");

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const multiline = (s: string) => escHtml(s).replace(/\r?\n/g, "<br>");

function dataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function dataLlarga(d: Date): string {
  return `${d.getDate()} de ${MESOS[d.getMonth()]} de ${d.getFullYear()}`;
}

// "225.0" → "225", "18.5" → "18,5"; years stay "1910".
function numero(text: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(text)) return text;
  return Number(text).toLocaleString("ca-ES", { maximumFractionDigits: 2, useGrouping: false });
}

export function buildInformeHtml(doc: IteObj, cataleg: Cataleg, opts: InformeOpts = {}): string {
  const src = opts.src ?? ((p: string) => (p.startsWith("/fitxers/") || p.startsWith("data:") ? p : ""));
  const seccio = (key: string) => SECTIONS.find((s) => s.key === key)?.groups ?? [];
  const grup = (key: string, title: string) => seccio(key).find((g) => g.title === title);

  const bar = (title: string) =>
    `<table style="width:100%;border-collapse:collapse;margin:18px 0 0;page-break-after:avoid;"><tr>
      <td bgcolor="#e6e6e6" style="padding:4px 8px;font-size:10px;letter-spacing:.05em;color:#555;text-transform:uppercase;border-bottom:1px solid #bdbdbd;background:#e6e6e6;">${escHtml(title)}</td>
    </tr></table>`;
  const sub = (title: string) => `<div style="font-weight:bold;font-size:11px;margin:10px 0 3px;page-break-after:avoid;">${escHtml(title)}</div>`;
  const para = (html: string) => `<p style="font-size:11px;margin:6px 0;">${html}</p>`;
  // [label, value as HTML]
  const taula = (rows: [string, string][]) =>
    rows.length
      ? `<table style="width:100%;border-collapse:collapse;table-layout:fixed;">${rows
          .map(([k, v]) => `<tr style="page-break-inside:avoid;">
            <td style="border:${BD};padding:3px 7px;width:36%;vertical-align:top;color:${GREY};font-size:10px;">${escHtml(k)}</td>
            <td style="border:${BD};padding:3px 7px;vertical-align:top;font-size:11px;">${v}</td></tr>`)
          .join("")}</table>`
      : "";

  const valor = (f: FieldDef): string => {
    const t = fieldText(doc, f, cataleg);
    if (!t) return "";
    if (f.kind === "date") return escHtml(dataCurta(t));
    if (f.kind === "int" || f.kind === "double") return escHtml(numero(t) + (f.unit ? ` ${f.unit}` : ""));
    if (f.kind === "textarea") return multiline(t);
    return escHtml(t);
  };
  // The filled fields of a group: checkboxes as one line, the rest one per row.
  // `nom`: a person's name and surnames in one row, where the name would go.
  const files = (g: GroupDef | undefined, skip: ReadonlySet<string> = new Set(), nom?: { at: string; value: string }): [string, string][] => {
    if (!g) return [];
    if (g.layout === "checks") {
      const on = g.fields.filter((f) => !skip.has(f.path) && fieldValue(doc, f) === "true").map((f) => f.label);
      return on.length ? [[g.title, escHtml(on.join(" · "))]] : [];
    }
    const out: [string, string][] = [];
    for (const f of g.fields) {
      if (nom && f.path === nom.at && nom.value) out.push(["Nom i cognoms", escHtml(nom.value)]);
      if (skip.has(f.path)) continue;
      const v = valor(f);
      if (!v || (f.kind === "bool" && v === "No" && f.portal !== "gate")) continue;
      out.push([f.label, v]);
    }
    return out;
  };

  // Photos two by two, with their name in the photo package (D03-2…) and caption.
  const fotos = (list: IteObj[], codi = ""): string => {
    const items = list
      .map((m, i) => ({ url: src(str(m.path)), peu: [codi ? `${codi}-${i + 1}` : "", str(m.descripcio)].filter(Boolean).join(" · ") }))
      .filter((x) => x.url);
    if (!items.length) return "";
    const cell = (x?: { url: string; peu: string }) =>
      x
        ? `<td style="width:50%;padding:4px;vertical-align:top;text-align:center;">
            <img src="${escHtml(x.url)}" alt="" style="width:100%;height:6.2cm;object-fit:contain;background:#f4f4f2;" />
            <div style="font-size:9px;color:${GREY};margin-top:2px;">${escHtml(x.peu)}</div></td>`
        : `<td style="width:50%;"></td>`;
    let html = `<table style="width:100%;border-collapse:collapse;margin-top:4px;">`;
    for (let i = 0; i < items.length; i += 2) html += `<tr style="page-break-inside:avoid;">${cell(items[i])}${cell(items[i + 1])}</tr>`;
    return `${html}</table>`;
  };
  const una = (path: string, peu: string) => {
    const m = getAt(doc, path);
    return isObj(m) ? fotos([{ ...m, descripcio: str(m.descripcio) || peu }]) : "";
  };

  const tecnic = listOf(doc, "tecnics")[0] ?? {};
  const nomTecnic = [tecnic.nomTecnic, tecnic.cognom1Tecnic, tecnic.cognom2Tecnic].map(str).filter(Boolean).join(" ");
  const nom = str(doc.nom) || "Inspecció Tècnica de l'Edifici";
  const logo = opts.logoUrl ?? "/logo.jpg";

  const out: string[] = [];
  out.push(`<table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:bottom;">
        <div style="font-weight:bold;font-size:15px;">INFORME D'INSPECCIÓ TÈCNICA DE L'EDIFICI</div>
        <div style="font-size:12px;margin-top:3px;">${escHtml(nom)}</div>
      </td>
      <td style="text-align:right;vertical-align:top;width:160px;"><img src="${escHtml(logo)}" alt="DAC arquitectura" width="150" style="width:150px;height:auto;" /></td>
    </tr></table>
    <div style="font-size:9px;color:${GREY};margin-top:6px;">Document de treball fet amb les dades de l'informe. L'informe oficial és el que emet el Portal generador d'informes ITE de l'Agència de l'Habitatge de Catalunya en tancar-lo.</div>`);

  // 1–4 Identification
  out.push(bar("1. Identificació de l'informe"), taula(files(grup("dades", "1. Identificació de l'informe"), new Set(["llocFirma"]))));
  const RC = "edifici.referenciaCadastral";
  const refCad = [str(getAt(doc, "edifici.cadasFinca")), str(getAt(doc, "edifici.cadasPlanol"))].join("");
  const via = [
    fieldText(doc, { path: `${RC}.tipusVia`, label: "", kind: "cat", cat: "tipus_via" }, cataleg),
    str(getAt(doc, `${RC}.nomVia`)),
  ].filter(Boolean).join(" ");
  const adreca = [[via, str(getAt(doc, `${RC}.numero`))].filter(Boolean).join(", "), str(getAt(doc, `${RC}.escalera`)) && `escala ${str(getAt(doc, `${RC}.escalera`))}`, str(getAt(doc, `${RC}.bloc`)) && `bloc ${str(getAt(doc, `${RC}.bloc`))}`]
    .filter(Boolean)
    .join(", ");
  out.push(
    bar("2. Identificació de l'edifici"),
    taula([
      ...(refCad ? ([["Referència cadastral", escHtml(refCad)]] as [string, string][]) : []),
      ...(adreca ? ([["Adreça", escHtml(adreca)]] as [string, string][]) : []),
      ...files(grup("dades", "2. Identificació de l'edifici"), new Set([
        "edifici.cadasFinca", "edifici.cadasPlanol", `${RC}.tipusVia`, `${RC}.nomVia`, `${RC}.numero`, `${RC}.escalera`, `${RC}.bloc`,
        `${RC}.codiIne`, `${RC}.adrecaCorrecta`, `${RC}.adrecaIncorrecta`,
      ])),
    ]),
  );
  // A person's three name boxes, as one row.
  const persona = (base: string, suffix: string) => {
    const paths = ["nom", "cognom1", "cognom2"].map((k) => `${base}.${k}${suffix}`);
    return { skip: paths, nom: { at: paths[0], value: paths.map((p) => str(getAt(doc, p))).filter(Boolean).join(" ") } };
  };
  const prop = persona("propietat", "Propietat");
  out.push(bar("3. Identificació de la propietat"), taula(files(grup("dades", "3. Identificació propietat"), new Set(prop.skip), prop.nom)));
  if (fieldValue(doc, { path: "mostraRepresentant", label: "", kind: "bool" }) === "true") {
    const rep = persona("propietat", "Representant");
    out.push(sub("Representant"), taula(files(grup("dades", "3. Identificació propietat — Dades del representant"), new Set(["mostraRepresentant", ...rep.skip]), rep.nom)));
  }
  const tec = persona("tecnics.0", "Tecnic");
  out.push(bar("4. Identificació del tècnic redactor"), taula(files(grup("dades", "4. Identificació del tècnic redactor"), new Set(tec.skip), tec.nom)));

  // 5 Building data
  out.push(bar("5. Dades generals de l'edifici"), taula([...files(grup("descripcio", "5. Dades generals de l'edifici")), ...files(grup("descripcio", "Tipologia edificatòria"))]));
  const plantes = listOf(doc, LIST_PATHS.plantes);
  if (plantes.length) {
    const th = (t: string, w = "") => `<td style="border:${BD};padding:3px 6px;font-size:9px;color:${GREY};${w}">${escHtml(t)}</td>`;
    const td = (t: string, right = false) => `<td style="border:${BD};padding:3px 6px;font-size:10px;${right ? "text-align:right;" : ""}">${escHtml(t)}</td>`;
    let hab = 0, loc = 0;
    const rows = plantes
      .map((p) => {
        const h = Number(str(p.numHabitatges)) || 0, l = Number(str(p.numLocals)) || 0;
        hab += h; loc += l;
        const visitades = inspeccionsOf(p).map((it, k) => (it.revisat === "true" ? k + 1 : 0)).filter(Boolean);
        return `<tr style="page-break-inside:avoid;">${td(str(p.plantaDescripcio))}${td(String(h), true)}${td(String(l), true)}${td(p.teParquing === "true" ? "Sí" : "")}${td(visitades.join(", "))}</tr>`;
      })
      .join("");
    out.push(
      sub("Relació de nombre d'entitats"),
      `<table style="width:100%;border-collapse:collapse;"><tr>${th("Planta")}${th("Habitatges", "width:70px;text-align:right;")}${th("Locals", "width:55px;text-align:right;")}${th("Pàrquing", "width:60px;")}${th("Entitats visitades", "width:110px;")}</tr>${rows}
        <tr>${td("Total")}${td(String(hab), true)}${td(String(loc), true)}${td("")}${td("")}</tr></table>`,
    );
  }

  // 6 Description
  out.push(bar("6. Descripció de l'edifici"), taula(files(grup("descripcio", "6. Descripció de l'edifici"))));
  const croquis = una("edifici.edificiDescripcio.croquis", "Croquis");
  if (croquis) out.push(sub("Emplaçament i croquis"), croquis);

  // 7 Construction systems (the envelope first, as in the portal's menu)
  out.push(bar("7. Sistemes constructius"));
  const envs = listOf(doc, LIST_PATHS.envolupants);
  if (envs.length) {
    out.push(sub("Sistema envolupant"));
    envs.forEach((e, i) => {
      const tipus = isObj(e.envolupantTipus) ? catLabel(e.envolupantTipus) : "";
      out.push(
        `<div style="font-size:11px;margin:8px 0 2px;page-break-after:avoid;"><strong>${escHtml(codiEnvolupant(i))}</strong>${tipus ? ` · ${escHtml(tipus)}` : ""}</div>`,
        str(e.envolupantDescripcio) ? para(multiline(str(e.envolupantDescripcio))) : "",
        fotos(listOf(e, "fotos"), codiEnvolupant(i)),
      );
    });
  }
  const sistemes = seccio("sistemes");
  for (const [titol, prefix] of [
    ["Fonamentació", "edifici.edificiFonamentacio."],
    ["Estructura", "edifici.edificiEstructura."],
    ["Tancaments i cobertes", "edifici.edificiTancaments."],
    ["Instal·lacions", "edifici.edificiInstalacions."],
  ] as const) {
    const rows = sistemes.filter((g) => g.fields[0]?.path.startsWith(prefix)).flatMap((g) => files(g));
    if (rows.length) out.push(sub(titol), taula(rows));
  }
  out.push(una("edifici.edificiInstalacions.aaFotoComptadors", "Bateria de comptadors d'aigua"), una("edifici.edificiInstalacions.ieQcpFoto", "Quadre general de comandament i protecció"));

  // 8 Deficiencies, element by element
  out.push(bar("8. Relació i qualificació de les deficiències detectades"));
  const defs = listOf(doc, LIST_PATHS.deficiencies).map((d, i) => ({ d, i, cat: isObj(d.tipusDeficiencia) ? categoriaDeTipus(cataleg, d.tipusDeficiencia) : undefined }));
  if (!defs.length) out.push(para("No s'ha detectat cap deficiència."));
  const ordre = visibles(cataleg.categoria_deficiencia).map((c) => catLabel(c));
  const elements = Array.from(new Set(defs.map((x) => (x.cat ? catLabel(x.cat) : "Altres")))).sort(
    (a, b) => (ordre.indexOf(a) < 0 ? 99 : ordre.indexOf(a)) - (ordre.indexOf(b) < 0 ? 99 : ordre.indexOf(b)),
  );
  for (const el of elements) {
    out.push(sub(el));
    for (const { d, i } of defs.filter((x) => (x.cat ? catLabel(x.cat) : "Altres") === el)) {
      const tipus = isObj(d.tipusDeficiencia) ? catLabel(d.tipusDeficiencia) : "";
      const gravetat = isObj(d.gravetat) ? catLabel(d.gravetat) : "";
      out.push(
        `<table style="width:100%;border-collapse:collapse;margin-top:6px;page-break-inside:avoid;"><tr>
          <td style="border:${BD};padding:3px 7px;font-size:11px;"><strong>${escHtml(codiDeficiencia(i))}</strong>${tipus ? ` · ${escHtml(tipus)}` : ""}</td>
          <td style="border:${BD};padding:3px 7px;font-size:11px;width:110px;text-align:center;"><strong>${escHtml(gravetat || "—")}</strong></td>
        </tr></table>`,
        taula([
          ...(str(d.deficienciaDescripcio) ? ([["Descripció i localització", multiline(str(d.deficienciaDescripcio))]] as [string, string][]) : []),
          ...(str(d.deficienciaObservacions) ? ([["Observacions", multiline(str(d.deficienciaObservacions))]] as [string, string][]) : []),
        ]),
        fotos(listOf(d, "fotos"), codiDeficiencia(i)),
      );
    }
  }

  // 9 Accessibility
  out.push(bar("9. Avaluació de les condicions bàsiques d'accessibilitat"), taula(seccio("accessibilitat").flatMap((g) => files(g))));

  // 10 Sustainability
  out.push(bar("10. Recomanacions per a la millora de la sostenibilitat i l'ecoeficiència"), taula(seccio("sostenibilitat").flatMap((g) => files(g))));
  const mesures = listOf(doc, LIST_PATHS.mesures).map((m) => str(m.descripcioMesura)).filter(Boolean);
  if (mesures.length) out.push(sub("Mesures recomanades"), `<ol style="font-size:11px;margin:4px 0;padding-left:22px;">${mesures.map((m) => `<li style="margin:2px 0;">${multiline(m)}</li>`).join("")}</ol>`);

  // 11 State of conservation
  out.push(bar("11. Resum de l'estat de conservació"));
  const gravetatDe = (valor: string) => visibles(cataleg.gravetat).find((g) => g.valor === valor);
  const resum = resumDeficiencies(doc, cataleg);
  if (resum.length) {
    out.push(
      `<table style="width:100%;border-collapse:collapse;"><tr>
        <td style="border:${BD};padding:3px 6px;font-size:9px;color:${GREY};">Element</td>
        <td style="border:${BD};padding:3px 6px;font-size:9px;color:${GREY};width:80px;text-align:right;">Deficiències</td>
        <td style="border:${BD};padding:3px 6px;font-size:9px;color:${GREY};width:110px;">Gravetat màxima</td></tr>${resum
          .map((r) => {
            const g = r.pitjor ? gravetatDe(r.pitjor) : undefined;
            return `<tr style="page-break-inside:avoid;">
              <td style="border:${BD};padding:3px 6px;font-size:10px;">${escHtml(catLabel(r.categoria))}</td>
              <td style="border:${BD};padding:3px 6px;font-size:10px;text-align:right;">${r.n || "—"}</td>
              <td style="border:${BD};padding:3px 6px;font-size:10px;">${escHtml(g ? catLabel(g) : r.n ? r.pitjor : "—")}</td></tr>`;
          })
          .join("")}</table>`,
    );
  }
  const recomanacions = str(doc.recomanacions);
  if (recomanacions) out.push(sub("Recomanacions per a un correcte manteniment i conservació"), para(multiline(recomanacions)));
  const favorable = valoracioFavorable(doc);
  out.push(
    sub("Valoració final"),
    `<div style="font-size:13px;font-weight:bold;margin:4px 0;">${favorable ? "FAVORABLE" : "DESFAVORABLE"}</div>`,
    str(doc.observacionsValoracio) ? para(multiline(str(doc.observacionsValoracio))) : "",
  );

  // Signature
  const titulacio = isObj(tecnic.titulacioTecnic) ? catLabel(tecnic.titulacioTecnic) : "";
  const colegi = isObj(tecnic.colegiProfessionalTecnic) ? catLabel(tecnic.colegiProfessionalTecnic) : "";
  const colegiat = [titulacio, colegi, str(tecnic.numColegiatTecnic) && `núm. ${str(tecnic.numColegiatTecnic)}`].filter(Boolean).join(" · ");
  out.push(
    `<table style="width:100%;border-collapse:collapse;margin-top:22px;page-break-inside:avoid;"><tr>
      <td style="width:50%;vertical-align:top;font-size:11px;">${escHtml([str(doc.llocFirma) || "Barcelona", dataLlarga(opts.data ?? new Date())].join(", "))}</td>
      <td style="width:50%;border:${BD};padding:6px 8px;vertical-align:top;font-size:11px;">
        <div>El tècnic redactor</div>
        <div style="height:80px;">&nbsp;</div>
        <div style="border-top:1px solid #999;padding-top:3px;">${escHtml(nomTecnic)}</div>
        ${colegiat ? `<div style="font-size:10px;color:${GREY};">${escHtml(colegiat)}</div>` : ""}
      </td></tr></table>`,
  );

  // Annex: the recommendations PDF, page by page
  if (opts.annex?.length) {
    out.push(
      `<div style="page-break-before:always;break-before:page;height:0;">&nbsp;</div>`,
      bar("Annex: recomanacions"),
      ...opts.annex.map((p, i) => `${i ? `<div style="page-break-before:always;break-before:page;height:0;">&nbsp;</div>` : ""}<div style="text-align:center;margin-top:6px;"><img src="${escHtml(p)}" alt="" style="max-width:100%;height:auto;border:1px solid #ddd;" /></div>`),
    );
  }

  return `<div style="font-family:${FONT};font-size:11px;color:#111;max-width:820px;margin:0 auto;">${out.filter(Boolean).join("\n")}</div>`;
}
