# DacArquitectura

Eines internes del despatx. Single-user web app (Next.js 16 + Neon Postgres + Vercel).

## Primera configuració

### 1. Instal·lar dependències

```powershell
npm install
```

### 2. Crear projecte a Neon

1. Anar a https://console.neon.tech i crear un projecte nou (ex: `dacarquitectura`).
2. Copiar la `Connection string` (format: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).

### 3. Configurar `.env.local`

Copiar `.env.local.example` a `.env.local` i emplenar:

```
DATABASE_URL=postgresql://...        # de Neon
ADRI_PASSWORD=la-teva-contrasenya    # per al login
SESSION_PASSWORD=...                 # ≥ 32 caràcters; generar amb:
                                     #   openssl rand -base64 32
```

### 4. Aplicar migracions

```powershell
npm run db:migrate
```

Això crea les taules i fa el seed dels catàlegs (Despeses Directes + Altres Despeses).

### 5. Arrencar en local

```powershell
npm run dev
```

Obrir http://localhost:3000 → login com `adri` amb la contrasenya configurada → ets a la landing.

## Estructura

```
src/app/
  page.tsx                              ← landing (links a Honoraris i Paràmetres)
  login/                                ← formulari de login (single user "adri")
  honoraris/
    page.tsx                            ← llista de propostes
    [id]/page.tsx + honoraris-view.tsx  ← detall amb les dues taules i resum
  parameters/                           ← CRUD de Projectes, Clients, Conceptes
db/migrations/                          ← SQL numerat, idempotent
scripts/migrate.mjs                     ← aplicador de migracions
middleware.ts                           ← redirigeix a /login si no hi ha sessió
```

## Compte de demostració

Hi ha un segon usuari, `demo`, pensat per ensenyar l'aplicació a un client.
És la mateixa app i les mateixes pàgines, però **totes les consultes van a una
base de dades separada** (`DEMO_DATABASE_URL`) plena de dades fictícies, de
manera que una demo no pot veure ni tocar les dades reals. Quan la sessió és
`demo`, la barra de navegació mostra una etiqueta groga **DEMO**.

Com funciona: `lib/db.ts` mira qui hi ha a la sessió abans de cada consulta i
tria la connexió. Si `DEMO_DATABASE_URL` no està configurada, el login `demo`
falla amb un error — mai no cau cap a la base de dades real.

### Preparar-la (ja fet un cop; només cal repetir-ho si es vol refrescar)

`.env.demo.local` conté el `DATABASE_URL` de la base de dades `demo`:

```powershell
npm run db:migrate:demo   # aplica l'esquema
npm run db:seed:demo      # esborra i regenera les dades fictícies
```

El seed ancora les dates al dia que s'executa, així que tornar-lo a passar
posa la Planificació al dia. Es nega a executar-se si el nom de la base de
dades no conté "demo".

## Clients i contactes (Base de Dades)

Les pestanyes **Clients** i **Contactes** són taules amb cerca, filtre per
inicial (A–Z) i filtres, tot al navegador (filtrar no fa cap consulta a la base
de dades). En baixar, la barra de filtres i la capçalera de la taula queden fixes
a dalt (al mòbil només la capçalera, perquè la barra ocupa mitja pantalla), i el
botó «Tornar a dalt» torna a l'inici. La cerca de Clients també troba els noms dels contactes
de cada client. A Clients, el color de Contactes i Expedients oberts s'intensifica
com més n'hi ha. En clicar una fila s'obre la fitxa, que és on es pot editar o
eliminar; el comentari només surt a la fitxa. En crear un client nou, s'hi poden
afegir contactes al mateix formulari i es desen amb el client.

Un contacte pot tenir diversos telèfons i mails. `telefon` i `mail` són sempre
els **principals** (els que mostren les taules i llegeixen les actes i el
plugin); la resta van a `telefons_extra` i `mails_extra` (migració 0044).

