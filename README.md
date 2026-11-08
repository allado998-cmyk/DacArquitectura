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
(paret, biga, base pilar), **Biguetes**, **Inèrcies**, **Soldadures** i
**Referència** (Perfils i soldadures), amb el nombre de càlculs de cada tipus.
**Tots els càlculs** els llista tots amb el tipus, per cercar sense saber-lo.
Cada tipus és un `CalcType` amb el seu grup (`src/lib/calculs/index.ts`); les
famílies noves es registren a `biguetes.ts` i `inercies.ts`.

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
columnes Càrrega i Coef. mostren els valors amb dos decimals.

La pestanya **Perfils i soldadures** (i el botó «Taules de perfils» de cada
càlcul) mostra les taules del catàleg: IPE, IPN, HEB, HEA, HEM, UPN, T, L, LD,
tubs, rodons, ZF, soldadures i acers. Estan transcrites a
`src/lib/calculs/perfils/*.json` a partir de les fotos del catàleg
(`public/calculs/perfils/`, una per taula; les d'HEB, HEA i HEM comparteixen
full). La cerca troba el perfil a qualsevol taula: si no és a l'oberta, salta a
la que el té.

Diferències amb els fulls de càlcul, a propòsit (detall a `src/lib/calculs/paret.ts`):
cada comprovació es fa contra el valor que s'hi mostra (alguns OK!/NO! de l'Excel
miraven una altra cel·la), la reacció als extrems és Q·L/2 (l'Excel la rebaixava
un ~2 %) i el pes propi del perfil surt del catàleg si no s'escriu.

Tests sense base de dades (comparen amb els valors dels fulls de càlcul):
`npm run test:calculs` (els tres fitxers: `test-calculs`, `-biguetes` i `-inercies`).

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
