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
   deficiències, mesures i fotos (les col·loca Claude: vegeu «Les fotos»). A
   la secció **Portal i PDF**, baixa el zip amb **«Descarregar fotos»** i
   descomprimeix-lo en una carpeta.
2. Al portal (amb el certificat), crea l'informe nou i obre'n el formulari. Per
   a la **primera prova**, fes-ne un que es digui «PROVA Claude» i esborra'l
   després: així cap informe real no es toca.
3. Al panell lateral de Chrome o a l'app d'escriptori de Claude (vegeu «On
   escriure la petició»), activa el connector DacArquitectura en aquell xat i
   enganxa la petició de sota, amb el nom de l'informe.
4. Revisa el que ha omplert, puja les fotos (a sota) i tanca o signa només
   quan estigui bé. Claude no ha de tancar ni signar res.

### Les fotos

**1. Pujar-les a l'app, totes de cop.** Les fotos adjuntes al xat de Claude
no arriben al connector (a 7/11/2026 cap app de Claude ho permet: MCP encara
no té una manera estàndard de passar fitxers del xat a un servidor). Per això
van directes a l'app i queden a l'informe com a **«Fotos per classificar»**:

- Des de l'ordinador: informe → «Fotos per classificar» → arrossegar-hi totes
  les fotos (o «+ Afegir fotos»).
- Des del mòbil: al mateix lloc, «Enllaç per pujar-les des del mòbil», o
  demanar-lo a Claude («dona'm l'enllaç per pujar les fotos de l'ITE …»).
  L'enllaç obre una pàgina sense iniciar sessió, dura 24 hores i només
  serveix per afegir fotos a aquest informe (`/pujar/<token>`, com el de les
  actes).

En pujar-les es redueixen a 1600 px.

**2. Que Claude les col·loqui.** A Claude, amb el connector: «Col·loca les
fotos per classificar de l'informe ITE "…"». Claude les veu en petit
(`ite_fotos_pendents`, 8 per crida, 512 px), decideix on va cada una
(element de l'envolupant, deficiència, croquis, comptadors d'aigua, quadre
elèctric), n'escriu el peu (com a molt 200 caràcters, com al portal) i, quan
li dius que sí a la previsualització, les posa (`ite_colocar_fotos`). Si una
foto mostra una deficiència que l'informe no té, la proposa; les repetides
les pot descartar. També es poden posar a mà amb «Posar a…».

Una foto és «per classificar» mentre és a la carpeta de l'informe al
magatzem i l'informe no la fa servir (`src/lib/ite/pendents.ts`): no hi ha
cap llista a part que es pugui desquadrar, i una foto que es treu del seu
lloc hi torna. L'editor no desa mai per sobre del que hagi canviat Claude (o
una altra finestra): avisa i carrega la versió desada; i en tornar a la
finestra, la carrega sol si no hi ha res pendent de desar.

**3. Al portal, des del zip.** L'extensió de Chrome no pot triar fitxers del
disc (cap extensió pot: el diàleg de fitxers és del sistema). Per això el zip
de «Descarregar fotos» (`src/lib/ite/fotos.ts`): una carpeta per apartat del portal i el nom de cada
fitxer diu on va, `D03-2.jpg` = deficiència 3, foto 2; `E01-1.jpg` = element 1
de l'envolupant, foto 1; `CROQUIS/CROQUIS.jpg`;
`INSTALACIONS/COMPTADORS-AIGUA.jpg` i `QUADRE-ELECTRIC.jpg`;
`RECOMANACIONS.pdf`. L'`index.txt` repeteix la llista amb el títol de cada
deficiència i el peu de cada foto. Les deficiències sense foto hi surten
igualment, perquè la numeració sigui la del portal.

