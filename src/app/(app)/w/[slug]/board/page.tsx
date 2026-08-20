import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoardColumns from "@/components/board-columns";
import Avatar from "@/components/avatar";
import type { Column, Task, TeamMember } from "@/lib/types";

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const { data: workspace, error: erroWorkspace } = await supabase
    .from("workspaces")
    .select("id, nome, cor, logo_url")
    .eq("slug", slug)
    .single();
  if (erroWorkspace) console.error("Falha ao buscar workspace:", erroWorkspace.message);
  if (!workspace) notFound();

  const { data: board, error: erroBoard } = await supabase
    .from("boards")
    .select("id, nome")
    .eq("workspace_id", workspace.id)
    .limit(1)
    .single();
  if (erroBoard) console.error("Falha ao buscar board:", erroBoard.message);
  if (!board) notFound();

  const { data: columns } = await supabase.from("columns").select("*").eq("board_id", board.id).order("ordem");
  const { data: tasks } = await supabase.from("tasks").select("*").eq("board_id", board.id);
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("*")
    .or(`workspace_id.is.null,workspace_id.eq.${workspace.id}`)
    .order("nome");

  return (
    <div>
      <div className="glass flex items-center gap-3 rounded-none border-x-0 border-t-0 px-6 py-3">
        <Avatar nome={workspace.nome} url={workspace.logo_url} tamanho={32} />
        <div>
          <p className="text-sm text-muted">Cliente</p>
          <h2 className="text-lg font-semibold text-foreground">{workspace.nome}</h2>
        </div>
      </div>
      <BoardColumns
        boardId={board.id}
        workspaceId={workspace.id}
        initialColumns={(columns ?? []) as Column[]}
        initialTasks={(tasks ?? []) as Task[]}
        teamMembers={(teamMembers ?? []) as TeamMember[]}
        currentUserId={user.id}
        userRole={profile?.role ?? "cliente"}
        corCliente={workspace.cor}
      />
    </div>
  );
}
