// Proposta d'Honoraris — fixed text (CA / ES) + HTML document builder used for
// the on-screen preview, the print/PDF output and the Word (.doc) export.

export type Lang = "ca" | "es";

// Century Gothic with graceful fallbacks — shared with the factura documents.
export const DOC_FONT = "'Century Gothic', CenturyGothic, AppleGothic, 'URW Gothic', 'Avant Garde', 'Trebuchet MS', sans-serif";

export const PROFESSIONAL = {
  societat: "DACARQUITECTURA, REHABILITACIÓ I URBANISME, S.L.P.",
  cif: "B64205545",
  adreca: "Gran Via de Carles III, 46-48, escala O, local",
  ciutat: "08028 Barcelona",
  signatari: "David Lladó i Porta",
};

export const FIXED_INCLUSIONS: Record<Lang, string[]> = {
  ca: [
    "Responsabilitat Civil del Servei, mitjançant pòlissa amb la companyia Occident.",
    "Enviament de documentació digital.",
  ],
  es: [
    "Responsabilidad Civil del Servicio, mediante póliza con la compañía Occident.",
    "Envío de documentación digital.",
  ],
};

export const FIXED_EXCLUSIONS: Record<Lang, string[]> = {
  ca: ["Visat i despeses col·legials. No són obligatoris.", "Tot allò que no estigui expressament indicat."],
  es: ["Visado y gastos colegiales. No son obligatorios.", "Todo aquello que no esté expresamente indicado."],
};

interface Txt {
  docTitle: string;
  dadesProposta: string;
  num: string;
  data: string;
  descripcio: string;
  adreca: string;
  ciutat: string;
  dadesProfessionals: string;
  societat: string;
  cif: string;
  serveiTitle: string;
  concepte: string;
  import: string;
  subtotal: string;
  iva: string;
  totalIva: string;
  rolSignatari: string;
  adminSignatari: string;
  contingutTitle: string;
  especificacionsTitle: string;
  inclouIntro: string;
  exclusionsTitle: string;
  exclouIntro: string;
  condicionsTitle: string;
  ofertaTitle: string;
  ofertaText: string[];
  terminisTitle: string;
  terminisText: string;
  pagamentTitle: string;
  pagamentText: string;
  acceptacioTitle: string;
  mesIva: string;
  acceptacioText: string[];
  footer: string;
  tancament: string[];
  barcelonaData: (d: string) => string;
}

