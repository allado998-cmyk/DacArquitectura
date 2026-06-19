#!/usr/bin/env node
// Seed a DEMO database with fake data (no real client info).
//
//   node --env-file=.env.local scripts/seed-demo.mjs
//
// Point DATABASE_URL at a FRESH demo database that has already been migrated
// (npm run db:migrate). For safety this refuses to run if the database already
// has expedients/factures unless you pass SEED_FORCE=1 (it wipes demo data
// first, so never aim it at your dad's real database).

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
const q = (text, params) => pool.query(text, params);

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
const YEAR = String(new Date().getFullYear()).slice(-2); // "26"

async function main() {
  // ---- Safety guard ------------------------------------------------------
  const { rows: counts } = await q(
    "select (select count(*) from public.factura)::int as f, (select count(*) from public.expedients)::int as e",
  );
  const existing = counts[0].f + counts[0].e;
  if (existing > 0 && process.env.SEED_FORCE !== "1") {
    console.error(
      `Refusing to seed: database already has data (${counts[0].e} expedients, ${counts[0].f} factures).\n` +
        "If this really is the demo database, re-run with SEED_FORCE=1 to wipe & reseed.",
    );
    process.exit(1);
  }

  console.log("Wiping demo data…");
  await q(`truncate table
    public.factura_suplit, public.factura_concepte, public.factura,
    public.dedicacions, public.expedient_fita, public.expedients,
    public.proposta_doc_servei, public.proposta_doc_inclusio, public.proposta_doc_exclusio, public.proposta_doc_pagament, public.proposta_doc,
    public.proposta_despesa_directa_line, public.proposta_altra_despesa_line, public.propostes,
    public.client_contactes, public.clients
    restart identity cascade`);

  // ---- Tipologies --------------------------------------------------------
  const tipologiaNoms = [
    "Habitatge unifamiliar",
    "Edifici plurifamiliar",
    "Local comercial",
    "Rehabilitació de façana",
    "Nau industrial",
  ];
  const tipologiaIds = [];
  for (let i = 0; i < tipologiaNoms.length; i++) {
    const { rows } = await q(
      "insert into public.tipologies (nom, ordre) values ($1, $2) on conflict (nom) do update set nom = excluded.nom returning id",
      [tipologiaNoms[i], (i + 1) * 10],
    );
    tipologiaIds.push(rows[0].id);
  }

  // ---- Clients -----------------------------------------------------------
  const clientsData = [
    ["Família Puig Soler", "47123456A", "Carrer del Carme, 12", "Barcelona", "08002"],
    ["Inversions Mediterrània, S.L.", "B61234567", "Av. Diagonal, 405", "Barcelona", "08008"],
    ["Ajuntament de Sant Just", "P0826300A", "Plaça Verdaguer, 2", "Sant Just Desvern", "08960"],
    ["Comunitat de Propietaris Rosselló 88", "H62345678", "Carrer Rosselló, 88", "Barcelona", "08029"],
    ["Marc Vidal Torres", "39876543B", "Carrer Major, 5", "Terrassa", "08221"],
    ["Restauració Bonavista, S.L.", "B63456789", "Carrer Bonavista, 21", "Badalona", "08911"],
    ["Núria Camps i Ribas", "46555111C", "Passeig de Gràcia, 60", "Barcelona", "08007"],
  ];
  const clientIds = [];
  for (const c of clientsData) {
    const { rows } = await q(
      "insert into public.clients (nom, nif, carrer, ciutat, codi_postal) values ($1,$2,$3,$4,$5) returning id",
      c,
    );
    clientIds.push(rows[0].id);
  }
  // A couple of contacts.
  await q("insert into public.client_contactes (client_id, nom, telefon, mail, comentari) values ($1,$2,$3,$4,$5)", [clientIds[1], "Laura Ferrer", "600 111 222", "laura@inversionsmed.cat", "Gerenta"]);
  await q("insert into public.client_contactes (client_id, nom, telefon, mail) values ($1,$2,$3,$4)", [clientIds[2], "Oficina Tècnica", "934 800 000", "tecnica@santjust.cat"]);

  // ---- Expedients --------------------------------------------------------
  // [seq, projecte, clientIdx, ciutat, categoria, tipologiaIdx, tipus, direccio, web, pressupost, iniciDaysAgo, finalDaysFromNow, tancatDaysAgo|null]
  const cats = { re: "re", co: "co", ed: "ed", rec: "rec", do: "do" };
  const expData = [
    [1, "Reforma integral d'habitatge al Carme", 0, "Barcelona", cats.re, 0, "privat", false, true, 38000, 40, 50, null],
    [2, "Edifici plurifamiliar Diagonal", 1, "Barcelona", cats.ed, 1, "privat", true, true, 420000, 90, 180, null],
    [3, "Mercat municipal Sant Just — diagnosi", 2, "Sant Just Desvern", cats.co, 2, "public", false, false, 65000, 20, 70, null],
    [4, "Rehabilitació façana Rosselló 88", 3, "Barcelona", cats.rec, 3, "privat", true, true, 88000, 60, 30, null],
    [5, "Ampliació unifamiliar Terrassa", 4, "Terrassa", cats.re, 0, "privat", false, false, 52000, 15, 120, null],
    [6, "Local comercial Bonavista", 5, "Badalona", cats.co, 2, "privat", false, true, 29000, 200, -10, 12],
    [7, "Reforma pis Passeig de Gràcia", 6, "Barcelona", cats.re, 1, "privat", false, true, 41000, 5, 90, null],
    [8, "Nau industrial Mediterrània", 1, "Mollet del Vallès", cats.ed, 4, "privat", true, false, 310000, 300, -20, 25],
    [9, "Curs de rehabilitació COAC", 6, "Barcelona", cats.do, 0, "privat", false, false, 1800, 30, 10, null],
    [10, "Estudi previ habitatge Camps", 6, "Barcelona", cats.re, 0, "privat", false, false, 9000, 250, -40, 60],
    [11, "Reforma comunitat Rosselló — fase 2", 3, "Barcelona", cats.rec, 3, "privat", true, true, 47000, 10, 75, null],
    [12, "Diagnosi estructural Inversions", 1, "Barcelona", cats.co, 4, "privat", false, false, 15000, 7, 45, null],
  ];
  const expIds = [];
  for (const e of expData) {
    const [seq, projecte, ci, ciutat, cat, ti, tipus, dir, web, pres, iniA, finF, tancA] = e;
    const num = `${YEAR}-${String(1000 + seq)}`;
    const inici = isoDaysAgo(iniA);
    const final = isoDaysAgo(-finF);
    const estat = tancA != null ? "tancat" : "obert";
    const tancat = tancA != null ? isoDaysAgo(tancA) : null;
    const { rows } = await q(
      `insert into public.expedients
        (num_expedient, projecte, client_id, ciutat, categoria, tipologia_id, estat, tipus, direccio_obres, web, pressupost, data_inici, data_final, data_tancament)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::date,$13::date,$14::date) returning id`,
      [num, projecte, clientIds[ci], ciutat, cat, tipologiaIds[ti], estat, tipus, dir, web, pres, inici, final, tancat],
    );
    expIds.push(rows[0].id);
  }

  // ---- Dedicacions (recent, so the calendar/últims dies look alive) ------
  const tasques = ["Redacció de projecte", "Reunió amb client", "Amidaments", "Documentació tècnica", "Càlcul d'estructura"];
  const dedis = [
    [0, 0, 4.5, tasques[0]], [0, 1, 3, tasques[2]], [6, 0, 2.5, tasques[1]],
    [3, 1, 5, "Visita direcció d'obres"], [1, 2, 6, tasques[0]], [1, 5, 4, tasques[4]],
    [10, 0, 3.5, tasques[3]], [4, 2, 2, tasques[1]], [3, 6, 4, "Visita direcció d'obres"],
    [6, 3, 3, tasques[0]], [7, 1, 5.5, tasques[0]], [11, 0, 2, tasques[1]],
  ];
  for (const [expIdx, daysAgo, hores, tasca] of dedis) {
    await q(
      "insert into public.dedicacions (expedient_id, activitat, data, hores, tasca, comentari) values ($1,'',$2::date,$3,$4,null)",
      [expIds[expIdx], isoDaysAgo(daysAgo), hores, tasca],
    );
  }

  // ---- Càlculs d'honoraris (propostes) -----------------------------------
  const calculs = [
    [`${YEAR}-0001`, 0, "Reforma integral d'habitatge al Carme", 5200],
    [`${YEAR}-0002`, 1, "Edifici plurifamiliar Diagonal", 28500],
    [`${YEAR}-0003`, 4, "Ampliació unifamiliar Terrassa", 4100],
  ];
  for (const [numP, ci, projecte, total] of calculs) {
    await q(
      `insert into public.propostes (num_proposta, data, client_id, projecte, total_honoraris_override, despeses_indirectes_pct, benefici_pct)
       values ($1,$2::date,$3,$4,$5,30,20)`,
      [numP, isoDaysAgo(35), clientIds[ci], projecte, total],
    );
  }

  // ---- Propostes (document) ----------------------------------------------
  const docs = [
    [`PH-${YEAR}-001`, 0, "Honoraris reforma integral d'habitatge al Carme", "acceptada"],
    [`PH-${YEAR}-002`, 1, "Honoraris edifici plurifamiliar Diagonal", "pendent"],
    [`PH-${YEAR}-003`, 4, "Honoraris ampliació unifamiliar Terrassa", "rebutjada"],
  ];
  for (const [numD, ci, desc, estat] of docs) {
    const { rows } = await q(
      "insert into public.proposta_doc (num, data, descripcio, client_id, estat) values ($1,$2::date,$3,$4,$5) returning id",
      [numD, isoDaysAgo(30), desc, clientIds[ci], estat],
    );
    await q("insert into public.proposta_doc_pagament (doc_id, descripcio, ordre) values ($1,'En finalitzar el servei',10)", [rows[0].id]);
    await q("insert into public.proposta_doc_servei (doc_id, descripcio, preu, ordre) values ($1,$2,$3,10)", [rows[0].id, desc, 0]);
  }

  // ---- Factures ----------------------------------------------------------
  // [num|null, estat, clientIdx, expIdx, preu, iva, pagada, monthsAgo, lang, concepte]
  const factures = [
    [`${YEAR}-001`, "emesa", 0, 0, 1800, 21, true, 5, "es", "Honorarios reforma — primera certificación"],
    [`${YEAR}-002`, "emesa", 1, 1, 9500, 21, true, 4, "es", "Honorarios proyecto básico edificio"],
    [`${YEAR}-003`, "emesa", 2, 2, 6500, 21, false, 3, "ca", "Diagnosi mercat municipal"],
    [`${YEAR}-004`, "emesa", 3, 3, 4200, 21, true, 2, "ca", "Rehabilitació façana — fase 1"],
    [`${YEAR}-005`, "emesa", 6, 6, 2100, 21, false, 1, "es", "Honorarios reforma piso"],
    [`${YEAR}-006`, "emesa", 6, 8, 900, 0, false, 1, "ca", "Curs de rehabilitació (servei cultural)"],
    [`${YEAR}-007`, "emesa", 4, 4, 3100, 21, false, 0, "ca", "Ampliació unifamiliar — projecte"],
    [null, "propera", 1, 11, 5000, 21, false, null, "ca", "Diagnosi estructural — pendent d'emetre"],
    [null, "propera", 3, 10, 3800, 21, false, null, "ca", "Reforma comunitat fase 2"],
  ];
  for (const [num, estat, ci, ei, preu, iva, pagada, monthsAgo, lang, concepte] of factures) {
    const data = monthsAgo == null ? null : isoDaysAgo(monthsAgo * 30 + 2);
    const { rows } = await q(
      `insert into public.factura (estat, num, client_id, data, expedient_id, preu, iva_pct, pagada, concepte, lang)
       values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10) returning id`,
      [estat, num, clientIds[ci], data, expIds[ei], preu, iva, pagada, concepte, lang],
    );
    // A couple of suplits on one invoice for realism.
    if (num === `${YEAR}-002`) {
      await q("insert into public.factura_suplit (factura_id, descripcio, import, ordre) values ($1,'Taxes municipals',320,10)", [rows[0].id]);
    }
  }

  const { rows: tot } = await q(
    "select (select count(*) from public.clients)::int c, (select count(*) from public.expedients)::int e, (select count(*) from public.factura)::int f, (select count(*) from public.propostes)::int p, (select count(*) from public.proposta_doc)::int d",
  );
  console.log("Seeded demo data:", tot[0]);
}

main()
  .then(() => pool.end())
  .then(() => console.log("done."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
