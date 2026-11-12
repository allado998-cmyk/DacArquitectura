// Every field of the ITE report the app knows, with the portal's labels, in
// the order of the portal's menu. The form renders from this list, the plugin
// validates against it and the chat that types the report into the portal's
// form reads it (`portal`, `hint`), so a field is added in one place.
//
// Fields, required ones and the yes/no questions that reveal others come from
// the portal's form (docs/ite-portal-formulari.txt). Paths are the portal's own
// element names where a real export shows them; a field seen only in the form
// has a name of ours and `noExport` (the portal does not import our files).
//
// Paths are dot paths into the report tree (see xml.ts); "tecnics.0" is the
// first technician.

export type FieldKind = "text" | "textarea" | "int" | "double" | "date" | "bool" | "tri" | "cat" | "radio";

export interface FieldDef {
  path: string;
  label: string;
  kind: FieldKind;
  cat?: string; // kind "cat": which code list (cataleg.ts)
  options?: { value: string; label: string }[]; // kind "radio": stored values
  unit?: string;
  max?: number; // text length
  required?: boolean;
  help?: string;
  wide?: boolean; // spans the whole row
  // For the chat that types the report into the portal's form: "auto" the
  // portal sets it itself, "no" the portal has no such field, "gate" a yes/no
  // that makes other fields appear, so a "No" must be said too.
  portal?: "auto" | "no" | "gate";
  hint?: string; // how to find the field at the portal when its label differs
  noExport?: boolean; // seen in the portal's form, not in any export yet: the name is ours
}

export interface GroupDef {
  title: string;
  note?: string;
  // "checks": a block of checkboxes in columns; "grid": inputs.
  layout?: "grid" | "checks";
  fields: FieldDef[];
}

export type SectionKey =
  | "dades"
  | "descripcio"
  | "envolupant"
  | "sistemes"
  | "deficiencies"
  | "accessibilitat"
  | "conservacio"
  | "sostenibilitat"
  | "exportar";

export interface SectionDef {
  key: SectionKey;
  title: string; // as in the portal's menu
  groups: GroupDef[];
  pendents?: string[];
}

// 0 / 1 / 2 in the XML (worked out from the signed PDF of a real report).
export const TRI_OPTIONS = [
  { value: "1", label: "Sí" },
  { value: "0", label: "No" },
  { value: "2", label: "Es desconeix" },
];
const SI_NO = [
  { value: "true", label: "Sí" },
  { value: "false", label: "No" },
];

const E = "edifici";
const RC = `${E}.referenciaCadastral`;
const DESC = `${E}.edificiDescripcio`;
const TIP = `${E}.edificiTipologia`;
const FON = `${E}.edificiFonamentacio`;
const EST = `${E}.edificiEstructura`;
const TAN = `${E}.edificiTancaments`;
const INS = `${E}.edificiInstalacions`;
const ACC = `${E}.edificiAccessibilitat`;
const SOS = `${E}.edificiSostenibilitat`;
const P = "propietat";
const T = "tecnics.0";

const b = (path: string, label: string): FieldDef => ({ path, label, kind: "bool" });
const nb = (path: string, label: string): FieldDef => ({ path, label, kind: "bool", noExport: true });
const gate = (path: string, label: string, hint?: string): FieldDef => ({ path, label, kind: "bool", portal: "gate", ...(hint ? { hint } : {}) });
const pct = (path: string, label: string): FieldDef => ({ path, label, kind: "double", unit: "%" });