Cada contacte té també una **professió** (`professio`, migració 0045), text
lliure amb suggeriments de les que ja hi ha, que surt com a columna i filtre a
Contactes. El filtre agrupa les que només difereixen en majúscules o accents.

Els telèfons amb un nombre de xifres incorrecte surten amb un avís ⚠
(`src/lib/telefon.ts`): sense prefix, o amb +34 / 0034, han de tenir 9 xifres; la
resta de números internacionals (+ o 00), entre 8 i 15. És un avís, no un
bloqueig: en desar es demana confirmació i el número es pot guardar igualment.
Per veure'ls tots: pestanya Contactes, filtre Telèfon → Incorrecte.

## Tarifes (Base de Dades)

Després dels catàlegs, quatre pestanyes de tarifes, cadascuna amb el seu
**Any** (editable, per saber de quin any és la tarifa) i el botó «Desar tarifa»:
**Tarifa Mínima Benzina** (preu del litre × consum / 100 + desgast per km),
**Tarifa Mínima Hora** ((sou + lloguer amb IVA) / (dies × hores)), **Tarifes
CHB, CEE i CCA** (línies individuals i compostes, amb (*) = dificultat afegida
del 15 al 25 %) i **Tarifa ITE**. Taules `tarifa_minima` i `tarifa_certificat`
(migració 0048; `ite_tarifa.any_tarifa` també); fórmules a `src/lib/tarifes.ts`,
que fa servir també l'eina `catalegs` del plugin (només lectura).

## Fitxers (adjunts d'expedients, fotos, PDF i àudios de les actes)

Tots els fitxers es guarden al magatzem privat de Vercel Blob
`dac-arquitectura-fitxers` (regió `fra1`, com la base de dades). Ruta:
`<àrea>/<carpeta>/<clau>/<nom>`, on l'àrea és `dac` (compte real) o `demo`, i la
carpeta `actes/<id>` o `expedients/<id>`. La base de dades només en guarda
l'enllaç (`/fitxers/…?mida=<bytes>`): les actes a les seves llistes
`fotografies`, `documents` i `audios`, i els adjunts d'expedient a la taula
`expedient_fitxers`.

- **Pujar:** el navegador puja el fitxer directament al magatzem
  (`/fitxers/token` només dona permís a un usuari amb sessió i per a la seva
  àrea), i després el registra. Sense el límit de 4,5 MB de Vercel; màxim 500 MB.
  L'enllaç del mòbil i el plugin envien base64, que l'acció desa al magatzem.
- **Obrir:** `/fitxers/<ruta>` comprova la sessió i l'àrea i el serveix; no toca
  la base de dades. Imatges, PDF, àudio i vídeo s'obren al navegador; la resta
  es descarrega.
- **Eliminar:** treure un fitxer, una acta o un expedient esborra també els
  fitxers del magatzem (la memòria cau de Vercel pot servir-ne una còpia fins a
  un minut).
- **Fitxers antics:** abans, les fotos de les actes es guardaven en base64 dins la
  base de dades. `scripts/migrate-acta-media-to-blob.mjs` les mou al magatzem
  (`--dry-run` per comptar, `--backup=DIR` per desar-ne una còpia, `--vacuum`
  per alliberar l'espai). La web llegeix tots dos formats.

En local cal `BLOB_READ_WRITE_TOKEN` a `.env.local` (`vercel env pull` el porta).

## Descàrregues (PDF de les llistes, tres cops per setmana)

La pàgina **Descàrregues** (al menú, entre Base de Dades i Notes) ofereix en PDF
les llistes i estadístiques de l'app, sense cap filtre a part de l'any:
expedients, actes, ITE, càlculs d'honoraris, propostes i facturació (un sol PDF
«de tots els anys», del 2000 a l'any anterior, on cada any comença en una pàgina
nova, i el de l'any en curs; els anys posteriors a l'actual no surten enlloc), les
estadístiques d'expedients, de dedicació i de facturació de l'any en curs, i els
llistats de clients i de contactes. A dalt, **Global (ZIP)** els porta tots, per
carpetes. Cada fila diu quan es va gravar. Dins de cada any, les llistes van del
número més baix al més alt.

