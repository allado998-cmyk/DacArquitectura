# ITE: informes per al portal de l'Agència de l'Habitatge

La pestanya **ITE** prepara l'informe de la inspecció tècnica d'un edifici a
l'app i n'exporta el fitxer que el **botó «Importar»** del portal
(`ite.agenciahabitatge.cat`, «Portal generador informes ITE») llegeix. La idea:
no escriure l'informe al portal, que va lent, sinó importar-lo sencer.

## Estat (11/11/2026): el portal només readmet fitxers signats per ell

L'exportació del portal porta una **signatura XML** feta amb el certificat del
servidor (`CN=ite.agenciahabitatge.cat`, RSA-SHA1, *enveloped*: cobreix tot el
document) i **la comprova en importar**. Provat al portal l'11/11/2026 amb els
fitxers de `node scripts/ite-proves.mjs <export.zip>` (a `ite-proves/`,
git-ignorada):

| Fitxer | Què és | Resultat al portal |
|---|---|---|
| `PROVA-1-signatura-alterada.zip` | exportació real amb només el nom canviat | «El document xml ha estat alterat d'alguna manera, no s'importarà» |
| `PROVA-2-sense-signatura.zip` | la mateixa sense la signatura | el mateix error |
| `PROVA-3-generat-per-app.zip` i un informe nou fet a l'app | sense signatura | el mateix error |

Les exportacions d'**esborranys** també van signades (Llatzeret 27). Té sentit:
segons el CATEB, importar/exportar serveix perquè tècnic i col·laborador es
passin l'informe entre comptes del portal («necessàriament cal fer l'exportació
i la importació de les dades»). No hi ha cap generador oficial fora del web i la
signatura digital del tècnic només serveix per entrar-hi. Conclusió:
**importar un fitxer fet per nosaltres no és possible, per disseny.** No
intentem falsificar ni reaprofitar cap signatura.

L'exportació de l'app es manté perquè el format és correcte i documentat, però
el camí útil és un altre: entrar les dades pel formulari del portal i que ho
faci Claude. Vegeu la secció següent.

## Omplir el portal amb Claude

La idea: en David entra al portal amb el seu certificat, com sempre, i al seu
propi Chrome **Claude omple el formulari** llegint l'informe de l'app pel
connector. No hi ha cap fitxer ni cap signatura pel mig: són les seves dades,
entrades per la porta de sempre; ell revisa, puja les fotos i signa. El
certificat no surt mai del seu navegador.

### Un sol cop

1. **Compte de Claude de pagament** (Pro, Max, Team o Enterprise) i **Google
   Chrome**. L'extensió només funciona a Chrome: Anthropic diu explícitament
   que no s'admet en altres navegadors basats en Chromium, **Edge inclòs**. Si
   en David treballa amb Edge, cal instal·lar Chrome; **el certificat digital
   no s'ha de tornar a instal·lar**: a Windows, Chrome i Edge fan servir el
   mateix magatzem de certificats del sistema, així que a Chrome li sortirà el
   mateix certificat en entrar al portal.
2. **Extensió «Claude in Chrome»**: Chrome Web Store → *Afegeix a Chrome* →
   inicia sessió amb el seu compte de Claude → fixa-la a la barra → accepta els
   permisos. Funciona amb tots els models públics, sigui quin sigui el pla.
3. **Connector DacArquitectura**: a claude.ai → Configuració → Connectors →
   *Afegir connector personalitzat* → URL
   `https://dac-arquitectura.vercel.app/api/mcp` (sense client ID ni secret) →
   Connecta → entrar amb l'usuari `adri` → **Autoritzar**. La guia és la pàgina
   `/ai` de l'app (cal haver entrat a l'app).

### On escriure la petició

Claude ha de poder fer dues coses alhora: llegir l'informe pel connector i
moure's per la pestanya del portal. Hi ha dues maneres; val la primera que
funcioni:

