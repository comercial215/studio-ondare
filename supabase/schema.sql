-- Studio Ondare — schema completo (Etapas 1 e 3)
-- Rode isso inteiro no SQL Editor do Supabase, de uma vez.

create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS
-- =========================================================
create type public.user_role as enum ('admin', 'time', 'cliente');
create type public.status_aprovacao_enum as enum ('em_analise', 'aprovado', 'ajuste_solicitado');
create type public.status_contrato_enum as enum ('ativo', 'pausado', 'encerrado');
create type public.formato_conteudo_enum as enum ('Carrossel', 'Video_Reels', 'Foto', 'Stories', 'Impressos');
create type public.canal_plataforma_enum as enum ('Instagram', 'Stories', 'LinkedIn', 'Trafego', 'Presencial');

-- =========================================================
-- WORKSPACES (clientes)
-- =========================================================
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  cor text not null default '#1e3a5f',
  valor_contrato_mensal numeric(12,2),
  status_contrato public.status_contrato_enum not null default 'ativo',
  criado_em timestamptz not null default now()
);

-- =========================================================
-- PROFILES (estende auth.users)
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  avatar_url text,
  role public.user_role not null default 'cliente',
  workspace_id uuid references public.workspaces(id) on delete set null
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', new.email));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- TEAM MEMBERS
-- =========================================================
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  nome text not null,
  email text not null,
  cargo text,
  criado_em timestamptz not null default now()
);

-- =========================================================
-- BOARDS / COLUMNS
-- =========================================================
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  nome text not null default 'Quadro principal',
  criado_em timestamptz not null default now()
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  nome text not null,
  emoji text,
  ordem int not null default 0,
  is_final boolean not null default false
);

-- Gera automaticamente board + 6 colunas padrão para todo novo workspace
create function public.seed_board_padrao()
returns trigger as $$
declare
  v_board_id uuid;
begin
  insert into public.boards (workspace_id, nome)
  values (new.id, 'Quadro principal')
  returning id into v_board_id;

  insert into public.columns (board_id, nome, emoji, ordem, is_final) values
    (v_board_id, 'A fazer', '💡', 0, false),
    (v_board_id, 'Em Produção', '⚙️', 1, false),
    (v_board_id, 'Aguardando Aprovação', '⏳', 2, false),
    (v_board_id, 'Ajustes Solicitados', '🔄', 3, false),
    (v_board_id, 'Pronto', '✅', 4, false),
    (v_board_id, 'Concluído', '🚀', 5, true);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_workspace_created
  after insert on public.workspaces
  for each row execute function public.seed_board_padrao();

-- =========================================================
-- TASKS
-- =========================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null references public.columns(id) on delete restrict,
  posicao int not null default 0,
  titulo text not null,
  descricao text,
  responsavel_id uuid references public.team_members(id) on delete set null,
  prazo date,
  status_aprovacao public.status_aprovacao_enum not null default 'em_analise',
  formato_conteudo public.formato_conteudo_enum,
  canal_plataforma public.canal_plataforma_enum,
  link_material text,
  data_conclusao_real timestamptz,
  entrou_na_coluna_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index on public.tasks (board_id);
create index on public.tasks (column_id);
create index on public.tasks (responsavel_id);

-- Trigger: mantém entrou_na_coluna_em e data_conclusao_real sempre corretos,
-- sem depender do nome da coluna (usa columns.is_final).
create function public.tasks_column_change()
returns trigger as $$
declare
  v_is_final boolean;
begin
  if tg_op = 'INSERT' or new.column_id is distinct from old.column_id then
    new.entrou_na_coluna_em := now();

    select is_final into v_is_final from public.columns where id = new.column_id;

    if v_is_final then
      new.data_conclusao_real := now();
    else
      new.data_conclusao_real := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_tasks_column_change
  before insert or update of column_id on public.tasks
  for each row execute function public.tasks_column_change();

