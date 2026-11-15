-- DacArquitectura — Six more calculation types (David's spreadsheets of 15 Nov 2026):
--   reforc-trencallums:   Reforç de Trencallums                              (group Reforços)
--   reforc-biga-acer:     Reforç Biga d'Acer amb Xapa de Compressió          (group Reforços)
--   reforc-biga-acer-ala: Reforç Biga d'Acer Ala Estreta amb Xapa de Compressió (group Reforços)
--   baixada-carregues:    Baixada de Càrregues Comprovació Tensió Paret      (group Estructura vertical)
--   paviment-vidre:       Paviment de Vidre                                  (group Paviments)
--   carrega-vent:         Càrrega Vent CTE                                   (group Vent)
-- Idempotent: safe to re-run.

alter table public.calcul_estructural drop constraint if exists calcul_estructural_tipus_check;
alter table public.calcul_estructural add constraint calcul_estructural_tipus_check check (tipus in (
  'paret', 'biga', 'pilar', 'soldadura',
  'bigueta-acer', 'bigueta-acer-ala', 'bigueta-fusta',
  'reforc-trencallums', 'reforc-biga-acer', 'reforc-biga-acer-ala',
  'baixada-carregues',
  'paviment-vidre',
  'carrega-vent',
  'inercies-perfils', 'inercies-pletines', 'inercies-perfil-pletina'
));