Les fotos del zip ja van **reduïdes per al portal**: JPEG de menys de 140 KB
i com a molt 1280 px, sense dades EXIF. El límit exacte del portal no surt a
l'inventari, però les seves pròpies exportacions (127 fotos de dos informes
reals) en tenen com a molt 143 KB i 1417 px, totes JPEG: són mides que
accepta segur. Si algun dia se sap que el límit és més alt, n'hi ha prou de
canviar `PORTAL_FOTO_MAX_BYTES` i `PORTAL_FOTO_MAX_PX` (`fotos.ts`) per tenir
fotos més nítides. Les de l'app no es toquen: el zip en fa una còpia
reduïda.

Descomprimit a, p. ex., `C:\ITE\Carrer-Llatzeret-27-fotos`, dues maneres:

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

Al portal, crear un informe nou i deixar-lo obert; canviar «NOM DE
L'INFORME» pel de l'informe a l'app. Feta amb el que va ensenyar l'inventari
del formulari (secció següent).

```
Tinc obert en aquesta pestanya un informe nou al Portal generador d'informes ITE (ite.agenciahabitatge.cat). Omple'l amb l'informe ITE «NOM DE L'INFORME» de DacArquitectura, perquè només em quedi pujar les fotos i signar.

PREPARACIÓ
1. Treballa només en aquesta pestanya i en aquest informe; no en toquis cap altre del portal.
2. Amb el connector DacArquitectura, busca l'informe amb list_ites. Si n'hi ha més d'un amb aquest nom, pregunta'm quin.
3. Ves secció per secció i demana a get_ite només la secció que facis (seccio = dades, descripcio, envolupant, sistemes, deficiencies, accessibilitat, conservacio, sostenibilitat).

COM OMPLIR
- Copia els valors tal com surten a get_ite. Als desplegables tria el text exacte; si no hi és igual, el més semblant, i apunta-ho.
- Les preguntes Sí/No que get_ite posa amb «: No» també s'han de respondre. Respon-les abans dels camps que en depenen: el portal els amaga fins llavors.
- Llegeix les «nota» i el que va després de «—» a cada valor: diuen on és el camp al portal o què s'ha de prémer abans.
- Salta el tècnic redactor (ja hi és) i el que get_ite posa a «No cal entrar-ho al portal».
- No inventis res: el que és buit a DacArquitectura es queda buit.
- Fotos, croquis i PDF: salta'ls, els pujaré jo.
- Prem «Desar» abans de canviar de secció: el portal perd el que no està desat. Si surt «Si no heu desat abans es perdran els canvis», prem «Cancel·lar» i desa primer.

PER SECCIONS
- Dades Generals: posa el Nom de l'informe de DacArquitectura. Escriu Finca i Full de plànol, prem «Obtenir dades cadastre» i marca la casella que confirma l'adreça (o, si get_ite ho diu, la de no coincideix, i escriu l'adreça). A la propietat, tria la Província abans del Municipi. El representant, només si get_ite el porta.
- Desc. Bàsica Edifici: la Data Inspecció es tria amb el calendari. A «Relació de nombre d'entitats», una fila per planta amb «Alta» (Descripció, habitatges, locals, Ordre = index + 1, Té pàrquing); si el portal hi té on marcar les entitats visitades, marca les de «visitades».
- Envolupant de l'edifici: per a cada element, «Afegir», Tipus i Descripció, i «Desar». L'orientació de la façana principal és al segon bloc de la pàgina de la llista.
- Sist. Constructius: té quatre pestanyes (Fonamentació, Estructura, Tancaments verticals i cobertes, Instal·lacions de l'edifici) amb apartats plegables: obre'ls tots. Cada pestanya té unes Observacions obligatòries.
- Deficiències: a les pestanyes Estructures, Envolupant, Instal·lacions i Altres, respon «S'observen deficiències?» a cada element com diu get_ite, i desa. Després, per a cada deficiència, a l'element que diu «element»: «Alta», Descripció, Gravetat, Tipus de deficiència (el text exacte) i Observacions; «Desar» i «Tornar».
- Accessibilitat: Sí o No; si és No, les caselles i els dos textos.
- Estat de Conservació: a la pestanya Recomanacions, el text; a Valoració, que coincideixi amb valoracio_final, i les observacions.
- Sostenibilitat: certificat energètic Sí o No (si és Sí, l'ID i la data amb el calendari) i una fila per mesura amb «Alta».

AL FINAL
- Ves a «Finalitzar informe» i prem només «Validar informe». No premis «Finalitzar», «Tancar» ni «Signar».
- Dona'm els errors que surtin (haurien de ser només de fotos) i el que no has pogut omplir i per què.

Si dubtes de quin camp és quin, atura't i pregunta-m'ho.
```

