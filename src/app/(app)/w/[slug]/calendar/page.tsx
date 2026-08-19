import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CalendarView, { type TarefaCalendario } from "@/components/calendar-view";
import type { Column, TeamMember } from "@/lib/types";

export default async function WorkspaceCalendarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const { data: workspace } = await supabase.from("workspaces").select("id, nome, cor").eq("slug", slug).single();
  if (!workspace) notFound();

  const { data: board } = await supabase.from("boards").select("id").eq("workspace_id", workspace.id).limit(1).single();
  const { data: tasksRaw } = board
    ? await supabase.from("tasks").select("*").eq("board_id", board.id)
    : { data: [] };
  const { data: columns } = board
    ? await supabase.from("columns").select("*").eq("board_id", board.id)
    : { data: [] };
  const { data: teamMembers } = await supabase.from("team_members").select("*").order("nome");

  const tasks: TarefaCalendario[] = (tasksRaw ?? []).map((t) => ({
    ...t,
    workspace_nome: workspace.nome,
    cor: workspace.cor,
  }));

  return (
    <div>
      <div className="glass rounded-none border-x-0 border-t-0 px-6 py-3">
        <p className="text-sm text-muted">Calendário do cliente</p>
        <h2 className="text-lg font-semibold text-foreground">{workspace.nome}</h2>
      </div>
      <CalendarView
        tasks={tasks}
        columnsPorBoard={board ? { [board.id]: (columns ?? []) as Column[] } : {}}
        teamMembers={(teamMembers ?? []) as TeamMember[]}
        currentUserId={user.id}
        userRole={profile?.role ?? "cliente"}
      />
    </div>
  );
}
