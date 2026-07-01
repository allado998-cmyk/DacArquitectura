-- DacArquitectura — Planned hours for the càlcul linked to an expedient.
-- For a normal càlcul: sum of despeses directes hores. For an ITE càlcul:
--   base imponible / 2 / (€ per hora of the "ITE" despesa directa concept),
-- where base imponible = preu ITE (or override) + optional commission.
-- Idempotent (create or replace).

create or replace function public.calcul_planned_hores(p_id bigint) returns numeric as $$
  select case
    when pc.es_ite then
      (
        coalesce(
          pc.total_honoraris_override,
          case
            when x.ent < 6  then tf.t1
            when x.ent < 11 then tf.t2
            else tf.t3 + tf.inc * (x.ent - 10)
          end
        ) * (1 + case when pc.ite_comissio_activa then coalesce(pc.ite_comissio_pct, 0) / 100.0 else 0 end)
      ) / 2.0 / nullif((select preu_hora_default from public.concepte_despesa_directa where nom ilike 'ITE' order by id limit 1), 0)
    else
      (select coalesce(sum(hores), 0) from public.proposta_despesa_directa_line where proposta_id = pc.id)
  end
  from public.propostes pc
  cross join lateral (
    select (pc.ut_habitatges + pc.ut_locals_200 + pc.ut_locals_400 * 2 + pc.ut_locals_600 * 3 + pc.ut_locals_800 * 4 + pc.ut_locals_1000 * 5) as ent
  ) x
  cross join lateral (
    select coalesce((select preu_1 from public.ite_tarifa where id = 1), 650) as t1,
           coalesce((select preu_2 from public.ite_tarifa where id = 1), 750) as t2,
           coalesce((select preu_3 from public.ite_tarifa where id = 1), 850) as t3,
           coalesce((select increment from public.ite_tarifa where id = 1), 15) as inc
  ) tf
  where pc.id = p_id;
$$ language sql stable;