### Primera prova (11/11/2026)

Feta des del panell lateral de Chrome amb el connector: **les vuit seccions
desades** amb les dades de l'informe de l'app (un informe de proves, amb
valors inventats). Claude no va pujar fotos ni tancar res i va dir què no
havia pogut omplir. D'aquella llista, els ajustos a `get_ite`
(`schema.ts`: `portal` i `hint` a cada camp; `edit.ts`: `iteAsText`):

- El tècnic redactor i el lloc de signatura els posa el portal: surten com
  «No cal entrar-ho al portal» (el tècnic, només com a nota).
- El portal demana la **província** de la propietat: ara surt, la del
  municipi triat o la del codi postal.
- El portal amaga els percentatges de calefacció, ACS i refrigeració fins
  que es respon si hi ha sistema (central): aquestes preguntes ara surten
  sempre, també quan són «No».
- A deficiències, el portal demana **«S'observen deficiències?» per
  element**: ara surt la llista sencera, calculada de les deficiències.
- A les plantes, `visitades` són els números d'entitat de la fila de la
  planta, i ara hi surt el total.

L'inventari de l'endemà (secció següent) va aclarir la resta: la casella
que confirma l'adreça i «Directe» no hi eren perquè surten després de prémer
«Obtenir dades cadastre» i de marcar «Disposa de connexió a la Xarxa de
subministrament d'Aigua pública»; la casella «Altres» de l'electricitat surt
en marcar el QCP; i el certificat energètic ja té els seus camps a l'app.

## Inventari del formulari del portal

**Fet el 12/11/2026** amb Claude in Chrome sobre un informe en blanc. El
resultat, tal qual, és a [`docs/ite-portal-formulari.txt`](ite-portal-formulari.txt):
totes les seccions i pestanyes, 149 camps que apareixen en marcar-ne d'altres,
totes les opcions dels desplegables i el que demana «Validar informe». D'aquí
surten:

- **Les llistes** (`src/lib/ite/cataleg-portal.json`, fet amb
  `node scripts/ite-cataleg-portal.mjs`): 949 municipis per província, 124
  tipus de via, les 4 gravetats, els 103 tipus de deficiència amb la seva
  categoria, titulacions, col·legis, orientacions… Els valors que també
  surten en una exportació real (`cataleg-base.json`) es queden amb el seu id;
  la resta porten un id nostre (`f…`). Els 18 tipus de deficiència que ja
  teníem amb id real coincideixen lletra per lletra amb els de l'inventari.
- **Els camps que faltaven** (`schema.ts`): nom i cognoms de la propietat,
  representant, escala i bloc, dos o més nuclis, calefacció i ACS centrals
  amb combustible, torre de refredament, protecció contra incendis i contra el
  llamp, accessibilitat quan no es compleix, observacions de la valoració,
  certificat energètic, aïllament de la coberta inclinada. Si el nom surt en
  una exportació real (Llatzeret 27 en té uns quants), és el del portal; si
  no, `noExport`.