- **Panell lateral de Chrome** (icona de l'extensió). Els connectors hi són
  quan el panell funciona com a sessió «Cowork» (Max i Team; Pro a mesura que
  s'hi desplega). Si al menú de connectors del panell hi surt DacArquitectura,
  activa'l i endavant.
- **App d'escriptori de Claude**: a *Personalitza → Connectors*, activa
  «Claude in Chrome» (controla el Chrome a través de l'extensió) i, al xat,
  activa també DacArquitectura. Així Claude llegeix l'informe i omple la
  pestanya del portal des de l'app d'escriptori.

Si cap de les dues no mostra el connector, hi ha un pla B que funciona a
qualsevol pla de pagament: en una pestanya de claude.ai (amb el connector),
demana «dona'm l'informe ITE Llatzeret, 27 com a llista per seccions», copia
la resposta i enganxa-la al panell de Chrome amb la petició de sota, canviant
el punt 1 per «les dades són les que t'enganxo a sota».

### Cada informe

1. A l'app, tingues l'informe ITE fet: dades, plantes, envolupant,
   deficiències, mesures i fotos. A la secció **Portal**, baixa el zip
   **«Fotos per al portal»** i descomprimeix-lo en una carpeta (vegeu «Les
   fotos»).
2. Al portal (amb el certificat), crea l'informe nou i obre'n el formulari. Per
   a la **primera prova**, fes-ne un que es digui «PROVA Claude» i esborra'l
   després: així cap informe real no es toca.
3. Al panell lateral de Chrome o a l'app d'escriptori de Claude (vegeu «On
   escriure la petició»), activa el connector DacArquitectura en aquell xat i
   enganxa la petició de sota, amb el nom de l'informe.
4. Revisa el que ha omplert, puja les fotos (a sota) i tanca o signa només
   quan estigui bé. Claude no ha de tancar ni signar res.

### Les fotos

L'extensió de Chrome no pot triar fitxers del disc (cap extensió pot: el
diàleg de fitxers és del sistema). Per això el zip **«Fotos per al portal»**
(`src/lib/ite/fotos.ts`): una carpeta per apartat del portal i el nom de cada
fitxer diu on va, `D03-2.jpg` = deficiència 3, foto 2; `E01-1.jpg` = element 1
de l'envolupant, foto 1; `CROQUIS/CROQUIS.jpg`;
`INSTALACIONS/COMPTADORS-AIGUA.jpg` i `QUADRE-ELECTRIC.jpg`;
`RECOMANACIONS.pdf`. L'`index.txt` repeteix la llista amb el títol de cada
deficiència i el peu de cada foto. Les deficiències sense foto hi surten
igualment, perquè la numeració sigui la del portal. Descomprimit a, p. ex.,
`C:\ITE\Carrer-Llatzeret-27-fotos`, dues maneres:

- **A mà**: a la deficiència 3 del portal, puja `D03-1.jpg`, `D03-2.jpg`… i
  escriu el peu que diu `index.txt`. Sense buscar res.
- **Amb Claude a l'ordinador**: l'app d'escriptori de Claude amb «ús de
  l'ordinador» (controla ratolí i teclat; a Windows, en proves per a Pro i
  Max) sí que pot obrir el diàleg de fitxers: fa clic a «Afegir foto»,
  escriu la ruta del fitxer i prem Retorn. Mentre ho fa no es pot tocar
  l'ordinador. Petició: «Les fotos de l'informe són a
  `C:\ITE\Carrer-Llatzeret-27-fotos`. Al portal, per a cada deficiència puja
  les fotos `D01-1`, `D01-2`… de la carpeta DEFICIENCIES amb el peu que diu
  index.txt; igual per a l'envolupant (`E01-1`…), el croquis i les
  instal·lacions. No tanquis ni signis res.» Si el portal deixa triar més
  d'un fitxer de cop, millor: una deficiència per diàleg.

### Petició per a Claude (copiar i enganxar)

```
Tinc obert en aquesta pestanya el formulari d'un informe al Portal generador
d'informes ITE (ite.agenciahabitatge.cat). Omple'l amb l'informe ITE
«Llatzeret, 27» de DacArquitectura. Treballa en aquesta pestanya; si no la
veus, digue-m'ho abans de fer res. No canviïs el nom de l'informe.

1. Amb el connector DacArquitectura, llista els informes ITE (list_ites) i
   obre el de Llatzeret, 27 (get_ite). Si n'hi ha més d'un, pregunta'm quin.
2. Ves secció per secció, en l'ordre del menú del portal: dades generals,
   descripció de l'edifici, envolupant, sistemes i instal·lacions,
   deficiències, accessibilitat, conservació, sostenibilitat. Per a cada
   secció demana-la a get_ite (seccio=...) i omple els camps del formulari
   que hi coincideixin.
3. Als desplegables tria l'opció amb el mateix text; a Sí / No / Es desconeix
   marca el que digui l'informe. Si el portal amaga camps fins que es respon
   una pregunta Sí/No (calefacció, ACS o refrigeració central), respon-la
   primer: l'informe la porta. El tècnic redactor i el que l'informe marca
   com «No cal entrar-ho al portal» ja hi són: salta'ls. Si una dada no té
   camp al portal o una opció no hi és, no inventis res: apunta-ho i
   continua.
4. Desa cada secció abans de passar a la següent.
5. Les fotos, el croquis i el PDF vénen del zip de fotos: salta aquests
   camps. No premis «Finalitzar», «Tancar» ni «Signar», i no toquis cap
   altre informe.
6. Al final, dona'm la llista del que no has pogut omplir i per què.

Si no estàs segur de quin camp és quin, atura't i pregunta-m'ho.
```

### Primera prova (11/11/2026)

Feta des del panell lateral de Chrome amb el connector: **les vuit seccions
desades** amb les dades de l'informe de l'app (un informe de proves, amb
valors inventats). Claude no va pujar fotos ni tancar res i va dir què no
havia pogut omplir. D'aquella llista, els ajustos a `get_ite`
(`schema.ts`: `portal` i `hint` a cada camp; `edit.ts`: `iteAsText`):

- El tècnic redactor, el lloc de signatura i les caselles de confirmació de
  l'adreça els posa el portal: ara surten com «No cal entrar-ho al portal»
  (el tècnic, només com a nota). La casella «Altres» de la instal·lació
  elèctrica no existeix al portal: igual.
- El portal demana la **província** de la propietat: ara surt, deduïda del
  codi postal.
- El portal amaga els percentatges de calefacció, ACS i refrigeració fins
  que es respon si hi ha sistema (central): aquestes preguntes ara surten
  sempre, també quan són «No».
- A deficiències, el portal demana **Sí/No per categoria**: ara surt la
  llista sencera, calculada de les deficiències de l'informe.
- Pistes als camps que al portal es diuen d'una altra manera: «Connexió a la
  xarxa: Directe» i el desplegable d'ascensors (sota «Nuclis de comunicació
  vertical»). A les plantes, `visitades` són els números d'entitat de la
  fila de la planta, i ara hi surt el total.