L'**estadística de facturació** (`facturacioStats` a `src/lib/llistats/facturacio.ts`)
compta les factures emeses de l'any amb els mateixos totals que la llista (base,
IVA, suplits, total final): cobrat i pendent, per trimestre, per mes i per client,
i la llista de les pendents de cobrament.

- **Quan:** un cron de Vercel (`vercel.json`, `0 5 * * 1,3,5`: dilluns, dimecres
  i divendres a les 5 UTC, les 6 o les 7 a Barcelona) crida
  `/api/cron/descarregues` amb `Authorization: Bearer <CRON_SECRET>` (variable de
  Vercel, només a producció). Es pot llançar a mà amb el mateix capçal (`curl`),
  amb `?avis=0` perquè no torni a enviar el correu.
- **Què fa:** llegeix les dades en una sola tanda de consultes, dibuixa els PDF al
  servidor amb jsPDF (sense navegador; tot plegat, uns segons), els desa al
  magatzem privat en una carpeta nova (`<àrea>/descarregues/<carpeta>/…`, amb
  l'índex a `<àrea>/descarregues/index.json`) i esborra la generació anterior.
- **Correu:** després de cada generació, l'estudi rep el correu «Actualització
  dades DAC» amb el Global (ZIP) adjunt (si passés de 15 MB, només l'enllaç) i un
  botó per obrir Descàrregues (`src/lib/descarregues/avis.ts`). Va a les adreces
  de `DESCARREGUES_AVIS` (separades per comes) i surt pel Gmail de `SMTP_USER` /
  `SMTP_PASS` (contrasenya d'aplicació, la mateixa amb què escriu LLM Manager;
  `src/lib/correu.ts`). Sense aquestes variables no s'envia res; la demo no en
  rep mai.
- **Descarregar:** `/descarregues/<carpeta>/<fitxer>` comprova la sessió i només
  serveix fitxers de l'àrea de l'usuari. La pàgina només llegeix l'índex: obrir-la
  no toca la base de dades.
- **Canvi de format:** l'índex porta la versió del format (`VERSIO` a
  `cataleg.ts`). Si després d'un deploy la pàgina troba una generació d'una
  versió anterior, mostra el que hi ha, avisa que s'estan preparant els fitxers i
  els torna a generar en segon pla (`regenerarSiCal`, una sola vegada per àrea),
  sense esperar el cron. Només a producció: una preview o un servidor local
  comparteixen el magatzem real i no hi han d'escriure (en local,
  `DESCARREGUES_PROVES=<prefix>` fa llegir i escriure sota `<prefix>/…`).
- **Demo:** el mateix cron fa els PDF del compte `demo` a partir de la seva base de
  dades i els desa a l'àrea `demo`; la demo no veu mai els fitxers reals.
- **Què hi surt:** el mateix que el botó «PDF» de cada pàgina. Les columnes, les
  files i els totals de cada llista es defineixen un sol cop a `src/lib/llistats/`:
  el navegador els imprimeix amb `src/lib/pdf.ts` i el servidor els dibuixa amb
  `src/lib/descarregues/pdf.ts` (Helvetica: els caràcters fora del joc
  Windows-1252 es canvien pel més semblant). La llista d'ITE (per any de la
  inspecció, o de creació si encara no en té) només surt aquí.
- **Provar-ho en local** sense tocar el magatzem: `node --env-file=.env.local
  scripts/descarregues.mjs [carpeta] [--demo]` genera els PDF en una carpeta.

## Mapa d'obres (Expedients → Mapa)

