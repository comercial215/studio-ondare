-- Migração 4 — Studio Ondare
-- Rode isso inteiro no SQL Editor do Supabase (depois das migrações 1, 2 e 3).
-- Seguro rodar mais de uma vez.

-- Hoje só existe policy de UPDATE em profiles para o próprio usuário — admin/time
-- não conseguem vincular um cliente a um workspace sem isso.
drop policy if exists "admin atualiza qualquer perfil" on public.profiles;
create policy "admin atualiza qualquer perfil" on public.profiles
  for update using (public.current_role() in ('admin', 'time'))
  with check (public.current_role() in ('admin', 'time'));
