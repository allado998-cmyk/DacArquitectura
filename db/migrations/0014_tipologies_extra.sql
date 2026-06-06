-- DacArquitectura — add the full tipologia catalog (idempotent).
-- Existing rows are kept; only missing ones are inserted.

insert into public.tipologies (nom, ordre) values
  ('Administrativa',            300),
  ('Agrícola',                  310),
  ('Aparcament',                320),
  ('Biblioteca',                330),
  ('Carrer',                    340),
  ('Centre Cívic',              350),
  ('Comercial',                 360),
  ('Cultural',                  370),
  ('Escolar',                   380),
  ('Esportiva',                 390),
  ('Façana',                    400),
  ('Funerària',                 410),
  ('Hospitalària',              420),
  ('Hotelera',                  430),
  ('Industrial',                440),
  ('Magatzem',                  450),
  ('Mercat',                    460),
  ('Museu',                     470),
  ('Musical',                   480),
  ('Oficines',                  490),
  ('Parcs urbans',              500),
  ('Places urbanes',            510),
  ('Planejament',               520),
  ('Residencial Plurifamiliar', 530),
  ('Residencial Unifamiliar',   540),
  ('Sanitària',                 550),
  ('Terciari',                  560)
on conflict (nom) do nothing;
