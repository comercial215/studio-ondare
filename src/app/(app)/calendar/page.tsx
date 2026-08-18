import { createClient } from "@/lib/supabase/server";
import CalendarView, { type TarefaCalendario } from "@/components/calendar-view";
import type { Column, TeamMember } from "@/lib/types";

export default async function CalendarGeralPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();

  const { data: boards } = await supabase.from("boards").select("id, workspace_id, workspaces(nome, cor)");
  const boardIds = (boards ?? []).map((b) => b.id);

  const { data: tasksRaw } = boardIds.length
    ? await supabase.from("tasks").select("*").in("board_id", boardIds)
    : { data: [] };
  const { data: columnsRaw } = boardIds.length
    ? await supabase.from("columns").select("*").in("board_id", boardIds)
    : { data: [] };
  const { data: teamMembers } = await supabase.from("team_members").select("*").order("nome");

  const boardInfo = new Map((boards ?? []).map((b) => [b.id, b.workspaces as unknown as { nome: string; cor: string } | null]));

  const tasks: TarefaCalendario[] = (tasksRaw ?? []).map((t) => {
    const w = boardInfo.get(t.board_id);
    return { ...t, workspace_nome: w?.nome ?? "—", cor: w?.cor ?? "#2b4d78" };
  });

  const columnsPorBoard: Record<string, Column[]> = {};
  (columnsRaw ?? []).forEach((c) => {
    columnsPorBoard[c.board_id] = [...(columnsPorBoard[c.board_id] ?? []), c as Column];
  });

  return (
    <CalendarView
      tasks={tasks}
      columnsPorBoard={columnsPorBoard}
      teamMembers={(teamMembers ?? []) as TeamMember[]}
      currentUserId={user!.id}
      userRole={profile?.role ?? "time"}
      mostrarLegenda
    />
  );
}
