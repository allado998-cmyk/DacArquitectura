# ITE: informes per al portal de l'Agència de l'Habitatge

La pestanya **ITE** prepara l'informe de la inspecció tècnica d'un edifici a
l'app i n'exporta el fitxer que el **botó «Importar»** del portal
(`ite.agenciahabitatge.cat`, «Portal generador informes ITE») llegeix. La idea:
no escriure l'informe al portal, que va lent, sinó importar-lo sencer.

## Estat: falta una prova al portal

L'exportació del portal porta una **signatura XML** feta amb el certificat del
servidor (`CN=ite.agenciahabitatge.cat`, RSA-SHA1, signatura *enveloped*: cobreix
tot el document). Comprovat: el resum i la signatura de l'exportació de
Mallorca 325 són vàlids. Nosaltres no tenim la clau, així que **cap fitxer fet
o modificat per nosaltres pot portar una signatura vàlida**. Si el portal la
comprova en importar, aquest camí no funciona.

Per saber-ho, `node scripts/ite-proves.mjs <export.zip>` fa tres fitxers a
`ite-proves/` (git-ignorada):

| Fitxer | Què és | Si s'importa… |
|---|---|---|
| `PROVA-1-signatura-alterada.zip` | l'exportació amb només el nom canviat («PROVA 1 · …»): la signatura ja no quadra | el portal no comprova la signatura |
| `PROVA-2-sense-signatura.zip` | el mateix sense la signatura | el portal no l'exigeix |
| `PROVA-3-generat-per-app.zip` | el que exporta l'app per a aquest informe (id nou, sense signatura, sense PDF signat, sense contrasenya, com a esborrany) | **tot funciona** |

La 3 és idèntica byte a byte (llevat del nom i l'id) a l'exportació que fa
l'app des del navegador (comprovat el 10/11/2026). Les tres apareixen a la llista
del portal amb «PROVA n ·» al davant i es poden eliminar després.

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
- **Importar del portal** (llista): el navegador obre el zip, crea l'informe,
  puja les fotos i desa. També accepta només l'XML (sense fotos).
- **Exportar** (secció «Exportar al portal»): el navegador llegeix les fotos,
  fa l'XML i el zip i el descarrega. L'id de l'informe al fitxer és
  900 000 000 + l'id de l'app (els del portal van per l'1 milió).
- **Cadastre**: amb la finca i el full, el servei públic del Catastro dona
  adreça, any, superfície construïda (suma dels immobles, el que fa servir el
  portal) i un immoble per fila de la taula de plantes.
- **Plugin**: `list_ites`, `get_ite`, `ite_camps` (lectura); `create_ite`,
  `update_ite`, `ite_cadastre` (canvi, amb previsualització). Els camps es
  diuen per ruta (`edifici.edificiDescripcio.anyConstruccio`); les llistes
  amb `afegir` / `modificar` / `treure` per índex. Fotos i exportació, a la web.

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