Cada expedient pot tenir una **adreça** i un **enllaç de Google Maps**. En desar,
l'app en treu les coordenades (`src/lib/geo.ts`): primer de l'enllaç (també
els curts `maps.app.goo.gl`, o coordenades escrites «41.98, 2.82») i, si no
n'hi ha, buscant l'adreça + ciutat a OpenStreetMap (Nominatim, sense clau).
La pestanya **Mapa** mostra els expedients situats amb un punt de color per
categoria (mapa d'OpenStreetMap amb Leaflet) i llista els que encara no tenen
ubicació. Columnes: `adreca`, `maps_url`, `lat`, `lng` (migració 0042).

## Càlculs (justificacions de càlcul)

La pàgina **Càlculs** substitueix els fulls de càlcul de l'estudi. Cada càlcul
es desa (taula `calcul_estructural`, migracions 0043 i 0047), recalcula en viu i
s'exporta com a informe de justificació en **Word** i **PDF**, en **català o
castellà** («Castellà | Català» al costat dels botons, com a les actes): el
càlcul i l'editor són sempre en català i l'informe es tradueix sencer
(`src/lib/calculs/i18n.ts`: frases exactes i patrons per als textos fets de
peces; un test falla si algun text que pot sortir a l'informe no té versió en
castellà).

El menú agrupa els tipus a l'esquerra (desplegable al mòbil): **Estintolaments**
(paret, biga, base pilar), **Biguetes**, **Reforços**, **Estructura vertical**,
**Paviments**, **Vent**, **Inèrcies**, **Soldadures**, **Informació estructural** (Perfils i
soldadures, Límits fletxes) i **Normatives**, amb el nombre de càlculs de cada tipus.
**Tots els càlculs** els llista tots amb el tipus, per cercar sense saber-lo.
Cada tipus és un `CalcType` amb el seu grup (`src/lib/calculs/index.ts`, ordre
del menú a `CALC_GROUPS`); les famílies es registren a `biguetes.ts`,
`reforcos.ts`, `estructura-vertical.ts`, `paviments.ts`, `vent.ts` i
`inercies.ts`. Els textos en castellà dels càlculs nous van en un fitxer per
càlcul (`es-*.ts`), que `i18n.ts` incorpora.

- **Estintolament paret de càrrega**: estat de càrregues ponderat, comprovació
  del perfil (E.L.S. i E.L.U.), recolzament als extrems (A connectors, B daus,
  C brancals) i esnelles. Cada opció es pot treure del càlcul i de l'informe.
  El perfil es tria per tipus (IPE, UPN…) i després la mida; el selector marca
  els que passen totes les comprovacions del perfil amb les càrregues i la llum
  actuals (`paretPerfilsValids`), i en canviar de tipus tria el més lleuger
  que compleix.
- **Recolzament biga**: daus de formigó i connectors a partir de l'esforç tallant.
- **Base pilar estintolament**: tensió sota la base amb repartiment a 60°, a
  dos costats o a un de sol quan el pilar és a l'extrem de la paret (CTE DB
  SE-F figura 5.7).
- **Gola soldadura i compatibilitat** (abans «Compatibilitat soldadures»): a sota de
  la compatibilitat, la gola per càlcul d'una **unió encastada** o **articulada**
  (articulada: M = 0), dels fulls `Gola_IPE270_encastada/articulada.xlsx`: ales
  amb cordó perimetral (opció 1) o només exterior (opció 2), ànima amb 2 cordons.
  La gola a adoptar és la més gran entre el càlcul i la mínima compatible de les
  combinacions incloses, i no pot passar de la màxima. Inclou un dibuix de les
  dues opcions amb les xifres reals (SVG; PNG a l'informe Word).
- **Compatibilitat**: gola compatible entre ala i ànima de dos perfils
  (o una xapa) segons la taula de valors límit. Cada combinació es pot treure
  (no es comprova ni surt a l'informe).
- **Biguetes** (`bigueta-acer.ts`, `bigueta-fusta.ts`, estat de càrregues
  comú a `bigueta-carregues.ts`): **bigueta d'acer estàndard** (perfil per tipus
  amb els que compleixen marcats), **d'ala estreta** (perfils Torras o IPN, o
  dades a mà) i **de fusta i resistència al foc** (classes C14–D70 a
  `biguetes/fusta-classes.json`, fletxes per integritat, confort i aparença, i
  foc pel mètode de la secció reduïda). Els errors dels fulls originals estan
  explicats a la capçalera de cada fitxer.
