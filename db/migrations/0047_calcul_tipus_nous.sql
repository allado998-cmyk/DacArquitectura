-- DacArquitectura — Six more calculation types (David's spreadsheets of 8 Nov 2026):
--   bigueta-acer:            Comprovació Bigueta d'Acer Estàndard
--   bigueta-acer-ala:        Comprovació Bigueta d'Acer Ala Estreta
--   bigueta-fusta:           Comprovació Bigueta de Fusta i Resistència al Foc
--   inercies-perfils:        Suma d'Inèrcies entre Perfils
--   inercies-pletines:       Suma d'Inèrcies entre Pletines
--   inercies-perfil-pletina: Suma d'Inèrcies entre Perfils i Pletina
-- Idempotent: safe to re-run.

alter table public.calcul_estructural drop constraint if exists calcul_estructural_tipus_check;
alter table public.calcul_estructural add constraint calcul_estructural_tipus_check check (tipus in (
  'paret', 'biga', 'pilar', 'soldadura',
  'bigueta-acer', 'bigueta-acer-ala', 'bigueta-fusta',
  'inercies-perfils', 'inercies-pletines', 'inercies-perfil-pletina'
));
