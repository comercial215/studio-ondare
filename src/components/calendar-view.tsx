"use client";

import { useMemo, useState } from "react";
import TaskModal from "./task-modal";
import type { Column, Task, TeamMember, UserRole } from "@/lib/types";

export type TarefaCalendario = Task & { workspace_nome: string; cor: string };

interface CalendarViewProps {
  tasks: TarefaCalendario[];
  columnsPorBoard: Record<string, Column[]>;
  teamMembers: TeamMember[];
  currentUserId: string;
  userRole: UserRole;
  mostrarLegenda?: boolean;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CalendarView({
  tasks,
  columnsPorBoard,
  teamMembers,
  currentUserId,
  userRole,
  mostrarLegenda,
}: CalendarViewProps) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [modal, setModal] = useState<{ taskId: string; boardId: string } | null>(null);

  const dias = useMemo(() => {
    const primeiroDia = new Date(ano, mes, 1);
    const inicioGrid = new Date(primeiroDia);
    inicioGrid.setDate(inicioGrid.getDate() - primeiroDia.getDay());

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicioGrid);
      d.setDate(inicioGrid.getDate() + i);
      return d;
    });
  }, [mes, ano]);

  const tarefasPorDia = useMemo(() => {
    const mapa: Record<string, TarefaCalendario[]> = {};
    tasks.forEach((t) => {
      if (!t.prazo) return;
      mapa[t.prazo] = [...(mapa[t.prazo] ?? []), t];
    });
    return mapa;
  }, [tasks]);

  const legendaWorkspaces = useMemo(() => {
    const vistos = new Map<string, string>();
    tasks.forEach((t) => vistos.set(t.workspace_nome, t.cor));
    return Array.from(vistos.entries());
  }, [tasks]);

  function mudarMes(delta: number) {
    const novo = new Date(ano, mes + delta, 1);
    setMes(novo.getMonth());
    setAno(novo.getFullYear());
  }

  const tarefaSelecionada = modal ? tasks.find((t) => t.id === modal.taskId) : null;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">
          {MESES[mes]} {ano}
        </h1>
        <div className="flex gap-2">
          <button onClick={() => mudarMes(-1)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/8">
            ← Anterior
          </button>
          <button
            onClick={() => {
              setMes(hoje.getMonth());
              setAno(hoje.getFullYear());
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/8"
          >
            Hoje
          </button>
          <button onClick={() => mudarMes(1)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground/80 hover:bg-white/8">
            Próximo →
          </button>
        </div>
      </div>

      {mostrarLegenda && legendaWorkspaces.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {legendaWorkspaces.map(([nome, cor]) => (
            <span key={nome} className="flex items-center gap-1.5 text-xs text-foreground/80">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
              {nome}
            </span>
          ))}
        </div>
      )}

      <div className="glass overflow-hidden rounded-xl">
        <div className="grid grid-cols-7 border-b border-border bg-black/15">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dias.map((dia) => {
            const chave = dia.toISOString().slice(0, 10);
            const doMes = dia.getMonth() === mes;
            const ehHoje = chave === hoje.toISOString().slice(0, 10);
            const tarefasDoDia = tarefasPorDia[chave] ?? [];

            return (
              <div
                key={chave}
                className={`min-h-[100px] border-b border-r border-border p-1.5 last:border-r-0 ${
                  doMes ? "" : "bg-black/15"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    ehHoje ? "bg-accent text-white" : doMes ? "text-foreground/80" : "text-muted/50"
                  }`}
                >
                  {dia.getDate()}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {tarefasDoDia.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setModal({ taskId: t.id, boardId: t.board_id })}
                      className="truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                      style={{ background: t.cor }}
                      title={`${t.workspace_nome} — ${t.titulo}`}
                    >
                      {t.titulo}
                    </button>
                  ))}
                  {tarefasDoDia.length > 3 && (
                    <span className="text-[11px] text-muted">+{tarefasDoDia.length - 3} outras</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modal && tarefaSelecionada && (
        <TaskModal
          taskId={modal.taskId}
          boardId={modal.boardId}
          teamMembers={teamMembers}
          columns={columnsPorBoard[modal.boardId] ?? []}
          currentUserId={currentUserId}
          podeAprovar={userRole === "cliente"}
          onClose={() => setModal(null)}
          onSaved={() => location.reload()}
        />
      )}
    </div>
  );
}