-- =========================================================
-- COMENTÁRIOS E ANEXOS
-- =========================================================
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) on delete cascade,
  texto text not null,
  criado_em timestamptz not null default now()
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  url text not null,
  nome_arquivo text not null,
  enviado_por uuid references public.profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.boards enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;

-- Concede o acesso básico às tabelas para o papel authenticated.
-- Sem isso, o Postgres bloqueia a query ANTES das policies de RLS entrarem em ação
-- (RLS restringe linhas, mas não substitui o GRANT de tabela).
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.columns to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert, update, delete on public.task_attachments to authenticated;

-- Helper: papel e workspace do usuário logado, sem recursão de RLS
create function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.current_workspace_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select workspace_id from public.profiles where id = auth.uid();
$$;

-- profiles
create policy "usuario le o proprio perfil" on public.profiles
  for select using (id = auth.uid() or public.current_role() in ('admin', 'time'));
create policy "usuario atualiza o proprio perfil" on public.profiles
  for update using (id = auth.uid());

-- team_members: leitura para todo mundo autenticado (popula seletor de responsável),
-- escrita só admin/time
create policy "team_members leitura autenticada" on public.team_members
  for select using (auth.uid() is not null);
create policy "team_members escrita admin/time" on public.team_members
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));

-- workspaces
create policy "workspaces admin/time acesso total" on public.workspaces
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
create policy "workspaces cliente le o proprio" on public.workspaces
  for select using (id = public.current_workspace_id());

-- boards
create policy "boards admin/time acesso total" on public.boards
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
create policy "boards cliente le do proprio workspace" on public.boards
  for select using (workspace_id = public.current_workspace_id());

-- columns
create policy "columns admin/time acesso total" on public.columns
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
create policy "columns cliente le do proprio workspace" on public.columns
  for select using (
    board_id in (select id from public.boards where workspace_id = public.current_workspace_id())
  );

-- tasks
create policy "tasks admin/time acesso total" on public.tasks
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
create policy "tasks cliente le e atualiza do proprio workspace" on public.tasks
  for select using (
    board_id in (select id from public.boards where workspace_id = public.current_workspace_id())
  );
create policy "tasks cliente atualiza do proprio workspace" on public.tasks
  for update using (
    board_id in (select id from public.boards where workspace_id = public.current_workspace_id())
  ) with check (
    board_id in (select id from public.boards where workspace_id = public.current_workspace_id())
  );

-- task_comments
create policy "comments admin/time acesso total" on public.task_comments
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
create policy "comments cliente le e cria no proprio workspace" on public.task_comments
  for select using (
    task_id in (
      select t.id from public.tasks t
      join public.boards b on b.id = t.board_id
      where b.workspace_id = public.current_workspace_id()
    )
  );
create policy "comments cliente cria no proprio workspace" on public.task_comments
  for insert with check (
    autor_id = auth.uid() and task_id in (
      select t.id from public.tasks t
      join public.boards b on b.id = t.board_id
      where b.workspace_id = public.current_workspace_id()
    )
  );

-- task_attachments
create policy "attachments admin/time acesso total" on public.task_attachments
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
create policy "attachments cliente le do proprio workspace" on public.task_attachments
  for select using (
    task_id in (
      select t.id from public.tasks t
      join public.boards b on b.id = t.board_id
      where b.workspace_id = public.current_workspace_id()
    )
  );

