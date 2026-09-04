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
