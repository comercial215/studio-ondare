-- Migração 3 — Studio Ondare
-- Rode isso inteiro no SQL Editor do Supabase (depois das migrações 1 e 2).
-- Seguro rodar mais de uma vez.

alter table public.workspaces add column if not exists contrato_inicio date;
alter table public.workspaces add column if not exists contrato_fim date;

-- Preenche data de início pros clientes que já existem, usando a data de criação
update public.workspaces set contrato_inicio = criado_em::date where contrato_inicio is null;

-- Histórico de receita mês a mês, considerando contrato_inicio/contrato_fim de cada cliente
-- (não usa status_contrato — o range de datas já reflete corretamente se o contrato
-- estava ativo naquele mês, mesmo que hoje o status seja outro).
create or replace function public.get_receita_historica(p_data_inicio date, p_data_fim date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_result jsonb;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role is null or v_role = 'cliente' then
    raise exception 'acesso restrito a admin e time';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('mes', to_char(mes_serie, 'YYYY-MM'), 'total', total) order by mes_serie), '[]'::jsonb)
  into v_result
  from (
    select
      mes_serie,
      coalesce(sum(w.valor_contrato_mensal), 0) as total
    from generate_series(date_trunc('month', p_data_inicio), date_trunc('month', p_data_fim), interval '1 month') as mes_serie
    left join public.workspaces w
      on w.valor_contrato_mensal is not null
     and w.contrato_inicio is not null
     and w.contrato_inicio <= mes_serie
     and (w.contrato_fim is null or w.contrato_fim >= mes_serie)
    group by mes_serie
  ) x;

  return v_result;
end;
$$;

grant execute on function public.get_receita_historica(date, date) to authenticated;