- **Reforços**:
  - **Reforç de trencallums** (`reforc-trencallums.ts`): obertura en un sostre
    de biguetes. Estat de càrregues, trencallums principal perpendicular a les
    biguetes (càrrega uniforme, comprovat com una bigueta), biga de suport
    paral·lela a les biguetes (la reacció del trencallums com a càrrega puntual
    al centre; llum per defecte 2 × amplària de càrrega) i passadors a la paret
    de càrrega. Cada perfil es tria per tipus amb els que compleixen marcats.
  - **Reforç biga d'acer estàndard / d'ala estreta amb xapa de compressió**
    (`reforc-biga.ts`): bigueta existent reforçada amb una capa de formigó
    armat connectada. Perfil existent (secció *informativa*: es mostra amb
    OK!/NO! però no compta al resultat, perquè s'espera que falli), secció
    mixta acer + formigó (formigó passat a acer amb Et = E2 / E1, Steiner),
    estat de càrregues final (cada línia, per defecte, la inicial; més el pes
    de la capa), comprovació de la secció mixta, connectors («caliquenyos») per
    trams i resum. L'amplària de capa que treballa és mín(intereix, L / 4).
- **Estructura vertical** · **Baixada de càrregues i tensió a la paret**
  (`baixada-carregues.ts`): els sostres són una llista com a la paret
  d'estintolament (nom, nombre de plantes, afegir i treure), amb la línia de
  plaques fotovoltaiques (`fv`); més el pes propi de la paret. Tensió a la base
  contra fd de la fàbrica (CTE DB SE-F) i percentatge que aporten les plaques.
- **Paviments** · **Paviment de vidre trepitjable** (`paviment-vidre.ts`):
  vidre laminat recolzat als 4 costats, coeficients de Roark interpolats com
  al full, tensions (càrrega uniforme i puntual), fletxes i post-trencament
  amb la làmina superior trencada (criteris DIN 18008-5). El tipus de vidre
  omple fk i γM, i el gruix nominal el gruix de càlcul (EN 572-2).
- **Vent** · **Càrrega de vent** (`carrega-vent.ts`): qe = qb · ce · cp (CTE
  DB SE-AE 3.3 i annex D). La zona eòlica dona vb, el grau d'aspror k, L i Z, i
  el cp surt de la taula 3.5 (façanes), de l'EN 1991-1-4 taula 7.9 (murs
  aïllats) o s'escriu a mà. Sense comprovacions: el resultat és la càrrega.
- **Inèrcies** (`inercies.ts`, dibuix a `inercies-figura.ts`): suma d'inèrcies
  (Steiner) **entre perfils**, **entre pletines** i **entre perfils i pletina**,
  comparada amb el perfil necessari.

L'encapçalament (referència, projecte, adreça, ciutat i client) s'omple des de
l'expedient: els càlculs van per expedient, sense triar client a part. La fitxa
de cada expedient (clicar-ne la fila) llista els seus càlculs vinculats, amb un
enllaç per obrir-los. Els informes no porten annex.

