import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BoardColumns from "@/components/board-columns";
import type { Column, Task, TeamMember } from "@/lib/types";

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  const { data: workspace } = await supabase.from("workspaces").select("id, nome").eq("slug", slug).single();
  if (!workspace) notFound();

  const { data: board } = await supabase.from("boards").select("id, nome").eq("workspace_id", workspace.id).limit(1).single();
  if (!board) notFound();

  const { data: columns } = await supabase.from("columns").select("*").eq("board_id", board.id).order("ordem");
  const { data: tasks } = await supabase.from("tasks").select("*").eq("board_id", board.id);
  const { data: teamMembers } = await supabase.from("team_members").select("*").order("nome");

  return (
    <div>
      <div className="border-b border-border bg-white px-6 py-3">
        <p className="text-sm text-muted">Cliente</p>
        <h2 className="text-lg font-semibold text-navy-900">{workspace.nome}</h2>
      </div>
      <BoardColumns
        boardId={board.id}
        initialColumns={(columns ?? []) as Column[]}
        initialTasks={(tasks ?? []) as Task[]}
        teamMembers={(teamMembers ?? []) as TeamMember[]}
        currentUserId={user.id}
        userRole={profile?.role ?? "cliente"}
      />
    </div>
  );
}