- Queda per al tècnic: el certificat d'eficiència energètica (el formulari
  de l'app encara no té aquests camps) i els percentatges que l'informe no
  porti.

## Inventari del formulari del portal

Perquè el formulari de l'app sigui igual que el del portal (mateixos camps,
totes les opcions dels desplegables, mateixos obligatoris),
`scripts/portal-inventari.js` llegeix la pàgina del portal on s'executa i en
baixa un JSON: cada camp amb l'etiqueta, el tipus, **totes les opcions** dels
desplegables (amb el valor intern del portal), si és obligatori, la longitud
màxima i el grup; si la pujada de fotos deixa triar diversos fitxers; els
botons i el menú; i **els missatges de validació** i els camps marcats en
error. No clica ni canvia res. No desa el text dels camps (noms, NIF…): només
si estan omplerts i, per a dates i números curts, la forma (`99/99/9999`).

**Un sol cop:** `npm run ite:bookmarklet` fa
`scripts/portal-inventari.bookmarklet.txt` (git-ignorat). A Chrome: Gestor
d'adreces d'interès → ⋮ → *Afegeix una adreça d'interès* → nom «Inventari
ITE», URL = la línia del fitxer. Sense marcador: F12 → Consola → escriure
`allow pasting` el primer cop → enganxar `scripts/portal-inventari.js` →
Retorn.

**Al portal, a l'informe de proves** (mai a un de real, perquè cal marcar
caselles):

1. Obre cada secció del menú i prem «Inventari ITE»: baixa un
   `ite-portal-<pàgina>.json` per secció.