Imatges d'ajuda (`src/lib/calculs/ajuda.ts`, fitxers a `public/calculs/ajuda/`):
extractes del CTE que s'obren amb un botó al costat de la fila, sense sortir a
l'informe. A «Paret de càrrega de suport» (els tres càlculs de paret): annex C
de l'SE-F per a K, taula 4.4 per a fb i fm, taula 4.8 per a γM. A la base del
pilar, la figura 5.7. A cada sostre de l'estat de càrregues, la taula 3.1 de
l'SE-AE (sobrecàrregues d'ús) i les seves notes. A l'estat de càrregues, les
columnes Càrrega i Coef. mostren els valors amb dos decimals. Dels fulls de
novembre de 2026: el pes específic de les fàbriques (SE-AE taula C.1) a la
baixada de càrregues, l'annex D de l'SE-AE (mapa del vent) a la càrrega de
vent, i els esquemes de biga amb càrrega uniforme i puntual al trencallums.

La pestanya **Perfils i soldadures** (i el botó «Taules de perfils» de cada
càlcul) mostra les taules del catàleg: IPE, IPN, HEB, HEA, HEM, UPN, T, L, LD,
tubs, rodons, ZF, soldadures i acers. Estan transcrites a
`src/lib/calculs/perfils/*.json` a partir de les fotos del catàleg
(`public/calculs/perfils/`, una per taula; les d'HEB, HEA i HEM comparteixen
full). La cerca troba el perfil a qualsevol taula: si no és a l'oberta, salta a
la que el té.

**Normatives** mostra, per l'ordre que va demanar l'estudi, les normes que s'hi
consulten: 1962-MV-101-62, 1988-NBE-AE-88, 2006-CTE DB SE-AE, el RESUM HISTÒRIC
ESTRUCTURAL (si és vigent o derogada surt del mateix resum) i 2006-CTE DB-SI. Cada
una és el seu PDF, a `normatives/` (fora de `public/`: el resum és material de
curs), servit només amb sessió per `/calculs/normatives/<fitxer>` i inclòs a la
funció per `outputFileTracingIncludes` (`next.config.ts`). Per afegir-ne una:
el PDF a `normatives/` i una entrada a `src/lib/calculs/normatives.ts`.

Diferències amb els fulls de càlcul, a propòsit (detall a `src/lib/calculs/paret.ts`):
cada comprovació es fa contra el valor que s'hi mostra (alguns OK!/NO! de l'Excel
miraven una altra cel·la), la reacció als extrems és Q·L/2 (l'Excel la rebaixava
un ~2 %) i el pes propi del perfil surt del catàleg si no s'escriu.

Tests sense base de dades (comparen amb els valors dels fulls de càlcul):
`npm run test:calculs` (`test-calculs`, `-biguetes`, `-trencallums`,
`-reforc-biga`, `-baixada`, `-vidre`, `-vent` i `-inercies`). Les diferències
a propòsit amb cada full nou estan a la capçalera del seu fitxer.

## ITE (informes per al portal de l'Agència de l'Habitatge)

La pestanya **ITE** prepara l'informe d'inspecció tècnica d'un edifici aquí,
per passar-lo després al portal de l'Agència («Generador d'informes ITE»):
les dades les hi entra Claude pel formulari del portal, i les fotos surten
d'un zip amb el nom de cada una al seu lloc.

- **Nou informe**: el tècnic (David) ja hi surt; de l'expedient s'agafa
  l'adreça i del client la propietat (també es pot omplir des de qualsevol
  client i contacte de la Base de Dades).
- **Obtenir dades del Cadastre**: amb la referència cadastral omple l'adreça,
  l'any, la superfície construïda i la taula de plantes (un immoble per fila).
- Les seccions són les del menú del portal, amb les seves etiquetes; fotos
  per element de l'envolupant i per deficiència; l'estat de conservació i la
  valoració final es calculen sols.
- **Fotos per classificar**: totes les fotos de la visita de cop (arrossegant-les
  o amb un enllaç per al mòbil, sense iniciar sessió). Claude, pel connector,
  les mira i posa cada una al seu element o deficiència amb el peu
  (`ite_fotos_pendents`, `ite_colocar_fotos`); també es poden posar a mà.