-- =========================================================
-- FUNÇÃO DE DASHBOARD
-- =========================================================
create function public.get_dashboard_metrics(
  p_data_inicio date,
  p_data_fim date,
  p_workspace_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_workspace_id uuid;
  v_effective_workspace uuid;
  v_result jsonb;
begin
  select role, workspace_id into v_role, v_workspace_id
  from public.profiles where id = auth.uid();

  if v_role is null then
    raise exception 'usuario sem perfil';
  end if;

  if v_role = 'cliente' then
    v_effective_workspace := v_workspace_id;
  else
    v_effective_workspace := p_workspace_id; -- pode ser null (todos)
  end if;

  select jsonb_build_object(
    'atrasadas', (
      select count(*) from public.tasks t
      join public.columns c on c.id = t.column_id
      where c.is_final = false
        and t.prazo < current_date
        and (v_effective_workspace is null or t.board_id in (
          select id from public.boards where workspace_id = v_effective_workspace))
    ),
    'em_aberto', (
      select count(*) from public.tasks t
      join public.columns c on c.id = t.column_id
      where c.is_final = false
        and (v_effective_workspace is null or t.board_id in (
          select id from public.boards where workspace_id = v_effective_workspace))
    ),
    'concluidas_periodo', (
      select count(*) from public.tasks t
      where t.data_conclusao_real::date between p_data_inicio and p_data_fim
        and (v_effective_workspace is null or t.board_id in (
          select id from public.boards where workspace_id = v_effective_workspace))
    ),
    'taxa_conclusao_prazo', (
      select case when count(*) = 0 then 0
        else round(100.0 * count(*) filter (where t.data_conclusao_real::date <= t.prazo) / count(*), 1)
      end
      from public.tasks t
      where t.data_conclusao_real::date between p_data_inicio and p_data_fim
        and (v_effective_workspace is null or t.board_id in (
          select id from public.boards where workspace_id = v_effective_workspace))
    ),
    'aguardando_aprovacao_por_workspace', (
      case when v_role = 'cliente' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('workspace_id', w.id, 'workspace_nome', w.nome, 'total', cnt))
        from (
          select b.workspace_id, count(*) cnt
          from public.tasks t
          join public.boards b on b.id = t.board_id
          join public.columns c on c.id = t.column_id
          where c.nome = 'Aguardando Aprovação'
          group by b.workspace_id
        ) x
        join public.workspaces w on w.id = x.workspace_id
      ), '[]'::jsonb) end
    ),
    'aguardando_aprovacao_detalhe', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'task_id', t.id,
        'board_id', t.board_id,
        'titulo', t.titulo,
        'workspace_nome', w.nome,
        'dias_parado', extract(day from now() - t.entrou_na_coluna_em)::int
      ) order by t.entrou_na_coluna_em asc), '[]'::jsonb)
      from public.tasks t
      join public.boards b on b.id = t.board_id
      join public.workspaces w on w.id = b.workspace_id
      join public.columns c on c.id = t.column_id
      where c.nome = 'Aguardando Aprovação'
        and (v_effective_workspace is null or b.workspace_id = v_effective_workspace)
    ),
    'mrr_total', (
      case when v_role = 'cliente' then null else (
        select coalesce(sum(valor_contrato_mensal), 0)
        from public.workspaces
        where status_contrato = 'ativo'
      ) end
    ),
    'por_responsavel', (
      case when v_role = 'cliente' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('nome', tm.nome, 'total', cnt))
        from (
          select responsavel_id, count(*) cnt
          from public.tasks t
          where t.data_conclusao_real is null
            and (v_effective_workspace is null or t.board_id in (
              select id from public.boards where workspace_id = v_effective_workspace))
          group by responsavel_id
        ) x
        join public.team_members tm on tm.id = x.responsavel_id
      ), '[]'::jsonb) end
    ),
    'por_workspace', (
      case when v_role = 'cliente' then '[]'::jsonb else coalesce((
        select jsonb_agg(jsonb_build_object('workspace_nome', w.nome, 'total', cnt) order by cnt desc)
        from (
          select b.workspace_id, count(*) cnt
          from public.tasks t
          join public.boards b on b.id = t.board_id
          where t.data_conclusao_real is null
          group by b.workspace_id
        ) x
        join public.workspaces w on w.id = x.workspace_id
      ), '[]'::jsonb) end
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_dashboard_metrics(date, date, uuid) to authenticated;

-- =========================================================
-- SEED: usuário admin manual
-- =========================================================
-- Depois de criar seu primeiro usuário pelo Supabase Auth (tela de login/signup
-- do app, ou Authentication > Users no painel), rode isto trocando o e-mail:
--
-- update public.profiles set role = 'admin' where email = 'seu-email@studioondare.com.br';