export const SECTIONS: SectionDef[] = [
  {
    key: "dades",
    title: "Dades Generals",
    groups: [
      {
        title: "1. Identificació de l'informe",
        fields: [
          { path: "nom", label: "Nom", kind: "text", required: true, wide: true, max: 250 },
          { path: "dataInspeccio", label: "Data d'inspecció", kind: "date", required: true, hint: "al portal és a «Desc. Bàsica Edifici» (Data Inspecció, amb el calendari)" },
          { path: "llocFirma", label: "Lloc de signatura", kind: "text", max: 100, portal: "auto" },
        ],
      },
      {
        title: "2. Identificació de l'edifici",
        note: "Referència cadastral: 14 primers dígits de qualsevol entitat de l'edifici. Els 7 primers indiquen la finca i els 7 següents el full del plànol. Al portal: escriu finca i full, prem «Obtenir dades cadastre» i marca la casella que confirma l'adreça; si no coincideix, marca l'altra casella i escriu l'adreça.",
        fields: [
          { path: `${E}.cadasFinca`, label: "Finca / Parcel·la", kind: "text", max: 7, required: true },
          { path: `${E}.cadasPlanol`, label: "Full de plànol", kind: "text", max: 7, required: true },
          { path: `${RC}.tipusVia`, label: "Tipus via", kind: "cat", cat: "tipus_via", required: true, help: "Al portal ve del Cadastre." },
          { path: `${RC}.nomVia`, label: "Nom de via", kind: "text", max: 200, required: true },
          { path: `${RC}.numero`, label: "Número", kind: "text", max: 20, required: true },
          { path: `${RC}.escalera`, label: "Escala", kind: "text", max: 10 },
          { path: `${RC}.bloc`, label: "Bloc", kind: "text", max: 10, noExport: true },
          { path: `${RC}.codiPostal`, label: "Codi postal", kind: "text", max: 5, required: true },
          { path: `${RC}.provincia`, label: "Província", kind: "text", max: 100, required: true },
          { path: `${RC}.municipi`, label: "Municipi", kind: "text", max: 100, required: true },
          { path: `${RC}.codiIne`, label: "Codi INE del municipi", kind: "text", max: 5, portal: "auto" },
          { path: `${RC}.altresRefCadastrals`, label: "Altres Ref. Cadastrals i observacions", kind: "textarea", wide: true, noExport: true },
          { path: `${RC}.adrecaCorrecta`, label: "Confirmo que l'adreça recuperada coincideix amb l'adreça de l'edifici a avaluar", kind: "bool", wide: true, hint: "surt al portal després de prémer «Obtenir dades cadastre»" },
          { path: `${RC}.adrecaIncorrecta`, label: "L'adreça proposada pel cadastre no coincideix amb la de l'edifici", kind: "bool", wide: true, portal: "gate", hint: "en marcar-la, el portal demana l'adreça a mà" },
        ],
      },
      {
        title: "3. Identificació propietat",
        note: "Amb CIF, la raó social; amb NIF, NIE o passaport, nom i dos cognoms (el portal els exigeix tots tres).",
        fields: [
          { path: `${P}.regimJuridic`, label: "Règim jurídic", kind: "cat", cat: "regim_juridic", required: true },
          { path: `${P}.tipusIdentificacioPropietat`, label: "Tipus d'identificació", kind: "cat", cat: "tipus_identificacio", required: true },
          { path: `${P}.identificacioPropietat`, label: "Identificació", kind: "text", required: true, max: 20 },
          { path: `${P}.raoSocialPropietat`, label: "Raó social (CIF)", kind: "text", wide: true, max: 250 },
          { path: `${P}.nomPropietat`, label: "Nom (persona)", kind: "text", max: 100 },
          { path: `${P}.cognom1Propietat`, label: "Primer cognom", kind: "text", max: 100 },
          { path: `${P}.cognom2Propietat`, label: "Segon cognom", kind: "text", max: 100 },
          { path: `${P}.tipusViaPropietat`, label: "Tipus via", kind: "cat", cat: "tipus_via", required: true },
          { path: `${P}.nomViaPropietat`, label: "Adreça", kind: "text", max: 250, required: true },
          { path: `${P}.codiPostalPropietat`, label: "Codi postal", kind: "text", max: 5, required: true },
          { path: `${P}.municipiPropietat`, label: "Municipi", kind: "cat", cat: "municipi", required: true, hint: "al portal, primer la Província i després el Municipi" },
          { path: `${P}.telefon1Propietat`, label: "Telèfon 1", kind: "text", max: 20, required: true },
          { path: `${P}.telefon2Propietat`, label: "Telèfon 2", kind: "text", max: 20, noExport: true },
          { path: `${P}.emailPropietat`, label: "Email", kind: "text", max: 150 },
        ],
      },
      {
        title: "3. Identificació propietat — Dades del representant",
        note: "Només si la propietat té representant (per exemple, l'administrador de la finca). Al portal és la casella «Dades Representant»; en marcar-la, tots aquests camps són obligatoris menys el telèfon 2 i l'email.",
        fields: [
          { path: "mostraRepresentant", label: "La propietat té representant", kind: "bool", wide: true, portal: "gate" },
          { path: `${P}.tipusIdentificacioRepresentant`, label: "Tipus d'identificació", kind: "cat", cat: "tipus_identificacio", noExport: true },
          { path: `${P}.identificacioRepresentant`, label: "Identificació", kind: "text", max: 20, noExport: true },
          { path: `${P}.nomRepresentant`, label: "Nom", kind: "text", max: 100, noExport: true },
          { path: `${P}.cognom1Representant`, label: "Primer cognom", kind: "text", max: 100, noExport: true },
          { path: `${P}.cognom2Representant`, label: "Segon cognom", kind: "text", max: 100, noExport: true },
          { path: `${P}.tipusViaRepresentant`, label: "Tipus via", kind: "cat", cat: "tipus_via", noExport: true },
          { path: `${P}.nomViaRepresentant`, label: "Adreça", kind: "text", max: 250, noExport: true },
          { path: `${P}.codiPostalRepresentant`, label: "Codi postal", kind: "text", max: 5, noExport: true },
          { path: `${P}.municipiRepresentant`, label: "Municipi", kind: "cat", cat: "municipi", noExport: true },
          { path: `${P}.telefon1Representant`, label: "Telèfon 1", kind: "text", max: 20, noExport: true },
          { path: `${P}.telefon2Representant`, label: "Telèfon 2", kind: "text", max: 20, noExport: true },
          { path: `${P}.emailRepresentant`, label: "Email", kind: "text", max: 150, noExport: true },
        ],
      },
      {
        title: "4. Identificació del tècnic redactor",
        fields: [
          { path: `${T}.nomTecnic`, label: "Nom", kind: "text", required: true, max: 100 },
          { path: `${T}.cognom1Tecnic`, label: "Primer cognom", kind: "text", required: true, max: 100 },
          { path: `${T}.cognom2Tecnic`, label: "Segon cognom", kind: "text", max: 100 },
          { path: `${T}.tipusIdentificacioTecnic`, label: "Tipus d'identificació", kind: "cat", cat: "tipus_identificacio", required: true },
          { path: `${T}.identificacioTecnic`, label: "NIF", kind: "text", required: true, max: 20 },
          { path: `${T}.titulacioTecnic`, label: "Titulació", kind: "cat", cat: "titulacio", required: true },
          { path: `${T}.colegiProfessionalTecnic`, label: "Col·legi professional", kind: "cat", cat: "colegi", required: true },
          { path: `${T}.numColegiatTecnic`, label: "Núm. col·legiat/da", kind: "text", required: true, max: 20 },
          { path: `${T}.tipusViaTecnic`, label: "Tipus de via", kind: "cat", cat: "tipus_via" },
          { path: `${T}.nomViaTecnic`, label: "Adreça", kind: "text", max: 250 },
          { path: `${T}.codiPostalTecnic`, label: "Codi postal", kind: "text", max: 5 },
          { path: `${T}.municipiTecnic`, label: "Població", kind: "cat", cat: "municipi" },
          { path: `${T}.telefon1Tecnic`, label: "Telèfon fix", kind: "text", max: 20 },
          { path: `${T}.telefon2Tecnic`, label: "Telèfon mòbil", kind: "text", max: 20 },
          { path: `${T}.emailTecnic`, label: "Adreça electrònica", kind: "text", max: 150 },
        ],
      },
    ],
  },
  {
    key: "descripcio",
    title: "Desc. Bàsica Edifici",
    groups: [
      {
        title: "5. Dades generals de l'edifici",
        fields: [
          { path: `${DESC}.anyConstruccio`, label: "Any de construcció", kind: "int", required: true },
          { path: `${DESC}.superficieParcela`, label: "Superfície de la parcel·la", kind: "double", unit: "m²", required: true },
          { path: `${DESC}.superficieConstruida`, label: "Superfície construïda de l'edifici", kind: "double", unit: "m²", required: true },
          { path: `${DESC}.alturaSobreRasant`, label: "Altura sobre rasant", kind: "double", unit: "m", required: true },
          { path: `${DESC}.numPlantesSobreRasant`, label: "Núm. de plantes sobre rasant", kind: "int", required: true },
          { path: `${DESC}.numPlantesSotaRasant`, label: "Núm. de plantes sota rasant", kind: "int", required: true },
          { path: `${DESC}.fontInformacioSup`, label: "Font d'informació de les superfícies", kind: "cat", cat: "font_superficies", required: true },
          { path: `${DESC}.fontInformacioSupAltres`, label: "Informació (si la font és «Altres»)", kind: "text", max: 250, noExport: true },
          { path: `${DESC}.unifamiliar`, label: "L'edifici és", kind: "radio", required: true, options: [{ value: "false", label: "Plurifamiliar" }, { value: "true", label: "Unifamiliar" }] },
        ],
      },
      {
        title: "Tipologia edificatòria",
        fields: [
          { path: `${TIP}.implantacioParcela`, label: "Implantació en parcel·la de l'edifici", kind: "cat", cat: "implantacio", wide: true, required: true },
          { path: `${TIP}.nuclisComunicacioVertical`, label: "Nuclis de comunicació vertical", kind: "cat", cat: "nuclis", required: true, hint: "«Un sol nucli d'escales» fa sortir el desplegable d'ascensors; «Dos o més nuclis», els quatre números de sota" },
          { path: `${TIP}.ascensorsUnNucli`, label: "Un sol nucli d'escales", kind: "cat", cat: "ascensors", hint: "surt al portal quan a «Nuclis de comunicació vertical» es tria «Un sol nucli d'escales»" },
          { path: `${TIP}.numTotalEscales`, label: "Núm. total d'escales (dos o més nuclis)", kind: "int", noExport: true },
          { path: `${TIP}.numTotalAscensors`, label: "Núm. total d'ascensors (dos o més nuclis)", kind: "int", noExport: true },
          { path: `${TIP}.numHabitatgesAccesMesUnNucli`, label: "Núm. total d'habitatges amb accés a través de més d'un nucli", kind: "int", noExport: true },
          { path: `${TIP}.numHabitatgesSenseAscensor`, label: "Núm. total d'habitatges sense accés a través d'ascensor", kind: "int", noExport: true },
          { path: `${TIP}.numMigHabitatgesPerPlanta`, label: "Núm. mig d'habitatges per planta", kind: "int" },
        ],
      },
      {
        title: "6. Descripció de l'edifici",
        fields: [
          { path: `${DESC}.edificiDescripcio`, label: "Descripció general de l'edifici", kind: "textarea", wide: true },
          { path: `${DESC}.orientacio`, label: "Orientació de la façana principal de l'edifici", kind: "cat", cat: "orientacio", required: true, hint: "al portal és a «Envolupant de l'edifici», al segon bloc de la pàgina" },
        ],
      },
    ],
  },
  {
    key: "envolupant",
    title: "Envolupant de l'edifici",
    groups: [],
  },
  {
    key: "sistemes",
    title: "Sist. Constructius",
    groups: [
      {
        title: "Fonamentació — Sistemes de contenció",
        layout: "checks",
        fields: [
          b(`${FON}.contencioMurPedra`, "Mur de pedra"),
          b(`${FON}.contencioMurFabricaMao`, "Mur de fàbrica de maó"),
          b(`${FON}.contencioMurFabricaBloc`, "Mur de fàbrica bloc"),
          b(`${FON}.contencioMurFormigoArmat`, "Mur de formigó armat"),
          b(`${FON}.contencioMurPantalla`, "Mur pantalla"),
          b(`${FON}.contencioAltres`, "Es desconeix/Altres"),
        ],
      },
      {
        title: "Fonamentació superficial",
        layout: "checks",
        fields: [
          b(`${FON}.superficialSabatesRasesPousParedat`, "Sabates, rases i pous de paredat"),
          b(`${FON}.superficialSabataRasesFormigo`, "Sabata o rases formigó"),
          b(`${FON}.superficialLlosa`, "Llosa"),
          b(`${FON}.superficialAltres`, "Es desconeix/Altres"),
        ],
      },
      {
        title: "Fonamentació profunda",
        layout: "checks",
        fields: [
          b(`${FON}.profundaPilons`, "Pilons"),
          b(`${FON}.profundaPantalles`, "Pantalles"),
          b(`${FON}.profundaAltres`, "Es desconeix/Altres"),
        ],
      },
      { title: "Fonamentació — observacions", fields: [{ path: `${FON}.fonamentacioObservacions`, label: "Observacions", kind: "textarea", wide: true, required: true }] },
      {
        title: "Estructura vertical — Parets de càrrega",
        layout: "checks",
        fields: [
          b(`${EST}.verticalCarregaPedra`, "De pedra"),
          b(`${EST}.verticalCarregaFabricaMao`, "De fàbrica de maó"),
          b(`${EST}.verticalCarregaFormigoArmat`, "De formigó armat"),
          b(`${EST}.verticalCarregaBlocCeramic`, "De bloc ceràmic"),
          b(`${EST}.verticalCarregaTova`, "De tova"),
          b(`${EST}.verticalCarregaBlocFormigo`, "De bloc formigó"),
          b(`${EST}.verticalCarregaTapia`, "De tàpia"),
          b(`${EST}.verticalCarregaEntramatFusta`, "Amb entramat de fusta"),
        ],
      },
      {
        title: "Estructura vertical — Pilars i altres",
        layout: "checks",
        fields: [
          b(`${EST}.verticalPilarsMao`, "Pilars de maó"),
          b(`${EST}.verticalPilarsFerroColat`, "Pilars de ferro colat"),
          b(`${EST}.verticalPilarsAcer`, "Pilars d'acer"),
          b(`${EST}.verticalPilarsFormigoArmat`, "Pilars de formigó armat"),
          b(`${EST}.verticalPilarsAltres`, "Pilars: altres"),
          b(`${EST}.verticalDesconeix`, "Es desconeix"),
          b(`${EST}.verticalAltres`, "Altre"),
        ],
      },
      {
        title: "Estructura horitzontal (planta tipus) — Estructura principal (bigues)",
        layout: "checks",
        fields: [
          b(`${EST}.horizontalPrincipalFusta`, "De fusta"),
          b(`${EST}.horizontalPrincipalMetall`, "Metàl·liques"),
          b(`${EST}.horizontalPrincipalFormigoArmat`, "De formigó armat"),
        ],
      },
      {
        title: "Forjat — Elements secundaris (biguetes)",
        layout: "checks",
        fields: [
          b(`${EST}.horizontalForjatSecFusta`, "De fusta"),
          b(`${EST}.horizontalForjatSecMetall`, "Metàl·lica"),
          b(`${EST}.horizontalForjatSecFormigoArmat`, "De formigó armat"),
          b(`${EST}.horizontalForjatSecCeramicaArmada`, "De ceràmica armada"),
          b(`${EST}.horizontalForjatSecAltres`, "Altres"),
        ],
      },
      {
        title: "Forjat — Entrebigat",
        layout: "checks",
        fields: [
          b(`${EST}.horizontalForjatTaulell`, "Taulell"),
          b(`${EST}.horizontalForjatRevolto`, "Revoltó"),
          b(`${EST}.horizontalForjatRevoltoCeramic`, "Revoltó ceràmic"),
          b(`${EST}.horizontalForjatRevoltoFormigo`, "Revoltó de formigó"),
          b(`${EST}.horizontalForjatAltres`, "Altres"),
        ],
      },
      {
        title: "Estructura horitzontal — Altres tipus",
        layout: "checks",
        fields: [
          b(`${EST}.horizontalForjatReticular`, "Forjat reticular"),
          b(`${EST}.horizontalLlosaFormigo`, "Llosa formigó"),
          b(`${EST}.horizontalAltres`, "Es desconeix/Altres"),
        ],
      },
      {
        title: "Estructura horitzontal — Planta en contacte amb el terreny",
        layout: "checks",
        fields: [
          b(`${EST}.horizontalTerraForjatIdentic`, "Forjat idèntic al de P. tipus"),
          b(`${EST}.horizontalTerraForjatDiferent`, "Forjat diferent al de P. tipus"),
          b(`${EST}.horizontalTerraForjatSanitariIdentic`, "Forjat sanitari idèntic al de P. tipus"),
          b(`${EST}.horizontalTerraForjatSanitariDiferent`, "Forjat sanitari diferent al de P. tipus"),
          b(`${EST}.horizontalTerraSolera`, "Solera"),
          b(`${EST}.horizontalTerraAltres`, "Es desconeix/Altres"),
        ],
      },
      {
        title: "Estructura de coberta",
        layout: "checks",
        fields: [
          b(`${EST}.cobertaFHCapaFormacioPendent`, "Forjat horitzontal: capa formació pendent"),
          b(`${EST}.cobertaFHEnvanetsTaulell`, "Forjat horitzontal: envanets + taulell"),
          b(`${EST}.cobertaEPFormigoArmatTaulell`, "Encavallades, pòrtics: bigues formigó armat + taulell"),
          b(`${EST}.cobertaEPMetalTaulell`, "Encavallades, pòrtics: bigues metàl·liques + taulell"),
          b(`${EST}.cobertaEPFustaTaulell`, "Encavallades, pòrtics: bigues fusta + taulell"),
          b(`${EST}.cobertaTaulellCeramic`, "Taulell ceràmic"),
          b(`${EST}.cobertaTaulellFusta`, "Taulell fusta"),
          b(`${EST}.cobertaXapaSandwich`, "Xapa/Sandwich"),
          b(`${EST}.cobertaFIFormigoArmat`, "Forjat inclinat: formigó armat"),
          b(`${EST}.cobertaFIAltres`, "Forjat inclinat: altre"),
          b(`${EST}.cobertaAltres`, "Es desconeix/Altres"),
        ],
      },
      {
        title: "Estructura d'escala",
        layout: "checks",
        fields: [
          b(`${EST}.escalaEstructuraFusta`, "Fusta"),
          b(`${EST}.escalaEstructuraMetal`, "Metàl·lica"),
          b(`${EST}.escalaEstructuraVoltaCeramica`, "Volta ceràmica"),
          b(`${EST}.escalaEstructuraLlosaArmada`, "Llosa armada"),
          b(`${EST}.escalaEstructuraSense`, "Sense estructura d'escala"),
          b(`${EST}.escalaAltres`, "Es desconeix/Altres"),
        ],
      },
      { title: "Estructura — observacions", fields: [{ path: `${EST}.estructuraObservacions`, label: "Observacions", kind: "textarea", wide: true, required: true }] },
      {
        title: "Façana principal — Acabat vist",
        layout: "checks",
        fields: [
          b(`${TAN}.fpAvfpParedat`, "Paredat"),
          b(`${TAN}.fpAvfpCarreus`, "Carreus"),
          b(`${TAN}.fpAvfpFabricaMao`, "Fàbrica maó"),
          b(`${TAN}.fpAvfpFabricaBlocCeramic`, "Fàbrica bloc ceràmic"),
          b(`${TAN}.fpAvfpFabricaBlocFormigo`, "Fàbrica bloc formigó"),
          b(`${TAN}.fpAvfpPanelPrefabricatFormigo`, "Panell prefabricat formigó"),
          b(`${TAN}.fpAvfpPanelMetalicSandwich`, "Panell metàl·lic/Sandwich"),
          b(`${TAN}.fpAvfpAltres`, "Altres"),
        ],
      },
      {
        title: "Façana principal — Acabat revestit",
        layout: "checks",
        fields: [
          b(`${TAN}.fpArfpArrebossatPintat`, "Arrebossat i pintat"),
          b(`${TAN}.fpArfpEstucat`, "Estucat"),
          b(`${TAN}.fpArfpMorterMonocapa`, "Morter monocapa"),
          b(`${TAN}.fpArfpAplacatCeramic`, "Aplacat ceràmic"),
          b(`${TAN}.fpArfpAplacatPedra`, "Aplacat pedra"),
          b(`${TAN}.fpArfpXapaMetalica`, "Xapa metàl·lica"),
          b(`${TAN}.fpArfpAltres`, "Altres"),
        ],
      },
      {
        title: "Façana principal — Cambra d'aire i aïllament",
        fields: [
          { path: `${TAN}.fpAvfpCambraAire`, label: "Disposa de cambra d'aire", kind: "tri" },
          { path: `${TAN}.fpArfpAillamentTermic`, label: "Disposa d'aïllament tèrmic", kind: "tri" },
        ],
      },
      {
        title: "Altres façanes, façanes a patis i mitgeres — Acabat vist",
        layout: "checks",
        fields: [
          b(`${TAN}.afAvafParedat`, "Paredat"),
          b(`${TAN}.afAvafCarreus`, "Carreus"),
          b(`${TAN}.afAvafFabricaMao`, "Fàbrica maó"),
          b(`${TAN}.afAvafFabricaBlocCeramic`, "Fàbrica bloc ceràmic"),
          b(`${TAN}.afAvafFabricaBlocFormigo`, "Fàbrica bloc formigó"),
          b(`${TAN}.afAvafPanelPrefabricatFormigo`, "Panell prefabricat formigó"),
          b(`${TAN}.afAvafPanelMetalicSandwich`, "Panell metàl·lic/Sandwich"),
          b(`${TAN}.afAvafAltres`, "Altres"),
        ],
      },
      {
        title: "Altres façanes — Acabat revestit",
        layout: "checks",
        fields: [
          b(`${TAN}.afArafArrebossatPintat`, "Arrebossat i pintat"),
          b(`${TAN}.afArafEstucat`, "Estucat"),
          b(`${TAN}.afArafMorterMonocapa`, "Morter monocapa"),
          b(`${TAN}.afArafAplacatCeramic`, "Aplacat ceràmic"),
          b(`${TAN}.afArafAplacatPedra`, "Aplacat pedra"),
          b(`${TAN}.afArafXapaMetalica`, "Xapa metàl·lica"),
          b(`${TAN}.afArafAltres`, "Altres"),
        ],
      },
      {
        title: "Altres façanes — Cambra d'aire i aïllament",
        fields: [
          { path: `${TAN}.afAvafCambraAire`, label: "Disposa de cambra d'aire", kind: "tri" },
          { path: `${TAN}.afArafAillamentTermic`, label: "Disposa d'aïllament tèrmic", kind: "tri" },
        ],
      },
      {
        title: "Fusteria i vidre en buits d'obra — Tipus de fusteria",
        layout: "checks",
        fields: [
          b(`${TAN}.fvTfpFusta`, "Fusta"),
          b(`${TAN}.fvTfpAcer`, "Acer"),
          b(`${TAN}.fvTfpAlumini`, "Alumini"),
          b(`${TAN}.fvTfpPvc`, "PVC"),
          b(`${TAN}.fvTfpAltres`, "Altres"),
        ],
      },
      {
        title: "Fusteria i vidre — Tipus de vidre",
        layout: "checks",
        fields: [
          b(`${TAN}.fvTvpSimple`, "Simple"),
          b(`${TAN}.fvTvpDobleAat`, "Doble vidre"),
          b(`${TAN}.fvTvpTripleAat`, "Triple vidre"),
          b(`${TAN}.fvTvpAatBaixEmissiu`, "Amb capa baix emissiu"),
          b(`${TAN}.fvTvpAatControlSolar`, "Amb capa de control solar"),
          b(`${TAN}.fvTvpAltres`, "Altres"),
        ],
      },
      {
        title: "Terrat / coberta plana",
        layout: "checks",
        fields: [b(`${TAN}.tcTransitable`, "Transitable"), b(`${TAN}.tcNoTransitable`, "No transitable")],
      },
      {
        title: "Terrat / coberta plana — Aïllament i impermeabilització",
        fields: [
          { path: `${TAN}.tcAillamentTermic`, label: "Disposa d'aïllament tèrmic", kind: "tri" },
          { path: `${TAN}.tcLaminaImpermeable`, label: "Disposa de làmina impermeabilitzant", kind: "tri" },
        ],
      },
      {
        title: "Coberta inclinada",
        layout: "checks",
        fields: [
          b(`${TAN}.tcTeuTeulaArab`, "Teula àrab"),
          b(`${TAN}.tcTeuTeulaPlana`, "Teula plana o altra"),
          b(`${TAN}.tcTeuTeulaCiment`, "Teula ciment"),
          b(`${TAN}.tcTeuXapaCoure`, "Xapa coure/zinc"),
          b(`${TAN}.tcTeuFibrociment`, "Fibrociment"),
          b(`${TAN}.tcTeuAsfaltica`, "Asfàltica"),
          b(`${TAN}.tcTeuXapaAcer`, "Xapa d'acer"),
          b(`${TAN}.tcTeuPissarra`, "Pissarra"),
          b(`${TAN}.tcTeuAltres`, "Altres"),
        ],
      },
      { title: "Coberta inclinada — Aïllament", fields: [{ path: `${TAN}.tcTeuAillamentTermic`, label: "Disposa d'aïllament tèrmic", kind: "tri" }] },
      { title: "Tancaments i cobertes — observacions", fields: [{ path: `${TAN}.tancamentsObservacions`, label: "Observacions", kind: "textarea", wide: true, required: true }] },
      {
        title: "Sanejament — Sistema d'evacuació d'aigües residuals",
        layout: "checks",
        fields: [
          b(`${INS}.seaNoDisposa`, "No disposa de sistema d'evacuació d'aigües residuals"),
          b(`${INS}.seaDisposaPublic`, "Disposa de sist. evacuació a xarxa de clavegueram públic"),
          b(`${INS}.seaDisposaPropi`, "Disposa de sist. evacuació propi (fossa sèptica, etc.)"),
          b(`${INS}.seaBaixantsVistos`, "Baixants vistos"),
          b(`${INS}.seaBaixantsEncastats`, "Baixants encastats"),
          b(`${INS}.seaBaixantsAltres`, "Baixants: altres"),
          b(`${INS}.seaColectorsVistos`, "Col·lectors vistos"),
          b(`${INS}.seaColectorsSoterrats`, "Col·lectors soterrats"),
          b(`${INS}.seaColectorsAltres`, "Col·lectors: altres"),
        ],
      },
      {
        title: "Sanejament — Materials",
        layout: "checks",
        fields: [
          b(`${INS}.seaMatBaixCeramic`, "Baixants: ceràmic"),
          b(`${INS}.seaMatBaixFibrociment`, "Baixants: fibrociment"),
          b(`${INS}.seaMatBaixPvc`, "Baixants: PVC"),
          b(`${INS}.seaMatBaixAltres`, "Baixants: es desconeix/altres"),
          b(`${INS}.seaMatClaFormigo`, "Col·lectors: formigó"),
          b(`${INS}.seaMatClaFibrociment`, "Col·lectors: fibrociment"),
          b(`${INS}.seaMatClaCeramic`, "Col·lectors: ceràmic"),
          b(`${INS}.seaMatClaPvc`, "Col·lectors: PVC"),
          b(`${INS}.seaMatClaAltres`, "Col·lectors: es desconeix/altres"),
        ],
      },
      {
        title: "Subministrament d'aigua",
        layout: "checks",
        fields: [
          b(`${INS}.aaNoDisposa`, "No disposa de sistema de subministrament d'aigua"),
          gate(`${INS}.aaDisposaPublic`, "Disposa de connexió a la xarxa de subministrament d'aigua pública"),
          b(`${INS}.aaDisposaPropi`, "Disposa de captació pròpia (pou, bomba, etc.)"),
          b(`${INS}.aaComptadorUnic`, "Comptador únic per a tot l'edifici"),
          b(`${INS}.aaComptadorIndividualHab`, "Comptadors individuals per habitatge/local"),
          b(`${INS}.aaComptadorIndividualCentral`, "Comptadors individuals centralitzats"),
        ],
      },
      {
        title: "Subministrament d'aigua — Connexió i muntants",
        fields: [
          { path: `${INS}.aaSubministramentPublic`, label: "Connexió a la xarxa", kind: "radio", options: [{ value: "1", label: "Directe" }, { value: "2", label: "Per aforament" }], hint: "surt al portal en marcar «Disposa de connexió a la Xarxa de subministrament d'Aigua pública»" },
        ],
      },
      {
        title: "Material dels muntants d'aigua",
        layout: "checks",
        fields: [
          b(`${INS}.aaMatMunPlom`, "Plom"),
          b(`${INS}.aaMatMunFerro`, "Ferro"),
          b(`${INS}.aaMatMunCoure`, "Coure"),
          b(`${INS}.aaMatMunPlastic`, "Plàstic"),
          b(`${INS}.aaMatMunAltres`, "Altres"),
        ],
      },
      {
        title: "Instal·lació elèctrica (elements comuns)",
        layout: "checks",
        fields: [
          b(`${INS}.ieCgp`, "Caixa general de protecció (CGP)"),
          b(`${INS}.ieFusible`, "Fusible a l'inici de les derivacions individuals"),
          gate(`${INS}.ieQcp`, "Quadre comandament i protecció (QCP)"),
          b(`${INS}.ieIcp`, "Interruptor control de potència (ICP)"),
          b(`${INS}.ieId`, "Interruptor diferencial (ID)"),
          b(`${INS}.iePia`, "Interruptor automàtic a l'inici dels circuits de serveis comuns (PIA)"),
          b(`${INS}.ieAltres`, "Altres (sota el QCP)"),
          b(`${INS}.ieComptadorUnic`, "Comptador únic per a tot l'edifici"),
          b(`${INS}.ieComptadorIndividualHab`, "Comptadors individuals per habitatge/local"),
          b(`${INS}.ieComptadorIndividualCentral`, "Comptadors individuals centralitzats"),
        ],
      },
      {
        title: "Calefacció",
        layout: "checks",
        fields: [
          { ...b(`${INS}.caDisposa`, "Es disposa de sistema de calefacció"), portal: "gate" },
          { ...b(`${INS}.caDisposaSistCentral`, "Es disposa de sistema de calefacció col·lectiva/central"), portal: "gate" },
          b(`${INS}.caCanalitzatPropa`, "Caldera gas canalitzat: propà"),
          b(`${INS}.caCanalitzatGasNatural`, "Caldera gas canalitzat: gas natural"),
          b(`${INS}.caElectricaBombaCalor`, "Calefacció elèctrica: bomba de calor"),
          b(`${INS}.caElectricaRadiadors`, "Calefacció elèctrica: radiadors"),
        ],
      },
      {
        title: "Calefacció col·lectiva/central — sistema i combustible",
        note: "Només si hi ha calefacció col·lectiva/central.",
        layout: "checks",
        fields: [
          nb(`${INS}.caCentralCaldera`, "Caldera comunitària"),
          nb(`${INS}.caCentralBombaCalor`, "Bomba de calor"),
          nb(`${INS}.caCentralAltres`, "Altres"),
          nb(`${INS}.caCombGlp`, "Combustible: GLP"),
          nb(`${INS}.caCombGasoil`, "Combustible: Gasoil"),
          nb(`${INS}.caCombGasNatural`, "Combustible: Gas Natural"),
          nb(`${INS}.caCombElectricitat`, "Combustible: Electricitat"),
          nb(`${INS}.caCombBiomassa`, "Combustible: Llenya/Biomassa"),
          nb(`${INS}.caCombAltres`, "Combustible: Altres"),
        ],
      },
      {
        title: "Calefacció — percentatges",
        fields: [
          pct(`${INS}.caIndividualsPercent`, "% habitatges/locals amb sistemes individuals de calefacció"),
          pct(`${INS}.caCalderaCanalitzatPercent`, "% habitatges amb caldera (gas canalitzat)"),
          pct(`${INS}.caCalderaGasoilPercent`, "% habitatges amb caldera gasoil"),
          pct(`${INS}.caCalefaccioElectricaPercent`, "% habitatges amb calefacció elèctrica"),
          pct(`${INS}.caAltresPercent`, "% amb altres"),
        ],
      },
      {
        title: "Aigua calenta sanitària (ACS)",
        layout: "checks",
        fields: [
          { ...b(`${INS}.acsDisposa`, "L'edifici disposa de sistema d'ACS"), portal: "gate" },
          { ...b(`${INS}.acsDisposaSistCentral`, "L'edifici disposa de sistema d'ACS central"), portal: "gate" },
          b(`${INS}.acsCentralCaptadorSolar`, "L'edifici disposa de captadors solars per a la producció d'ACS"),
          b(`${INS}.acsCanalitzatPropa`, "Escalfadors gas canalitzat: propà"),
          b(`${INS}.acsCanalitzatGasNatural`, "Escalfadors gas canalitzat: gas natural"),
          b(`${INS}.acsEmbassatPropa`, "Escalfadors gas embotellat: propà"),
          b(`${INS}.acsEmbassatButa`, "Escalfadors gas embotellat: butà"),
        ],
      },
      {
        title: "ACS central — combustible",
        note: "Només si hi ha ACS central.",
        layout: "checks",
        fields: [
          nb(`${INS}.acsCombGlp`, "GLP"),
          nb(`${INS}.acsCombGasoil`, "Gasoil"),
          nb(`${INS}.acsCombGasNatural`, "Gas Natural"),
          nb(`${INS}.acsCombElectricitat`, "Electricitat"),
          nb(`${INS}.acsCombBiomassa`, "Llenya/Biomassa"),
          nb(`${INS}.acsCombAltres`, "Altres"),
        ],
      },
      {
        title: "ACS — percentatges",
        fields: [
          pct(`${INS}.acsIndividualsPercent`, "% habitatges/locals amb sistemes individuals d'ACS"),
          pct(`${INS}.acsCanalitzatPercent`, "% habitatges amb escalfadors (gas canalitzat)"),
          pct(`${INS}.acsEmbassatPercent`, "% habitatges amb escalfadors (gas embotellat)"),
          pct(`${INS}.acsEscalfadorElectricPercent`, "% habitatges amb escalfadors elèctrics"),
          pct(`${INS}.acsAltresPercent`, "% amb altres"),
        ],
      },
      {
        title: "Gas canalitzat per a instal·lacions domèstiques",
        layout: "checks",
        fields: [
          gate(`${INS}.gcDisposa`, "L'edifici disposa d'escomesa a xarxa de distribució canalitzada de gas"),
          b(`${INS}.gcPropa`, "Propà"),
          b(`${INS}.gcGasNatural`, "Gas natural"),
          b(`${INS}.gcComptadorIndividualHab`, "Comptadors individuals per habitatge/local"),
          b(`${INS}.gcComptadorIndividualCentral`, "Comptadors individuals centralitzats"),
        ],
      },
      { title: "Gas — percentatge", fields: [pct(`${INS}.gcPercent`, "% habitatges/locals amb escomesa de gas canalitzat")] },
      {
        title: "Refrigeració",
        layout: "checks",
        fields: [
          { ...b(`${INS}.reDisposa`, "L'edifici disposa de sistema de refrigeració"), portal: "gate" },
          { ...b(`${INS}.reColectiu`, "L'edifici disposa de sistema col·lectiu de refrigeració"), portal: "gate" },
          nb(`${INS}.reTorre`, "Col·lectiu: amb torre de refredament"),
          nb(`${INS}.reSenseTorre`, "Col·lectiu: sense torre de refredament"),
        ],
      },
      {
        title: "Refrigeració — dades",
        fields: [
          pct(`${INS}.reIndividualsPercent`, "% habitatges/locals amb sistemes individuals de refrigeració"),
          { path: `${INS}.reNumAparellsVistos`, label: "Núm. aparells d'aire condicionat vistos en façanes", kind: "int" },
        ],
      },
      {
        title: "Ventilació i renovació d'aire",
        layout: "checks",
        fields: [
          gate(`${INS}.vrDisposa`, "Disposa de sistema de ventilació per a les cambres humides dels habitatges"),
          b(`${INS}.vrFinestres`, "Finestres"),
          b(`${INS}.vrXemeneies`, "Pati d'instal·lacions"),
          b(`${INS}.vrShunts`, "Shunts"),
          b(`${INS}.vrAltres`, "Altres"),
          b(`${INS}.vrExisteixenLocalsCap`, "Existeixen locals o habitatges on les cambres humides no tenen cap d'aquests sistemes"),
          b(`${INS}.vrAparcamentNatural`, "Aparcaments: ventilació natural"),
          b(`${INS}.vrAparcamentMecanica`, "Aparcaments: ventilació mecànica"),
          b(`${INS}.vrAparcamentHibrida`, "Aparcaments: ventilació híbrida"),
        ],
      },
      {
        title: "Protecció contra incendis",
        layout: "checks",
        fields: [
          gate(`${INS}.pciDisposa`, "L'edifici disposa de sistema de protecció contra incendis"),
          nb(`${INS}.pciDeteccio`, "Un sistema de detecció d'incendis"),
          nb(`${INS}.pciAlarma`, "Un sistema d'alarma"),
          nb(`${INS}.pciExtintors`, "Extintors mòbils"),
          nb(`${INS}.pciHidrants`, "Hidrants exteriors"),
          nb(`${INS}.pciColumnaSeca`, "Columna seca"),
          nb(`${INS}.pciBie`, "Boca d'incendis equipada"),
        ],
      },
      {
        title: "Protecció contra el llamp",
        layout: "checks",
        fields: [
          gate(`${INS}.pclDisposa`, "L'edifici disposa de sistema de protecció contra el llamp"),
          nb(`${INS}.pclPuntes`, "Parallamps de puntes"),
          nb(`${INS}.pclFaraday`, "Parallamps Faraday"),
          nb(`${INS}.pclActius`, "Parallamps amb sistemes actius (ionitzants)"),
          nb(`${INS}.pclAltre`, "Altre tipus de parallamps"),
          nb(`${INS}.pclSobretensions`, "Un dispositiu de protecció contra sobretensions transitòries"),
          nb(`${INS}.pclXarxaTerra`, "Xarxa de terra"),
        ],
      },
      {
        title: "Instal·lacions de comunicacions (ICT)",
        layout: "checks",
        fields: [
          gate(`${INS}.ictDisposa`, "L'edifici disposa d'instal·lacions de comunicacions ICT"),
          b(`${INS}.ictAntenaTdt`, "Antena per a recepció de TDT"),
          b(`${INS}.ictAntenaTvSatelite`, "Antena per a recepció de TV satèl·lit"),
          b(`${INS}.ictParesCoure`, "Accés de parells de coure"),
          b(`${INS}.ictTelecomCable`, "Accés de telecomunicacions per cable"),
          b(`${INS}.ictFibraOptica`, "Accés de fibra òptica"),
          b(`${INS}.ictSenseFils`, "Accés sense fils"),
          b(`${INS}.ictAltres`, "Altres instal·lacions d'ICT"),
        ],
      },
      {
        title: "Instal·lació d'ascensor",
        fields: [
          { path: `${INS}.iaDisposa`, label: "L'edifici disposa d'ascensor comunitari", kind: "radio", options: SI_NO, portal: "gate", hint: "amb «Sí», el portal demana la profunditat i l'amplada de la cabina" },
          { path: `${INS}.iaProfunditat`, label: "Cabina: profunditat", kind: "double", unit: "m" },
          { path: `${INS}.iaAmplada`, label: "Cabina: amplada", kind: "double", unit: "m" },
          { path: `${INS}.iaUbicacio`, label: "Ubicació", kind: "text", wide: true, max: 500 },
        ],
      },
      { title: "Instal·lacions — observacions", fields: [{ path: `${INS}.instalacionsObservacions`, label: "Observacions", kind: "textarea", wide: true, required: true }] },
    ],
    pendents: ["La descripció que el portal demana en marcar «Altres» o «Es desconeix/Altres» (un camp de text sense nom al costat de la casella)"],
  },
  { key: "deficiencies", title: "Deficiències", groups: [] },
  {
    key: "accessibilitat",
    title: "Accessibilitat",
    groups: [
      {
        title: "9. Avaluació de les condicions bàsiques d'accessibilitat",
        fields: [
          {
            path: `${ACC}.satisfa`,
            label: "L'edifici satisfà completament les condicions bàsiques d'accessibilitat que prescriu la normativa vigent?",
            kind: "radio",
            wide: true,
            required: true,
            portal: "gate",
            hint: "amb «No», el portal demana les caselles i els textos de sota",
            options: [
              { value: "true", label: "Sí" },
              { value: "false", label: "No" },
            ],
          },
        ],
      },
      {
        title: "Si no les satisfà — 1. Deficiències segons condicions funcionals de l'edifici",
        layout: "checks",
        fields: [
          b(`${ACC}.exterior`, "Accessibilitat exterior"),
          b(`${ACC}.entrePlantes`, "Accessibilitat entre plantes de l'edifici"),
          b(`${ACC}.enPlantes`, "Accessibilitat en les plantes de l'edifici"),
          b(`${ACC}.placesAparcament`, "Accessibilitat en places d'aparcament"),
          b(`${ACC}.espaisComunitaris`, "Accessibilitat en altres espais d'ús comunitari"),
        ],
      },
      {
        title: "Si no les satisfà — descripció i ajustos",
        fields: [
          { path: `${ACC}.accessibilitatDescripcio`, label: "2. Breu descripció de la problemàtica d'accessibilitat existent", kind: "textarea", wide: true },
          { path: `${ACC}.accessibilitatAjustos`, label: "3. Ajustos raonables per assolir l'accessibilitat (descripció de mesures i costos estimats)", kind: "textarea", wide: true },
        ],
      },
    ],
  },
  {
    key: "conservacio",
    title: "Estat de Conservació",
    groups: [
      {
        title: "11.3 Recomanacions necessàries per a un correcte manteniment i conservació",
        fields: [{ path: "recomanacions", label: "Recomanacions", kind: "textarea", wide: true }],
      },
      {
        title: "11.4 Valoració",
        note: "Favorable o desfavorable surt de les deficiències (cap, o totes lleus: favorable).",
        fields: [{ path: "observacionsValoracio", label: "Observacions de la valoració", kind: "textarea", wide: true }],
      },
    ],
  },
  {
    key: "sostenibilitat",
    title: "Sostenibilitat",
    groups: [
      {
        title: "10. Recomanacions per a la millora de la sostenibilitat i l'ecoeficiència",
        fields: [
          { path: `${SOS}.existenciaCertificat`, label: "Existència del certificat d'eficiència energètica de l'edifici", kind: "bool", wide: true, portal: "gate" },
          { path: `${SOS}.idCertificat`, label: "ID del certificat (si n'hi ha)", kind: "text", max: 50, noExport: true },
          { path: `${SOS}.dataValidesaCertificat`, label: "Data de validesa del certificat", kind: "date", noExport: true },
        ],
      },
    ],
  },
  { key: "exportar", title: "Portal i PDF", groups: [] },
];

export const ALL_FIELDS: FieldDef[] = SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.fields));
export const FIELD_BY_PATH: ReadonlyMap<string, FieldDef> = new Map(ALL_FIELDS.map((f) => [f.path, f]));

export function sectionOf(path: string): SectionDef | undefined {
  return SECTIONS.find((s) => s.groups.some((g) => g.fields.some((f) => f.path === path)));
}
