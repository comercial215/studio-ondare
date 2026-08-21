-- Migração 6 — Studio Ondare
-- Rode isso inteiro no SQL Editor do Supabase (depois das migrações 1 a 5).
-- Seguro rodar mais de uma vez.
--
-- Antes: profiles.workspace_id guardava só UM cliente por login.
-- Agora: uma tabela nova permite um mesmo login acessar vários workspaces
-- (ex: cliente com mais de uma empresa/área, cada uma com seu próprio quadro).

create table if not exists public.workspace_acessos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (profile_id, workspace_id)
);

-- Migra os vínculos que já existiam em profiles.workspace_id pra tabela nova,
-- sem perder nada do que já foi configurado.
insert into public.workspace_acessos (profile_id, workspace_id)
select id, workspace_id from public.profiles
where role = 'cliente' and workspace_id is not null
on conflict (profile_id, workspace_id) do nothing;

alter table public.workspace_acessos enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workspace_acessos to authenticated;

drop policy if exists "workspace_acessos admin/time gerencia" on public.workspace_acessos;
create policy "workspace_acessos admin/time gerencia" on public.workspace_acessos
  for all using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));

drop policy if exists "workspace_acessos cliente ve os proprios" on public.workspace_acessos;
create policy "workspace_acessos cliente ve os proprios" on public.workspace_acessos
  for select using (profile_id = auth.uid());

-- Substitui a função que checava um único workspace por usuário, pra checar
-- "esse workspace está entre os que esse usuário tem acesso" — usada nas
-- policies de boards/columns/tasks/comments/attachments.
create or replace function public.tem_acesso_workspace(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_acessos
    where profile_id = auth.uid() and workspace_id = p_workspace_id
  )
  or exists (
    -- compatibilidade com o vínculo antigo em profiles.workspace_id
    select 1 from public.profiles
    where id = auth.uid() and workspace_id = p_workspace_id
  );
$$;

-- Atualiza as policies de cliente que antes comparavam com
-- public.current_workspace_id() (um workspace só) para usar a função nova
-- (vários workspaces possíveis).
drop policy if exists "workspaces cliente le o proprio" on public.workspaces;
create policy "workspaces cliente le o proprio" on public.workspaces
  for select using (public.tem_acesso_workspace(id));

drop policy if exists "boards cliente le do proprio workspace" on public.boards;
create policy "boards cliente le do proprio workspace" on public.boards
  for select using (public.tem_acesso_workspace(workspace_id));

drop policy if exists "columns cliente le do proprio workspace" on public.columns;
create policy "columns cliente le do proprio workspace" on public.columns
  for select using (
    board_id in (select id from public.boards where public.tem_acesso_workspace(workspace_id))
  );

drop policy if exists "tasks cliente le e atualiza do proprio workspace" on public.tasks;
create policy "tasks cliente le do proprio workspace" on public.tasks
  for select using (
    board_id in (select id from public.boards where public.tem_acesso_workspace(workspace_id))
  );

drop policy if exists "tasks cliente atualiza do proprio workspace" on public.tasks;
create policy "tasks cliente atualiza do proprio workspace" on public.tasks
  for update using (
    board_id in (select id from public.boards where public.tem_acesso_workspace(workspace_id))
  ) with check (
    board_id in (select id from public.boards where public.tem_acesso_workspace(workspace_id))
  );

drop policy if exists "comments cliente le e cria no proprio workspace" on public.task_comments;
create policy "comments cliente le do proprio workspace" on public.task_comments
  for select using (
    task_id in (
      select t.id from public.tasks t
      join public.boards b on b.id = t.board_id
      where public.tem_acesso_workspace(b.workspace_id)
    )
  );

drop policy if exists "comments cliente cria no proprio workspace" on public.task_comments;
create policy "comments cliente cria no proprio workspace" on public.task_comments
  for insert with check (
    autor_id = auth.uid() and task_id in (
      select t.id from public.tasks t
      join public.boards b on b.id = t.board_id
      where public.tem_acesso_workspace(b.workspace_id)
    )
  );

drop policy if exists "attachments cliente le do proprio workspace" on public.task_attachments;
create policy "attachments cliente le do proprio workspace" on public.task_attachments
  for select using (
    task_id in (
      select t.id from public.tasks t
      join public.boards b on b.id = t.board_id
      where public.tem_acesso_workspace(b.workspace_id)
    )
  );

drop policy if exists "team_members leitura conforme papel" on public.team_members;
create policy "team_members leitura conforme papel" on public.team_members
  for select using (
    public.current_role() in ('admin', 'time')
    or workspace_id is null
    or public.tem_acesso_workspace(workspace_id)
  );
