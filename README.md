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
es desa (taula `calcul_estructural`, migració 0043), recalcula en viu i
s'exporta com a informe de justificació en **Word** i **PDF**.

- **Estintolament paret de càrrega**: estat de càrregues ponderat, comprovació
  del perfil (E.L.S. i E.L.U.), recolzament als extrems (A connectors, B daus,
  C brancals) i esnelles. Cada opció es pot treure del càlcul i de l'informe.
- **Recolzament biga**: daus de formigó i connectors a partir de l'esforç tallant.
- **Base pilar estintolament**: tensió sota la base amb repartiment a 60°.
- **Compatibilitat soldadures**: gola compatible entre ala i ànima de dos perfils
  (o una xapa) segons la taula de valors límit.

L'encapçalament (referència, projecte, adreça, ciutat i client) s'omple des de
l'expedient i es pot vincular a un client de la Base de Dades.

La pestanya **Perfils i soldadures** (i el botó «Taules de perfils» de cada
càlcul) mostra les taules del catàleg: IPE, IPN, HEB, HEA, HEM, UPN, T, L, LD,
ZF, tubs, rodons, soldadures, acers i les taules de fàbrica del CTE DB SE-F.
Estan transcrites a `src/lib/calculs/perfils/*.json` a partir de les fotos del
catàleg (`public/calculs/perfils/`); les cel·les que no quadren amb la resta de
la fila hi surten marcades amb una nota (`perfils-data.ts`).

Diferències amb els fulls de càlcul, a propòsit (detall a `src/lib/calculs/paret.ts`):
cada comprovació es fa contra el valor que s'hi mostra (alguns OK!/NO! de l'Excel
miraven una altra cel·la), la reacció als extrems és Q·L/2 (l'Excel la rebaixava
un ~2 %) i el pes propi del perfil surt del catàleg si no s'escriu.

Tests sense base de dades (comparen amb els valors dels fulls de càlcul):
`npm run test:calculs`.

## Plugin de ChatGPT i Claude

L'aplicació exposa un servidor MCP a `/api/mcp` amb OAuth propi, de manera que
ChatGPT i Claude poden consultar i modificar expedients, dedicació, actes,
honoraris, propostes, factures i notes en nom de l'usuari. Cada canvi es
previsualitza al xat i només es desa quan l'usuari ho confirma.

- Guia d'usuari (passos per connectar-lo i connexions actives): pàgina `/ai`.
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
