// Proposta d'Honoraris — fixed text (CA / ES) + HTML document builder used for
// the on-screen preview, the print/PDF output and the Word (.doc) export.

export type Lang = "ca" | "es";

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
  ca: ["Visat i despeses col·legials. No són obligatoris."],
  es: ["Visado y gastos colegiales. No son obligatorios."],
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
    num: "Número",
    data: "Data",
    descripcio: "Descripció",
    adreca: "Adreça",
    ciutat: "Ciutat",
    dadesProfessionals: "Dades Professionals",
    societat: "Societat",
    cif: "CIF",
    serveiTitle: "SERVEI PRESSUPOSTAT PROPOSAT (euros)",
    concepte: "Concepte",
    import: "Import",
    subtotal: "Subtotal",
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
    num: "Número",
    data: "Fecha",
    descripcio: "Descripción",
    adreca: "Dirección",
    ciutat: "Ciudad",
    dadesProfessionals: "Datos Profesionales",
    societat: "Sociedad",
    cif: "CIF",
    serveiTitle: "SERVICIO PRESUPUESTADO PROPUESTO (euros)",
    concepte: "Concepto",
    import: "Importe",
    subtotal: "Subtotal",
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
  serveis: { descripcio: string | null; preu: number }[];
  inclusions: string[];
  exclusions: string[];
  pagaments: { descripcio: string | null; import: number | null }[];
}

// Returns the document body HTML (inline styles for Word/PDF portability).
export function buildPropostaHtml(doc: DocData, lang: Lang): string {
  const t = TXT[lang];
  const subtotal = doc.serveis.reduce((s, x) => s + (x.preu || 0), 0);
  const iva = subtotal * 0.21;
  const totalIva = subtotal + iva;

  const muted = "color:#555;";
  const h2 = "font-size:13px;font-weight:bold;margin:18px 0 6px;letter-spacing:.02em;";
  const p = "margin:0 0 8px;line-height:1.45;text-align:justify;";

  const inclusions = [...doc.inclusions.filter((x) => x.trim()), ...FIXED_INCLUSIONS[lang]];
  const exclusions = [...doc.exclusions.filter((x) => x.trim()), ...FIXED_EXCLUSIONS[lang]];

  const serveiRows = doc.serveis
    .map(
      (s) => `<tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${esc(s.descripcio)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;white-space:nowrap;">${eur(s.preu || 0, lang)}</td>
      </tr>`,
    )
    .join("");

  const pagamentRows = doc.pagaments
    .map(
      (pg) => `<tr>
        <td style="padding:5px 8px;border:1px solid #ddd;">${esc(pg.descripcio)}</td>
        <td style="padding:5px 8px;border:1px solid #ddd;text-align:right;white-space:nowrap;">${pg.import != null ? eur(pg.import, lang) : ""}</td>
      </tr>`,
    )
    .join("");

  const signature = `
    <div style="margin-top:26px;line-height:1.5;">
      <div>${t.barcelonaData(doc.data)}</div>
      <div style="height:36px;"></div>
      <div><strong>${PROFESSIONAL.signatari}</strong>, ${t.rolSignatari}</div>
      <div>${t.adminSignatari}</div>
    </div>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:11.5px;color:#111;max-width:820px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f4d3f;padding-bottom:10px;">
      <div>
        <div style="font-size:18px;font-weight:bold;color:#1f4d3f;">${t.docTitle}</div>
        <div style="${muted}">${esc(doc.num)} · ${formatLongDate(doc.data, lang)}</div>
      </div>
      <div style="text-align:right;font-size:10.5px;${muted}">
        <div><strong>${PROFESSIONAL.societat}</strong></div>
        <div>${t.cif}: ${PROFESSIONAL.cif}</div>
        <div>${PROFESSIONAL.adreca}</div>
        <div>${PROFESSIONAL.ciutat}</div>
      </div>
    </div>

    <h2 style="${h2}">${t.dadesProposta}</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="width:130px;${muted}padding:2px 0;">${t.descripcio}</td><td style="padding:2px 0;">${esc(doc.descripcio)}</td></tr>
      <tr><td style="${muted}padding:2px 0;">${t.adreca}</td><td style="padding:2px 0;">${esc(doc.adreca)}</td></tr>
      <tr><td style="${muted}padding:2px 0;">${t.ciutat}</td><td style="padding:2px 0;">${esc(doc.ciutat)}</td></tr>
    </table>

    <h2 style="${h2}">${t.serveiTitle}</h2>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f2f4f2;">
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">${t.concepte}</th>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;width:140px;">${t.import}</th>
        </tr>
      </thead>
      <tbody>${serveiRows}</tbody>
      <tfoot>
        <tr><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${t.subtotal}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${eur(subtotal, lang)}</td></tr>
        <tr><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${t.iva}</td><td style="padding:5px 8px;border:1px solid #ddd;text-align:right;">${eur(iva, lang)}</td></tr>
        <tr style="font-weight:bold;background:#f2f4f2;"><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${t.totalIva}</td><td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${eur(totalIva, lang)}</td></tr>
      </tfoot>
    </table>

    ${signature}

    <h2 style="${h2}margin-top:28px;border-top:1px solid #ddd;padding-top:14px;">${t.contingutTitle}</h2>

    <h2 style="${h2}">${t.especificacionsTitle}</h2>
    <p style="${p}">${esc(t.inclouIntro)}</p>
    <ul style="margin:0 0 8px;padding-left:20px;line-height:1.5;">
      ${inclusions.map((x) => `<li>${esc(x)}</li>`).join("")}
    </ul>

    <h2 style="${h2}">${t.exclusionsTitle}</h2>
    <p style="${p}">${esc(t.exclouIntro)}</p>
    <ul style="margin:0 0 8px;padding-left:20px;line-height:1.5;">
      ${exclusions.map((x) => `<li>${esc(x)}</li>`).join("")}
    </ul>

    <h2 style="${h2}">${t.condicionsTitle}</h2>
    <div style="font-weight:bold;margin:8px 0 4px;">${t.ofertaTitle}</div>
    ${t.ofertaText.map((x) => `<p style="${p}">${esc(x)}</p>`).join("")}
    <div style="font-weight:bold;margin:8px 0 4px;">${t.terminisTitle}</div>
    <p style="${p}">${esc(t.terminisText)}</p>
    <div style="font-weight:bold;margin:8px 0 4px;">${t.pagamentTitle}</div>
    <p style="${p}">${esc(t.pagamentText)}</p>
    ${
      pagamentRows
        ? `<table style="width:100%;border-collapse:collapse;margin:6px 0;">
            <tbody>${pagamentRows}</tbody>
          </table>`
        : ""
    }

    <div style="font-weight:bold;margin:14px 0 4px;">${t.acceptacioTitle}</div>
    <div style="font-size:15px;font-weight:bold;color:#1f4d3f;margin-bottom:8px;">${eur(subtotal, lang)} ${t.mesIva}</div>
    ${t.acceptacioText.map((x) => `<p style="${p}">${esc(x)}</p>`).join("")}

    <p style="font-size:9px;${muted}border-top:1px solid #ddd;margin-top:18px;padding-top:6px;">${esc(t.footer)}</p>
    ${t.tancament.map((x) => `<p style="${p}">${esc(x)}</p>`).join("")}

    ${signature}
  </div>`;
}

export function buildWordDoc(doc: DocData, lang: Lang): string {
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(doc.num)}</title></head><body>${buildPropostaHtml(doc, lang)}</body></html>`;
}
