-- Migração 5 — Studio Ondare
-- Rode isso inteiro no SQL Editor do Supabase (depois das migrações 1 a 4).
-- Seguro rodar mais de uma vez.

-- team_members ganha um workspace_id opcional: nulo = pessoa do time interno
-- (visível em todos os quadros); preenchido = contato do lado do cliente
-- (visível só no quadro daquele cliente).
alter table public.team_members add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- A policy de leitura antiga deixava qualquer autenticado ver a tabela inteira —
-- agora que ela também guarda contatos de clientes, isso vazaria contato de um
-- cliente pra outro. Restringe: time interno é visível pra todo mundo, contato
-- de cliente só é visível pro admin/time ou pelo próprio cliente daquele workspace.
drop policy if exists "team_members leitura autenticada" on public.team_members;
create policy "team_members leitura conforme papel" on public.team_members
  for select using (
    public.current_role() in ('admin', 'time')
    or workspace_id is null
    or workspace_id = public.current_workspace_id()
  );
