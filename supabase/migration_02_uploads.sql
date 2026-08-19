-- Migração 2 — Studio Ondare
-- Rode isso inteiro no SQL Editor do Supabase (projeto já existente, depois do schema.sql).
-- Seguro rodar mais de uma vez.

-- Foto de perfil dos membros do time
alter table public.team_members add column if not exists avatar_url text;

-- Logo do cliente
alter table public.workspaces add column if not exists logo_url text;

-- Buckets de armazenamento (públicos para leitura, só autenticado escreve)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "avatars leitura publica" on storage.objects;
create policy "avatars leitura publica" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars escrita autenticada" on storage.objects;
create policy "avatars escrita autenticada" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "logos leitura publica" on storage.objects;
create policy "logos leitura publica" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "logos escrita autenticada" on storage.objects;
create policy "logos escrita autenticada" on storage.objects
  for all to authenticated
  using (bucket_id = 'logos')
  with check (bucket_id = 'logos');

-- Caso o GRANT abaixo ainda não tenha sido rodado (fix do "permission denied for table profiles")
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select, insert, update, delete on public.columns to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.task_comments to authenticated;
grant select, insert, update, delete on public.task_attachments to authenticated;