2. Obre els diàlegs que tenen llistes (afegir deficiència, element de
   l'envolupant, planta…) i prem-lo amb el diàleg obert: aquí hi ha, per
   exemple, tots els tipus de deficiència.
3. Les preguntes Sí/No que fan aparèixer camps (calefacció o ACS central,
   refrigeració col·lectiva, nuclis d'escala, certificat energètic…): marca
   el Sí i torna a prémer-lo a la mateixa secció.
4. Prem **«Validar informe»** i, a la pàgina amb els avisos, prem-lo un cop
   més.

Els JSON van a `ite-proves/inventari/` (git-ignorada) i `npm run
ite:inventari` escriu `docs/ite-inventari.md` (sense cap valor de l'informe):
camps del portal que l'app no té, etiquetes diferents, opcions que l'app no
coneix, la pujada de fotos, i els missatges de «Validar informe» amb els
camps en error com a candidats a obligatoris. Amb això s'ajusten
`schema.ts`, `cataleg-base.json` i `validateIte`. L'objectiu: que, després
que Claude ompli el portal, **«Validar informe» només es queixi de les
fotos**.

Límits: un camp d'autocompletar (on s'escriu i surten suggeriments, com pot
ser el municipi) no porta la llista a la pàgina; l'inventari el marca però no
en pot llistar les opcions. Com que el portal no importa fitxers nostres,
l'app ja no necessita els codis interns del portal per a aquestes llistes,
només el text que Claude ha d'escriure: per als municipis serveix la llista
oficial (Idescat). Provat amb Chromium sense pantalla sobre una pàgina feta
com les de JSF/PrimeFaces; la primera prova real és al portal.

## Format (d'una exportació real, versió 2.0)

- Zip, totes les entrades *deflate*, sense directoris:
  `ITE/informes/dades/<id>/<Nom>.xml`, `…/<Nom>_signat.pdf` (només si està
  tancat) i les fotos a `ITE/informes/imatges/<id>/{ENVOLUPANTS,DEFICIENCIES,CROQUIS,INSTALACIONS}/`
  i el PDF de recomanacions a l'arrel d'`imatges/<id>/`.
- `<Nom>` = el nom de l'informe sense accents, espais ni signes.
- L'XML: un element per camp Java, sense atributs ni declaració; els nuls no
  hi són; a cada element primer `version` i `id`, després ordre alfabètic
  (ordre de `String` de Java); llistes = la mateixa etiqueta repetida; quatre
  espais de sagnat; només s'escapen `& < >`; dobles com `18.0`; dates
  `2025-04-03T00:00:00`. Les entitats porten `<id>null</id>`; els valors de
  llistes del portal (mestres) porten el seu id real.
- Les fotos s'hi referencien com `{IMAGEROOTDIR}/replaceFitxerId_<id>/<carpeta>/<fitxer>`.
- `src/lib/ite/xml.ts` llegeix i escriu aquest format; l'XML de Mallorca 325
  surt **idèntic byte a byte** (sense la signatura) en llegir-lo i tornar-lo a
  escriure.

### Coses deduïdes del PDF signat

Les caselles del PDF són imatges (marcada / buida); posant-les al costat del
text del PDF es veu quin camp és quin:

- `fp…` = façana **principal**; `af…` = **altres** façanes (no a l'inrevés).
- Camps 0/1/2 (cambra d'aire, aïllament, làmina): **0 = No, 1 = Sí, 2 = Es desconeix**.
- `aaSubministramentPublic` 1 = Directe (2 = per aforament, per ordre).
- `vrXemeneies` és «Pati d'instal·lacions».
- `tipusInspeccio` 1 = habitatge, 2 = local; una fila per porta; `revisat` = visitada.
- `teDeficienciesTipus`: per categoria, si té deficiències. `valoracio`: favorable
  si no n'hi ha o totes són lleus. Tots dos els calcula l'app i coincideixen amb
  els del portal a Mallorca 325.
- Les plantes venen en qualsevol ordre: l'ordre és `ordre`. L'app les ordena en importar.

## Què no fem

- **Cap nom de camp inventat.** Si el portal fa servir un lector estricte, un
  element desconegut faria fallar la importació. El formulari només té camps
  vistos en una exportació real (`schema.ts`; el test comprova que tots hi
  són). Les parts del portal que encara no hem vist (protecció contra
  incendis i llamp, calefacció col·lectiva, accessibilitat quan no es compleix,
  certificat energètic, representant…) surten a cada secció com a «Encara no es
  pot omplir aquí» i s'acaben al portal.
- **Cap id de llista inventat.** Els desplegables només ofereixen valors de
  `cataleg-base.json` (els de Mallorca 325) i de la taula `ite_cataleg` (els
  de cada informe importat a l'app). Per tenir totes les gravetats, tipus de
  deficiència, tipus de via, municipis…, cal importar més informes del portal.
- Ni signatura, ni `codiFinal`, `dataFirma`, `dataExport`: l'informe entra com
  a esborrany i es tanca i signa al portal.
- El bloc `usuari` de l'exportació porta el hash de la contrasenya del portal:
  s'esborra en importar (al navegador, abans d'enviar res) i l'exportació el
  refà des del tècnic, sense contrasenya.

## Fitxers

| Què | On |
|---|---|
| Lector/escriptor XML, zip | `src/lib/ite/xml.ts`, `zip.ts` |
| Camps i etiquetes del portal | `src/lib/ite/schema.ts` |
| Model: rutes, valors, plantes, fotos, exportació, revisió | `src/lib/ite/model.ts` |
| Llistes del portal | `src/lib/ite/cataleg.ts`, `cataleg-base.json`, taula `ite_cataleg` |
| Valors inicials (David, propietat des del client, adreça) | `src/lib/ite/defaults.ts` |
| Cadastre (servei públic OVC, sense clau) | `src/lib/ite/cadastre.ts` |
| Canvis des del plugin | `src/lib/ite/edit.ts`, `src/lib/mcp/tools/ite.ts` |
| Importar / exportar al navegador | `src/lib/ite/portal-client.ts` |
| Fotos per al portal (noms per lloc, `index.txt`) | `src/lib/ite/fotos.ts` |
| Inventari del formulari del portal (al navegador) | `scripts/portal-inventari.js`, `scripts/ite-inventari-bookmarklet.mjs` |
| Portal contra app | `scripts/ite-inventari.mjs` → `docs/ite-inventari.md` |
| Pàgines i accions | `src/app/ite/` |
| Taules | `db/migrations/0049_ite.sql` |
| Tests | `scripts/test-ite.mjs` (`npm run test:ite`) |
| Llistes des d'exportacions | `scripts/ite-cataleg.mjs` |
| Fitxers de prova per al portal | `scripts/ite-proves.mjs` |

## Com funciona

- **Desar**: l'informe sencer és `ite_informe.dades` (jsonb). L'editor desa sol
  1 s després de cada canvi; les fotos que ja no hi són s'esborren del magatzem
  després de desar.
- **Fotos**: al magatzem privat de Blob, carpeta `ite/<id>`, pujades directament
  des del navegador (com les actes). Es redueixen a 1600 px.
- **Fotos per al portal** (secció Portal): el navegador llegeix les fotos i fa
  un zip amb els noms per lloc (`D03-2.jpg`…) i l'`index.txt`; vegeu «Les
  fotos». `get_ite` dona els mateixos noms a cada deficiència i element.
- **Importar del portal** (llista): el navegador obre el zip, crea l'informe,
  puja les fotos i desa. També accepta només l'XML (sense fotos).
- **Fitxer en el format del portal** (secció Portal, plegat): el mateix zip
  que fa el portal (XML i fotos), sense signatura. El portal no l'importa;
  queda com a còpia de l'informe en el seu format. L'id de l'informe al
  fitxer és 900 000 000 + l'id de l'app (els del portal van per l'1 milió).
- **Cadastre**: amb la finca i el full, el servei públic del Catastro dona
  adreça, any, superfície construïda (suma dels immobles, el que fa servir el
  portal) i un immoble per fila de la taula de plantes.
- **Plugin**: `list_ites`, `get_ite`, `ite_camps` (lectura); `create_ite`,
  `update_ite`, `ite_cadastre` (canvi, amb previsualització). Els camps es
  diuen per ruta (`edifici.edificiDescripcio.anyConstruccio`); les llistes
  amb `afegir` / `modificar` / `treure` per índex. `get_ite` diu el fitxer de
  cada foto (el nom del zip); pujar fotos i baixar el zip, a la web.

## Cost

Res recurrent: no hi ha cap consulta periòdica. Importar i exportar es fan al
navegador (cap funció mou el zip); les fotos van directes a Blob (≈5–30 MB per
informe, menys d'un cèntim al mes). Cada consulta al Cadastre és una funció
d'un segon.

## Proves

- `npm run test:ite`: sense base de dades. Amb una exportació real al directori
  del projecte (`Inspeccio*.zip`, ignorat per git) també comprova la lectura i
  escriptura byte a byte, que tots els camps del formulari hi existeixen i que
  la nostra exportació és el mateix informe.
- Extrem a extrem fet el 10/11/2026 amb Chromium contra el build de producció,
  com a `demo`: importar Mallorca 325 (17 deficiències, 64 fotos, 29 s), canviar
  un camp i recarregar, exportar (= PROVA-3), crear un informe nou, Cadastre
  (14 files de plantes), afegir una deficiència. Després, esborrat tot.