- **Els obligatoris** (`validateIte`): els asteriscs del portal i el que diu
  «Validar informe», també els condicionals (nom i cognoms amb NIF, raó
  social amb CIF, representant, ascensor, percentatges de calefacció i ACS
  individuals, escala, sanejament, aigua, almenys una mesura, un element de
  l'envolupant i un habitatge). Sense errors a la revisió de l'app, al portal
  només han de quedar les fotos.
- **Pistes per a Claude** (`portal`, `hint` a `schema.ts`, `get_ite`): el botó
  «Obtenir dades cadastre», les preguntes Sí/No que obren camps, on és cada
  camp quan no és a la mateixa secció.

Per repetir-lo (si el portal canvia), dues maneres.

### Amb Claude (recomanat)

En David entra al portal, hi crea un informe nou en blanc (només per a la
prova) i el deixa obert; obre el panell de Claude a Chrome amb el connector
DacArquitectura actiu i enganxa la petició de sota. Claude recorre les
seccions, obre les finestres d'afegir, marca les caselles que obren camps,
prem «Validar informe» i ho desa tot a la nota de DacArquitectura
«Inventari portal ITE» (pàgina Notes), una línia per camp. Llegeix com una
persona: les llistes molt llargues les pot escurçar i no veu els codis
interns del portal (que ja no calen, perquè Claude tria les opcions pel
text). Si una llista surt incompleta, es completa amb el botó.

```
Tinc obert el Portal generador d'informes ITE (ite.agenciahabitatge.cat) en aquesta pestanya, amb un informe nou en blanc. Necessito un inventari complet del formulari d'un informe: tots els camps, totes les opcions dels desplegables, els obligatoris i els avisos. És perquè una altra aplicació tingui exactament el mateix formulari. Treballa només en aquesta pestanya.

1. INFORME
- L'informe obert en aquesta pestanya és nou i en blanc, només per a aquesta prova: aquí pots marcar caselles i desar. Treballa només en aquest informe i no en toquis cap altre del portal.

2. NOTA A DACARQUITECTURA
- Amb el connector DacArquitectura, crea una nota anomenada «Inventari portal ITE» (create_note).
- Després de cada secció, afegeix-hi el que hagis trobat (update_note amb append), com a màxim 20.000 caràcters cada vegada; si una secció és més llarga, afegeix-la en diverses parts.
- No cal que em demanis confirmació per desar en aquesta nota.

3. CADA SECCIÓ DEL MENÚ
Per ordre: Dades Generals, Desc. Bàsica Edifici, Envolupant de l'edifici, Sist. Constructius, Deficiències, Accessibilitat, Estat de Conservació i Sostenibilitat.
Per a cada camp, una línia:
SECCIÓ | GRUP | ETIQUETA | TIPUS | OBLIGATORI | OPCIONS
- GRUP: el títol de l'apartat on és el camp.
- ETIQUETA: el text exacte de la pàgina, amb l'asterisc si en té.
- TIPUS: text, text llarg, número, data, casella, opció única, desplegable, autocompletar o fitxer.
- OBLIGATORI: sí o no.
- OPCIONS: per a desplegables i opcions úniques, TOTES les opcions amb el text exacte, separades per « ; ». No escurcis ni resumeixis cap llista, per llarga que sigui. Si el camp proposa opcions mentre escrius, posa AUTOCOMPLETAR i no les busquis.
A més, a cada secció:
a) Obre les finestres o files d'afegir (planta, element de l'envolupant, deficiència, mesura…) i inventaria'n també els camps. Si una llista canvia segons el que triïs en una altra (per exemple, el tipus de deficiència segons la categoria), tria cada opció de la primera i copia la llista que surt per a cada una. Tanca aquestes finestres sense desar.
b) Marca les caselles i tria les opcions que fan aparèixer camps nous: calefacció i ACS (també col·lectiva o central, i captadors solars), refrigeració (també col·lectiva), protecció contra incendis i contra el llamp, coberta inclinada, representant de la propietat, adreça del cadastre incorrecta, dos o més nuclis de comunicació vertical, accessibilitat que no es compleix, mesures cautelars, certificat d'eficiència energètica i qualsevol altra que trobis. Desa. Per a cada camp nou que aparegui, fes-ne la línia i afegeix-hi al final: | APAREIX AMB: <casella o opció>.
c) Si en desar surt algun error o avís, copia'l exacte en una línia: AVÍS | <secció> | <text>.

4. VALIDAR
Prem «Validar informe» i copia cada missatge exacte en una línia: VALIDAR | <text>. Afegeix-ho a la nota.

5. NORMES
- No pugis fotos i no premis «Finalitzar», «Tancar» ni «Signar».
- No toquis cap altre informe del portal.
- No inventis res: si no ho veus a la pàgina, no ho posis.
- Al final, digues-me quines seccions has fet, quantes línies has desat i què no has pogut fer.
```

### Amb el botó «Inventari ITE» (més exacte)

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

## Noms i ids

- **Camps**: el nom de l'element és el del portal quan surt en una exportació
  real (el test ho comprova amb totes les de `Inspeccio*.zip` i
  `ite-proves/`); els camps vistos només al formulari porten `noExport` i un
  nom nostre. Abans no n'hi posàvem cap d'inventat perquè el portal havia
  d'importar el fitxer; ara que no l'importa, el que compta és el formulari.
- **Llistes**: id real quan surt en una exportació (`cataleg-base.json`, taula
  `ite_cataleg`); si no, el de `cataleg-portal.json`. Si un valor arriba més
  tard amb el seu id real (important un informe), el nostre s'amaga dels
  desplegables però es manté perquè els informes que ja el fan servir es
  vegin bé.
- Falta: la descripció que el portal demana en marcar «Altres» o «Es
  desconeix/Altres» a sistemes constructius (s'omple al portal).
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
| Llistes del portal | `src/lib/ite/cataleg.ts`, `cataleg-base.json`, `cataleg-portal.json` (+ `cataleg-portal.ts`, només servidor), taula `ite_cataleg` |
| Formulari del portal (inventari) | `docs/ite-portal-formulari.txt` → `scripts/ite-cataleg-portal.mjs` |
| Valors inicials (David, propietat des del client, adreça) | `src/lib/ite/defaults.ts` |
| Cadastre (servei públic OVC, sense clau) | `src/lib/ite/cadastre.ts` |
| Canvis des del plugin | `src/lib/ite/edit.ts`, `src/lib/mcp/tools/ite.ts` |
| Importar / exportar al navegador | `src/lib/ite/portal-client.ts` |
| Fotos per al portal (noms per lloc, `index.txt`, mides), llocs d'una foto | `src/lib/ite/fotos.ts` |
| Fotos per classificar (carpeta del magatzem, miniatures) | `src/lib/ite/pendents.ts`, `src/app/ite/[id]/pendents.tsx` |
| Enllaç per pujar fotos sense iniciar sessió | `src/lib/upload-link.ts`, `src/app/pujar/` |
| Informe en PDF (document; la finestra d'impressió és `openItePdf` a `portal-client.ts`) | `src/lib/ite/informe.ts` |
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
  després de desar. Desa només sobre la versió que té (un hash de `dades`): si
  Claude o una altra finestra l'han canviat, no desa i ho diu. En tornar a la
  finestra fa una consulta petita i, si ha canviat i no hi ha res per desar,
  carrega la versió nova.
- **Fotos**: al magatzem privat de Blob, carpeta `ite/<id>`, pujades directament
  des del navegador (com les actes) o per l'enllaç `/pujar/<token>`. Es
  redueixen a 1600 px. Les de la carpeta que l'informe no fa servir són les
  «per classificar» (vegeu «Les fotos»).
- **Fotos per al portal** (secció «Portal i PDF»): el navegador llegeix les
  fotos, en fa JPEG de menys de 140 KB i 1280 px, i un zip amb els noms per
  lloc (`D03-2.jpg`…) i l'`index.txt`; vegeu «Les fotos». `get_ite` dona els
  mateixos noms a cada deficiència i element.
- **Informe en PDF** (secció «Portal i PDF», `informe.ts`): l'informe sencer
  amb l'ordre i la numeració del model oficial (1 a 11): identificació,
  dades i taula d'entitats, descripció i croquis, sistemes constructius amb
  les fotos de l'envolupant, deficiències per element amb les seves fotos
  (amb el nom del zip, `D01-2`…), accessibilitat, sostenibilitat, resum de
  l'estat de conservació amb la gravetat màxima per element, valoració final,
  signatura del tècnic i, al final, el PDF de recomanacions. Com les actes:
  una finestra que el navegador desa com a PDF, sense temps de funció; espera
  que carreguin les fotos abans d'imprimir. Porta una nota de document de
  treball (l'oficial és el del portal en tancar l'informe).
- **Importar del portal** (llista): el navegador obre el zip, crea l'informe,
  puja les fotos i desa. També accepta només l'XML (sense fotos).
- El format d'exportació del portal es manté a `buildExport` (`model.ts`) i
  als tests, però ja no hi ha cap botó: el portal no importa fitxers nostres.
- **Cadastre**: amb la finca i el full, el servei públic del Catastro dona
  adreça, any, superfície construïda (suma dels immobles, el que fa servir el
  portal) i un immoble per fila de la taula de plantes.
- **Plugin**: `list_ites`, `get_ite`, `ite_camps`, `ite_enllac_fotos`,
  `ite_fotos_pendents` (lectura); `create_ite`, `update_ite`, `ite_cadastre`,
  `ite_colocar_fotos` (canvi, amb previsualització). Els camps es diuen per
  ruta (`edifici.edificiDescripcio.anyConstruccio`); les llistes amb
  `afegir` / `modificar` / `treure` per índex. `get_ite` diu el fitxer de
  cada foto (el nom del zip) i quantes n'hi ha per classificar.
  `ite_fotos_pendents` torna les fotos com a imatges (blocs `image` de MCP,
  512 px) amb els llocs on poden anar (`CROQUIS`, `E01`…,
  `COMPTADORS-AIGUA`, `QUADRE-ELECTRIC`, `D01`…). El zip es baixa a la web.

## Cost

Res recurrent: no hi ha cap consulta periòdica. Importar i exportar es fan al
navegador (cap funció mou el zip); les fotos van directes a Blob (≈5–30 MB per
informe, menys d'un cèntim al mes). Cada consulta al Cadastre és una funció
d'un segon. L'editor d'un informe porta les llistes senceres del portal (unes
180 KB sense comprimir, poques desenes comprimides).

Fotos per classificar: obrir l'editor llista la carpeta de l'informe a Blob
(sense base de dades); tornar a la finestra fa una consulta petita a Neon i
una llista a Blob, només quan l'usuari hi torna. Les miniatures per a Claude
es fan quan les demana (8 fotos ≈ mig segon de funció). Tot plegat, cèntims
a l'any.

## Proves

- `npm run test:ite`: sense base de dades. Comprova també les llistes del
  formulari del portal i que un informe complet no dona cap error a la
  revisió (només les fotos), i cada regla de «Validar informe» per separat.
  Amb una exportació real al directori del projecte (`Inspeccio*.zip`,
  ignorat per git) també comprova la lectura i escriptura byte a byte, que
  tots els camps sense `noExport` existeixen en alguna exportació real (la de
  l'arrel i les de `ite-proves/`) i que la nostra exportació és el mateix
  informe.
- Extrem a extrem fet el 10/11/2026 amb Chromium contra el build de producció,
  com a `demo`: importar Mallorca 325 (17 deficiències, 64 fotos, 29 s), canviar
  un camp i recarregar, exportar (= PROVA-3), crear un informe nou, Cadastre
  (14 files de plantes), afegir una deficiència. Després, esborrat tot.
- `npm run test:mcp` fa el camí de Claude amb les fotos de cap a peus (amb el
  magatzem simulat): miniatures com a imatges, errors (sense peu, lloc que no
  existeix, foto ja col·locada), previsualització sense escriure, i desar.
- Extrem a extrem fet el 12/11/2026 amb Chromium contra el build de
  producció, com a `demo`: informe nou, pujar 3 fotos (una de 8 MB), posar-ne
  dues a mà, enllaç del mòbil obert sense sessió, la foto del mòbil surt en
  tornar a la finestra, dues finestres (la vella no desa per sobre i carrega
  la nova), zip (JPEG de 102 i 103 KB a 1280 px), descartar, esborrar
  l'informe. Les miniatures, contra el magatzem real.
