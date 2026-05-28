-- DacArquitectura — seed catalog concepts.
-- Idempotent: ON CONFLICT clauses make this safe to re-run.

-- Despeses Directes
insert into public.concepte_despesa_directa (nom, ordre) values
  ('Visita al lloc',           10),
  ('Visites',                  20),
  ('Informació a despatx',     30),
  ('Memòria Diagnosi',         40),
  ('Memòria',                  50),
  ('Dibuix',                   60),
  ('Amidaments',               70),
  ('Tràmits Administratius',   80),
  ('Primera Ocupació',         90),
  ('Informe Visites d''Obra', 100)
on conflict (nom) do nothing;

-- Altres Despeses (with default unit price in €)
insert into public.concepte_altra_despesa (nom, preu_unitat_default, ordre) values
  ('Desplaçaments Benzina (litres)',   0.34,   10),
  ('Desplaçament Desgast Cotxe',       0.10,   20),
  ('Desplaçament Peatges',             5.28,   30),
  ('Pàrquing',                         3.00,   40),
  ('Desplaçament Bus',                 1.30,   50),
  ('Desplaçament AVE',               100.00,   60),
  ('Desplaçament Avió',              140.00,   70),
  ('Desplaçament Vaixell',            37.00,   80),
  ('Desplaçament Taxi',               20.00,   90),
  ('Desplaçament Autobús',             3.50,  100),
  ('Dietes Esmorzar',                  5.00,  110),
  ('Dietes Dinar',                    10.00,  120),
  ('Dietes Sopar',                    15.00,  130),
  ('Nit d''Hotel',                   125.00,  140),
  ('Visat',                            0.00,  150),
  ('Responsabilitat Civil',            0.0201, 160),
  ('Còpies',                          25.00,  170),
  ('Altres Despeses',                 10.00,  180)
on conflict (nom) do nothing;