const TXT: Record<Lang, Txt> = {
  ca: {
    docTitle: "PROPOSTA D'HONORARIS",
    dadesProposta: "Dades de la Proposta",
    num: "número",
    data: "data",
    descripcio: "descripció",
    adreca: "adreça",
    ciutat: "ciutat",
    dadesProfessionals: "Dades Professionals",
    societat: "societat",
    cif: "CIF",
    serveiTitle: "SERVEI PRESSUPOSTAT PROPOSAT (euros)",
    concepte: "Concepte",
    import: "Import",
    subtotal: "TOTAL",
    iva: "IVA (21%)",
    totalIva: "TOTAL amb IVA",
    rolSignatari: "arquitecte col·legiat COAC 22289-5",
    adminSignatari: "Administrador de DACARQUITECTURA, REHABILITACIÓ I URBANISME, S.L.P.",
    contingutTitle: "CONTINGUT DE LA PROPOSTA",
    especificacionsTitle: "ESPECIFICACIONS DEL SERVEI:",
    inclouIntro: "La present Proposta d'Honoraris INCLOU en el següent llistat de serveis a desenvolupar:",
    exclusionsTitle: "EXCLUSIONS DEL SERVEI:",
    exclouIntro: "La present Proposta d'Honoraris EXCLOU expressament el següent llistat de serveis:",
    condicionsTitle: "CONDICIONS DE L'OFERTA",
    ofertaTitle: "OFERTA",
    ofertaText: [
      "El valor de l'oferta es pot veure modificat en cas de variació de les condicions o especificacions inicials. Qualsevol modificació o alteració d'aquestes condicionen el decurs del desenvolupament del servei pactat, serà objecte de l'elaboració i acceptació d'un pressupost independent addicional.",
      "Aquesta oferta té una durada d'1 mes. Passat aquest termini es podran revisar les condicions pactes. En cas de que l'execució de les feines es realitzi un any més tard de l'acceptació d'aquesta proposta s'aplicarà un increment percentual igual al IPC anual a Catalunya.",
    ],
    terminisTitle: "TERMINIS DE LLIURAMENT",
    terminisText:
      "Es pactarà amb el client el lliurament de la diferent documentació a partir d'un calendari pactat entre ambdues parts.",
    pagamentTitle: "PROPOSTA DE FORMA DE PAGAMENT",
    pagamentText:
      "A partir de la data de lliurament de l'informe i la factura, es deixarà un termini de 5 dies com a màxim per a la revisió o possibles modificacions del mateix, però un cop complerts aquests, es procedirà al pagament per factura a DACARQUITECTURA, ja sigui MITJANÇANT TRANSFERÈNCIA BANCÀRIA o REBUT BANCARI DOMICILIAT, amb un venciment immediat:",
    acceptacioTitle: "ACCEPTACIÓ",
    mesIva: "+ IVA",
    acceptacioText: [
      "L'acceptació d'aquesta Proposta d'Honoraris implica el compromís per les dues parts i reconeix l'acceptació de totes les clàusules i/o termes per la realització total del projecte i la seva posterior liquidació. La signatura d'aquesta proposta, per ambdues parts, té caràcter contractual.",
      "S'agrairia enviessin tots els fulls degudament signats, com acceptació de l'Oferta o bé una Comanda amb caràcter oficial.",
    ],
    footer: "FE72.01-02 PROPOSTA D'HONORARIS     EDICIÓ 01     DATA EDICIÓ 01/01/2005     NORMA UNE-EN-ISO 9001:2000",
    tancament: [
      "En cas contrari, el desenvolupament i lliurament de la feina ofertada esdevindrà el reconeixement i acceptació d'aquesta Proposta d'Honoraris.",
      "Esperant que sigui del vostre agrat, rebeu una cordial salutació,",
    ],
    barcelonaData: (d) => `Barcelona, ${formatLongDate(d, "ca")}`,
  },
  es: {
    docTitle: "PROPUESTA DE HONORARIOS",
    dadesProposta: "Datos de la Propuesta",
    num: "número",
    data: "fecha",
    descripcio: "descripción",
    adreca: "dirección",
    ciutat: "ciudad",
    dadesProfessionals: "Datos Profesionales",
    societat: "sociedad",
    cif: "CIF",
    serveiTitle: "SERVICIO PRESUPUESTADO PROPUESTO (euros)",
    concepte: "Concepto",
    import: "Importe",
    subtotal: "TOTAL",
    iva: "IVA (21%)",
    totalIva: "TOTAL con IVA",
    rolSignatari: "arquitecto colegiado COAC 22289-5",
    adminSignatari: "Administrador de DACARQUITECTURA, REHABILITACIÓ I URBANISME, S.L.P.",
    contingutTitle: "CONTENIDO DE LA PROPUESTA",
    especificacionsTitle: "ESPECIFICACIONES DEL SERVICIO:",
    inclouIntro: "La presente Propuesta de Honorarios INCLUYE el siguiente listado de servicios a desarrollar:",
    exclusionsTitle: "EXCLUSIONES DEL SERVICIO:",
    exclouIntro: "La presente Propuesta de Honorarios EXCLUYE expresamente el siguiente listado de servicios:",
    condicionsTitle: "CONDICIONES DE LA OFERTA",
    ofertaTitle: "OFERTA",
    ofertaText: [
      "El valor de la oferta puede verse modificado en caso de variación de las condiciones o especificaciones iniciales. Cualquier modificación o alteración de éstas que condicione el transcurso del desarrollo del servicio pactado, será objeto de la elaboración y aceptación de un presupuesto independiente adicional.",
      "Esta oferta tiene una duración de 1 mes. Pasado este plazo se podrán revisar las condiciones pactadas. En caso de que la ejecución de los trabajos se realice un año más tarde de la aceptación de esta propuesta se aplicará un incremento porcentual igual al IPC anual en Cataluña.",
    ],
    terminisTitle: "PLAZOS DE ENTREGA",
    terminisText:
      "Se pactará con el cliente la entrega de la diferente documentación a partir de un calendario pactado entre ambas partes.",
    pagamentTitle: "PROPUESTA DE FORMA DE PAGO",
    pagamentText:
      "A partir de la fecha de entrega del informe y la factura, se dejará un plazo de 5 días como máximo para la revisión o posibles modificaciones del mismo, pero una vez cumplidos éstos, se procederá al pago por factura a DACARQUITECTURA, ya sea MEDIANTE TRANSFERENCIA BANCARIA o RECIBO BANCARIO DOMICILIADO, con un vencimiento inmediato:",
    acceptacioTitle: "ACEPTACIÓN",
    mesIva: "+ IVA",
    acceptacioText: [
      "La aceptación de esta Propuesta de Honorarios implica el compromiso por ambas partes y reconoce la aceptación de todas las cláusulas y/o términos para la realización total del proyecto y su posterior liquidación. La firma de esta propuesta, por ambas partes, tiene carácter contractual.",
      "Se agradecería enviasen todas las hojas debidamente firmadas, como aceptación de la Oferta o bien un Pedido con carácter oficial.",
    ],
    footer: "FE72.01-02 PROPUESTA DE HONORARIOS     EDICIÓN 01     FECHA EDICIÓN 01/01/2005     NORMA UNE-EN-ISO 9001:2000",
    tancament: [
      "En caso contrario, el desarrollo y entrega del trabajo ofertado supondrá el reconocimiento y aceptación de esta Propuesta de Honorarios.",
      "Esperando que sea de su agrado, reciba un cordial saludo,",
    ],
    barcelonaData: (d) => `Barcelona, ${formatLongDate(d, "es")}`,
  },
};