- **Fotos per al portal**: zip amb una carpeta per apartat i noms que diuen on
  va cada foto (`D03-2.jpg` = deficiència 3, foto 2) més un `index.txt` amb
  els peus, per pujar-les al portal a mà o amb Claude a l'ordinador. Les fotos
  hi van reduïdes a JPEG de menys de 140 KB, mides que el portal accepta.
- **Informe en PDF**: l'informe sencer amb l'ordre del model oficial (1 a 11),
  les fotos, el resum de l'estat de conservació i la signatura del tècnic
  («PDF / Imprimir», com les actes).
- **Importar del portal**: porta un informe del portal (zip o XML) a l'app, amb
  les fotos. Cada informe importat amplia les llistes desplegables.
- També des del plugin (`create_ite`, `update_ite`, `ite_cadastre`, les fotos…).

**El portal no importa fitxers nostres**: les seves exportacions van signades
amb el seu certificat i la importació ho comprova (provat l'11/11/2026); el
botó «Importar» només readmet exportacions del mateix portal. Com s'omple el
portal amb Claude, el format i les proves: [docs/ite.md](docs/ite.md).
Tests: `npm run test:ite`.

## Plugin de ChatGPT i Claude

L'aplicació exposa un servidor MCP a `/api/mcp` amb OAuth propi, de manera que
ChatGPT i Claude poden consultar i modificar expedients, dedicació, actes,
honoraris, propostes, factures i notes en nom de l'usuari. Cada canvi es
previsualitza al xat i només es desa quan l'usuari ho confirma.

Expedients d'anys anteriors: en crear-ne un (p. ex. a partir de fotos dels seus
documents), el plugin pot donar el número que surt als documents
(`num_expedient`, p. ex. `19-1042`) o, si no n'hi ha, només l'any (`any`), que
rep el següent número lliure amb aquell any. Sense cap dels dos, l'expedient rep
l'any actual, com el botó «Nou expedient». La previsualització avisa si el
número ja existeix o si faria saltar el comptador dels expedients nous.

- Guia d'usuari (passos per connectar-lo i connexions actives): pàgina `/ai`. Ja
  no surt al menú ni a l'inici: s'hi entra escrivint l'adreça.
- Com està fet, fitxers i trampes: [docs/mcp.md](docs/mcp.md).
- Tests sense base de dades: `npm run test:mcp`.
- Variable opcional `APP_URL` per fixar l'origen públic si cal.

## Deploy a Vercel

1. Push del repo a GitHub.
2. Importar a Vercel.
3. A **Environment Variables** afegir:
   - `DATABASE_URL` (la mateixa de Neon)
   - `ADRI_PASSWORD`
   - `SESSION_PASSWORD`
   - `DEMO_DATABASE_URL` (la base de dades `demo` del mateix projecte Neon)
   - `DEMO_PASSWORD` (contrasenya del compte de demostració)
   - `CRON_SECRET` (cadena aleatòria; Vercel l'envia al cron de Descàrregues)
   - `SMTP_USER`, `SMTP_PASS` (el Gmail i la seva contrasenya d'aplicació) i
     `DESCARREGUES_AVIS` (a qui va el correu de Descàrregues)
4. Deploy.
5. Després del primer deploy, executar `npm run db:migrate` amb la `DATABASE_URL` de producció (la mateixa connexió de Neon funciona des de qualsevol lloc).

## Notes

- Els preus per defecte dels catàlegs es **congelen** en les línies de cada proposta: editar el catàleg no canvia propostes ja creades.
- A `Resum Final → Total Honoraris`, el camp comença buit i mostra el calculat com a placeholder; si hi escrius un número, sobreescriu. Botó "Restablir" per tornar al calculat.
- IVA: 21% fix sobre el Total Honoraris.
- Núm. de proposta: seqüencial (`bigserial`), simplement l'`id` de la fila.

## Següents passes possibles

- Exportar proposta a PDF.
- Camp d'estat (esborrany / enviada / acceptada / facturada).
- Pàgina de facturació (un cop la proposta s'accepta).
