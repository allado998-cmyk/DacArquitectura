# El plugin de ChatGPT i Claude

DacArquitectura es pot fer servir des de ChatGPT o Claude. Per sota és un **servidor MCP remot** (Model Context Protocol) a `https://<domini>/api/mcp`, protegit amb OAuth 2.1 servit per la mateixa aplicació. La guia d'usuari és la pàgina `/ai` de l'app.

## Com es connecta

- **ChatGPT**: Configuració → Aplicacions i connectors → *Crear connector MCP personalitzat* → enganxar l'URL, autenticació **OAuth** → Connecta → entrar amb l'usuari de l'app → **Autoritzar**.
- **Claude**: Configuració → Connectors → *Afegir connector personalitzat* → enganxar l'URL (sense client ID ni secret) → Connecta → entrar → **Autoritzar**.

Els dos clients es registren sols (Dynamic Client Registration o Client ID Metadata Documents). No cal configurar res al servidor.

## Arquitectura

```
ChatGPT / Claude
  |  POST /api/mcp   Authorization: Bearer <token emès per /oauth/token>
  v
withMcpAuth  →  findLiveToken (hash a mcp_oauth_token; 401 si no val)
  v
mcp-handler  →  McpServer  →  router: cerca · dac_actions · dac_read · dac_change · acta_afegir_fitxer
  v
guard(): usuari del token  →  runAsActingUser(usuari)
  v
dac_read: consulta SQL (mateix `sql` proxy que la web: el demo va a la BD demo)
dac_change: plan (només llegeix) → confirm? → idempotency_key → server action de la web
```

### Fitxers

| Què | On |
|---|---|
| Endpoint MCP, verificació del token, branding | `src/app/api/mcp/route.ts` |
| Descobriment OAuth (RFC 9728 / RFC 8414) | `src/lib/mcp/well-known.ts`, `src/app/.well-known/**` |
| Servidor OAuth: registre, autoritzar, token, revocar | `src/app/oauth/*/route.ts`, `src/lib/mcp/oauth-core.ts`, `oauth-db.ts`, `clients.ts` |
| Usuari actuant (AsyncLocalStorage) | `src/lib/acting-user.ts`, `src/lib/auth.ts` |
| Registre d'accions, tipus, format de resultats | `src/lib/mcp/core.ts` |
| Guard, previsualització → confirmació, idempotència | `src/lib/mcp/shared.ts` |
| Les cinc eines visibles | `src/lib/mcp/router.ts` |
| Regles pures de les actes (llistes per índex, responsables, valors per defecte) | `src/lib/mcp/acta-plan.ts` |
| Fitxers: baixada segura, tipus pels primers bytes, compressió de fotos | `src/lib/mcp/media.ts` |
| Instruccions del servidor i llista de dominis | `src/lib/mcp/index.ts` |
| Accions per domini | `src/lib/mcp/tools/<domini>.ts` |
| Lectures compartides | `src/lib/mcp/data.ts` |
| Taules OAuth i registre d'ús | `db/migrations/0040_mcp.sql` |
| Pàgina d'usuari i connexions actives | `src/app/ai/` |
| Tests | `scripts/test-mcp.mjs` (`npm run test:mcp`) |

## Autenticació

L'app no tenia cap proveïdor d'identitat (només iron-session amb dos usuaris, `adri` i `demo`), així que l'aplicació fa d'**authorization server**:

- `/.well-known/oauth-protected-resource` (i la variant `/api/mcp`) diu que el recurs està protegit per aquest mateix origen.
- `/.well-known/oauth-authorization-server` publica els endpoints, `code_challenge_methods_supported: ["S256"]`, `token_endpoint_auth_methods_supported: ["none"]` i `client_id_metadata_document_supported: true`.
- `POST /oauth/register`: registre dinàmic. Només clients públics amb PKCE; les `redirect_uris` han de ser `https` (o `http://localhost` per a eines locals).
- `GET /oauth/authorize`: pantalla d'inici de sessió i consentiment. Si ja hi ha sessió al navegador, només cal prémer **Autoritzar**. El codi dura 10 minuts i és d'un sol ús (es marca `used_at`, no s'esborra). El botó es desactiva en clicar-lo, i si una pàgina ja completada (mateix client i mateix repte PKCE) es torna a enviar, mostra «Ja està connectat» en lloc de donar un codi nou: un segon codi fa que Claude mostri «La autorización con este conector falló» tot i que la connexió funciona.
- `POST /oauth/token`: `authorization_code` (amb verificació PKCE) i `refresh_token`. Token d'accés de 30 dies; refresh d'un any, **no es rota** (un reintent perdut no pot deixar el client fora).
- `POST /oauth/revoke`: revocació. Des de `/ai` també es poden revocar totes les connexions d'un client.

Els tokens es guarden **hashejats** (SHA-256) a `mcp_oauth_token`, sempre a la base de dades real (cal poder verificar un token abans de saber de qui és). Un client_id que sigui una URL `https` es tracta com a CIMD: es baixa el document (5 s, 64 KB, només hosts públics) i es comprova que `client_id` coincideix.

## Actuar com l'usuari

Les server actions de la web troben l'usuari amb `requireUser()` (cookie). En una petició OAuth no hi ha cookie, així que el guard executa cada eina dins `runAsActingUser(usuari)` (`AsyncLocalStorage`). `requireUser()` i `isDemoSession()` miren primer aquest context; per tant **el mateix codi** de la web s'executa amb el mateix usuari i, per al compte `demo`, contra la base de dades de demostració.

- L'usuari surt només del token verificat, mai dels arguments.
- El context només existeix dins la cadena asíncrona de l'eina.
- Dins una eina, `redirect()` i `notFound()` llancen; `callAction()` ho captura i retorna la URL (d'on es treu l'id nou).

## Previsualització i confirmació

Cada acció de canvi té `plan()` (només llegeix: resol referències, valida, descriu) i `commit()` (escriu via la server action). `dac_change`:

1. `confirm=false` → executa `plan` i retorna `PREVISUALITZACIÓ` amb resum, detalls, avisos i una `idempotency_key` suggerida. No s'escriu res.
2. `confirm=true` + `idempotency_key` → es reclama la clau a `mcp_usage` (única per usuari). Clau repetida: retorna el resultat guardat («JA FET») sense escriure. Clau en curs: demana reintentar. Clau d'una altra acció: error. Després torna a planificar (per si les dades han canviat) i només escriu si no hi ha errors.

Les accions que la web implementa com a «substituir tota la fila» (expedients, factures, actes, capçalera d'honoraris) es fusionen amb la fila actual abans de cridar-les, perquè un canvi parcial no esborri res.

## Trobar expedients i actes

La gent no diu «26-0120»: diu «el 120», «26-120» o «la reforma del carrer Major». Allà on una acció rep `expedient_num` (i `num` a `get_expedient`), `resolveExpedient` (`data.ts`) accepta:

- el número exacte; un número curt (`26-120`, `26 0120`, `260120`, `exp. 120`, `120`), que es compara pel comptador final, únic entre anys;
- paraules del projecte, el client o la ciutat, totes presents, sense accents ni majúscules (`public.dac_fold`, migració 0041; «col·legi» = «collegi»).

Si hi ha una sola coincidència es fa servir; si n'hi ha diverses, l'error les llista perquè l'assistent pregunti. `cerca` i `list_expedients` fan servir la mateixa lògica. `get_acta` accepta `AC-26-015`, `26-15` o `15`.

Una lectura que no troba la referència torna com a error (no com a dades), i `mcp_usage` guarda els arguments de cada lectura i de cada `cerca` (estat `not_found` quan no troba res), per poder veure què es va demanar.

## Pressupost d'eines

ChatGPT només llegeix uns 5.000 tokens de definicions d'eines. Per això els clients veuen **cinc eines** (`cerca`, `dac_actions`, `dac_read`, `dac_change`, `acta_afegir_fitxer`) i les 62 accions queden darrere: `dac_actions(action=…)` retorna el JSON Schema exacte de cadascuna. `tools/list` pesa uns 4.700 caràcters; el test falla si passa de 9.000.

## Actes

Tot el que es pot fer a l'editor d'una acta es pot fer des del xat:

- `create_acta`, `update_acta` i `duplicate_acta` accepten tots els camps: motiu (`visita | reunio | coordinacio | altres`, els de `ACTA_REASONS`), expedient, dedicació (només en crear), acta nº, data, hora, lloc, projecte, referència, ubicació, client, assistents, temes, propera visita i signatures.
- Llistes (assistents, temes, signatures): la llista sencera la substitueix; `afegir_*` hi afegeix al final; `modificar_*` [{index, …}] i `treure_*` [index] treballen sobre els índexs que retorna `get_acta`. Ordre: modificar, treure, afegir.
- Temes: `categoria` (pendent, executat, tractat), títol, text i responsables. Els responsables es resolen contra els assistents finals: nom exacte, inicials («DL», o les del parèntesi) o un tros únic del nom. Si és ambigu, la previsualització falla; si no és assistent, avisa i es desa tal qual.
- Una acta nova porta els valors de `insertActa` (assistents i signataris del despatx, lloc Obra/Oficina, «A concretar»). `acta-plan.ts` en duu una còpia per a la previsualització, perquè un mòdul «use server» no pot exportar constants: si canvien a `actions.ts`, cal canviar-los també allà.
- Amb `dedicacio_id` es fa servir `createActaFromDedicacioAction` (una acta per dedicació) i la data de l'acta és la de la dedicació. `link_acta_dedicacio` lliga o deslliga després.
- Canviar l'expedient fa el mateix que l'editor: la referència el segueix i un projecte o client buit s'omple des de l'expedient.
- `acta_persones` dona els assistents d'actes anteriors i els contactes de la Base de Dades.

### Fotos, PDF i àudios

`acta_afegir_fitxer` és una eina visible pròpia perquè ChatGPT només omple els fitxers adjunts en arguments de primer nivell marcats a `_meta["openai/fileParams"]`. ChatGPT envia `{download_url, file_id, mime_type, file_name}`; les apps de mòbil envien un text `chat_upload…` i l'eina explica que cal fer-ho des de la web o l'escriptori. Qualsevol client pot passar `url` (enllaç https públic); a Claude és l'única manera, perquè no passa imatges del xat a les eines.

- Baixada: només https, sense credencials ni port, domini que no resolgui a adreces privades (es comprova a cada redirecció, màxim 3), 20 s i 25 MB.
- El tipus es llegeix dels primers bytes: JPEG, PNG, WebP, GIF, AVIF (fotos), PDF, i MP3, M4A, OGG, WAV, WebM, AAC, FLAC (àudio). HEIC no es pot convertir: es demana JPEG.
- Les fotos passen per `sharp` igual que fa la web al navegador: girades segons l'EXIF, màxim 1600 px, JPEG qualitat 72, sense metadades. Els PDF i àudios es desen tal qual (màxim 15 MB).
- La previsualització ja baixa i converteix el fitxer (així detecta errors); el resultat es guarda 15 minuts en memòria perquè la confirmació no ho torni a fer.
- `remove_acta_fitxer` treu un fitxer per índex.

El camí de ChatGPT s'ha provat amb una crida que imita el seu format (`download_url` cap a una imatge pública), no amb ChatGPT real.

## Què no es pot fer des del xat

Esborrar expedients, clients, factures, propostes o actes; canviar contrasenyes. Les línies petites (dedicacions, fites, línies de factura, serveis d'una proposta, línies d'un càlcul, fitxers d'una acta) sí que es poden esborrar, i estan marcades com a destructives.

## Variables d'entorn

Cap de nova és obligatòria. `APP_URL` (p. ex. `https://dac.example`) fixa l'origen públic si el proxy no envia `x-forwarded-host`; per defecte es dedueix de cada petició.

## Proves

- `npm run test:mcp`: tests sense base de dades (PKCE, redirect URIs, documents de descobriment, registre d'accions, pes de `tools/list`, previsualització/confirmació/idempotència sobre un `McpServer` real, responsables i llistes de les actes, tipus de fitxer, adreces privades).
- Prova completa feta el 10/10/2026 contra el servidor local: com a `demo`, totes les lectures, una acta omplerta sencera (amb foto, PDF i àudio), i totes les accions de canvi sobre files creades i esborrades després; com a `adri`, totes les lectures sobre la base de dades real, sense escriure-hi res.
- Extrem a extrem en local: `npm run dev`, registrar un client amb `POST /oauth/register`, obrir `/oauth/authorize?...` amb PKCE, bescanviar el codi a `/oauth/token` i cridar `/api/mcp`. L'MCP Inspector (`npx @modelcontextprotocol/inspector`) fa tot el flux. Per provar escriptures, entra com a `demo`.
- Als clients: afegeix el connector com un usuari i comprova previsualització + confirmació, «JA FET» amb la mateixa clau, i que `cerca` troba un expedient.

## Trampes conegudes

- Els clients **cachegen la llista d'eines**: després de canviar accions, torna a connectar el connector.
- `revalidatePath` dins una eina només invalida la cache de la web; no té efecte al xat.
- Per saber l'id d'una fila acabada de crear quan l'acció no el retorna, es fa `max(id)` de la taula: vàlid perquè l'app és d'un sol usuari.
- Els fitxers de test llegeixen el codi amb `\r\n` → `\n` abans de buscar patrons (checkout a Windows).
- Els números de Neon arriben com a text i es mostren com a números, excepte els codis (acta nº, codi postal, telèfon, NIF…) i qualsevol valor amb zero inicial, perquè «04» o «08001» no perdin el zero.
- `jsonb - $1` amb un paràmetre sense tipus fa servir l'operador de text (treu un element igual a «0») en lloc del d'índex. Les accions de la web per treure fotos, documents i àudios d'una acta tenien aquest error i no esborraven res; ara fan `- ${index}::int`.