function formatLongDate(iso: string, lang: Lang): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "ca" ? "ca-ES" : "es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

function eur(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "ca" ? "ca-ES" : "es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function num2(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "ca" ? "ca-ES" : "es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export interface DocData {
  num: string;
  data: string;
  descripcio: string | null;
  adreca: string | null;
  ciutat: string | null;
  codiPostal: string | null;
  client: { nom: string; cif: string | null; adreca: string | null; ciutat: string | null } | null;
  serveis: { descripcio: string | null; preu: number }[];
  inclusions: string[];
  exclusions: string[];
  hiddenInclusions?: number[]; // indices of FIXED_INCLUSIONS to omit
  hiddenExclusions?: number[]; // indices of FIXED_EXCLUSIONS to omit
  pagaments: { descripcio: string | null; import: number | null }[];
}

// Returns the document body HTML (inline styles for Word/PDF portability).
export function buildPropostaHtml(doc: DocData, lang: Lang, logoUrl = "/logo.jpg"): string {
  const t = TXT[lang];
  const subtotal = doc.serveis.reduce((s, x) => s + (x.preu || 0), 0);
  const iva = subtotal * 0.21;
  const totalIva = subtotal + iva;

  const grey = "#7a7a72";
  const p = "margin:0 0 9px;line-height:1.45;text-align:justify;font-size:11px;";
  const sub = "text-decoration:underline;font-weight:normal;margin:14px 0 8px;font-size:11.5px;";

  const hiddenInc = doc.hiddenInclusions ?? [];
  const hiddenExc = doc.hiddenExclusions ?? [];
  const inclusions = [...doc.inclusions.filter((x) => x.trim()), ...FIXED_INCLUSIONS[lang].filter((_, i) => !hiddenInc.includes(i))];
  const exclusions = [...doc.exclusions.filter((x) => x.trim()), ...FIXED_EXCLUSIONS[lang].filter((_, i) => !hiddenExc.includes(i))];
  const ciutatLine = [doc.codiPostal, doc.ciutat].filter(Boolean).join(" ");

  const bar = (title: string, right?: string, breakBefore?: boolean) =>
    `<div style="${breakBefore ? "page-break-before:always;" : ""}background:#e6e6e6;border-bottom:1px solid #bdbdbd;padding:5px 9px;margin:20px 0 10px;font-size:11px;letter-spacing:.06em;color:#7a7a7a;text-transform:uppercase;display:flex;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <span>${esc(title)}</span>${right ? `<span style="font-style:italic;text-transform:none;">${esc(right)}</span>` : ""}
    </div>`;

  // One <tr> per field; rows are grouped into a single <table> per section
  // (rowsWrap) — Word paginates correctly this way, unlike many tiny tables.
  const row = (label: string, value: string) =>
    `<tr>
      <td style="width:90px;font-style:italic;color:${grey};font-size:9.5px;vertical-align:top;padding:2px 8px;white-space:nowrap;">${esc(label)}</td>
      <td style="vertical-align:top;padding:2px 8px;">${value}</td>
    </tr>`;
  const rowsWrap = (inner: string) =>
    `<table style="border-collapse:collapse;width:100%;font-size:11px;margin:0;">${inner}</table>`;

  const serveiRows = doc.serveis
    .map(
      (s, i) => `<tr>
        <td style="padding:4px 8px;border:1px solid #ccc;width:28px;text-align:center;">${String(i + 1).padStart(2, "0")}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;">${esc(s.descripcio)}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;text-align:right;white-space:nowrap;width:120px;">${num2(s.preu || 0, lang)}</td>
      </tr>`,
    )
    .join("");

  const pagamentLines = doc.pagaments
    .map(
      (pg) => `<div style="display:flex;justify-content:space-between;padding:2px 0 2px 18px;font-size:11px;">
        <span>- ${esc(pg.descripcio)}</span>
        <span style="white-space:nowrap;">${pg.import != null ? `${eur(pg.import, lang)} ${t.mesIva}` : ""}</span>
      </div>`,
    )
    .join("");

  const signature = `
    <div style="margin-top:24px;line-height:1.5;font-size:11px;page-break-inside:avoid;">
      <div style="margin-left:18px;">${t.barcelonaData(doc.data)}</div>
      <div style="height:34px;"></div>
      <div style="margin-left:18px;"><strong>${PROFESSIONAL.signatari}</strong>, <span style="font-style:italic;">${t.rolSignatari}</span></div>
      <div style="margin-left:18px;font-style:italic;">${t.adminSignatari}</div>
    </div>`;

  const clientSection = doc.client
    ? bar("DADES CLIENT") +
      rowsWrap(
        row("client", esc(doc.client.nom)) +
          row(t.cif, esc(doc.client.cif)) +
          row("adreça", esc(doc.client.adreca)) +
          row("ciutat", esc(doc.client.ciutat)),
      )
    : "";

  return `
  <div style="font-family:${DOC_FONT};font-size:11px;color:#111;max-width:820px;margin:0 auto;">
    <div style="text-align:right;margin-bottom:4px;">
      <img src="${logoUrl}" alt="DAC arquitectura" width="150" height="59" style="width:150px;height:auto;display:inline-block;" />
    </div>

    ${bar("DADES PROPOSTA")}
    ${rowsWrap(
      row(t.num, esc(doc.num)) +
        row(t.data, esc(formatLongDate(doc.data, lang))) +
        row(t.descripcio, esc(doc.descripcio)) +
        row(t.adreca, esc(doc.adreca)) +
        row(t.ciutat, esc(ciutatLine)),
    )}

    ${bar("DADES PROFESSIONALS")}
    ${rowsWrap(
      row(t.societat, PROFESSIONAL.societat) +
        row(t.cif, PROFESSIONAL.cif) +
        row("adreça", PROFESSIONAL.adreca) +
        row("ciutat", PROFESSIONAL.ciutat),
    )}

    ${clientSection}

    ${bar(t.serveiTitle, "euros")}
    <table style="width:100%;border-collapse:collapse;font-size:11px;page-break-inside:avoid;">
      <tbody>${serveiRows}</tbody>
      <tfoot>
        <tr style="font-weight:bold;"><td colspan="2" style="padding:4px 8px;border:1px solid #ccc;">${t.subtotal}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:right;">${num2(subtotal, lang)}</td></tr>
        <tr><td colspan="2" style="padding:4px 8px;border:1px solid #ccc;">${t.iva}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:right;">${num2(iva, lang)}</td></tr>
        <tr style="font-weight:bold;"><td colspan="2" style="padding:4px 8px;border:1px solid #ccc;">${t.totalIva}</td><td style="padding:4px 8px;border:1px solid #ccc;text-align:right;">${num2(totalIva, lang)}</td></tr>
      </tfoot>
    </table>

    ${signature}

    ${bar(t.contingutTitle, undefined, true)}
    <div style="${sub}">${esc(t.especificacionsTitle)}</div>
    <p style="${p}">${esc(t.inclouIntro)}</p>
    <ul style="margin:0 0 8px;padding-left:22px;line-height:1.5;font-size:11px;">${inclusions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

    <div style="${sub}">${esc(t.exclusionsTitle)}</div>
    <p style="${p}">${esc(t.exclouIntro)}</p>
    <ul style="margin:0 0 8px;padding-left:22px;line-height:1.5;font-size:11px;">${exclusions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>

    ${bar(t.condicionsTitle)}
    <div style="${sub}">${t.ofertaTitle}</div>
    ${t.ofertaText.map((x) => `<p style="${p}">${esc(x)}</p>`).join("")}
    <div style="${sub}">${t.terminisTitle}</div>
    <p style="${p}">${esc(t.terminisText)}</p>
    <div style="${sub}">${t.pagamentTitle}</div>
    <p style="${p}">${esc(t.pagamentText)}</p>
    ${pagamentLines}

    <div style="${sub}">${t.acceptacioTitle}</div>
    ${t.acceptacioText.map((x) => `<p style="${p}">${esc(x)}</p>`).join("")}
    ${t.tancament.map((x) => `<p style="${p}">${esc(x)}</p>`).join("")}

    ${signature}
  </div>`;
}

export function buildWordDoc(doc: DocData, lang: Lang, logoUrl?: string): string {
  const head = `<style>body,table,td,th,tr,div,span,p,strong,em,ul,li{font-family:${DOC_FONT};}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>`;
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(doc.num)}</title>${head}</head><body>${buildPropostaHtml(doc, lang, logoUrl)}</body></html>`;
}
