"use client";

import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { createClient } from "@/lib/supabase/client";
import TaskModal from "./task-modal";
import Avatar from "./avatar";
import type { Column, Task, TeamMember, UserRole } from "@/lib/types";

interface BoardColumnsProps {
  boardId: string;
  initialColumns: Column[];
  initialTasks: Task[];
  teamMembers: TeamMember[];
  currentUserId: string;
  userRole: UserRole;
}

function agruparPorColuna(colunas: Column[], tarefas: Task[]) {
  const mapa: Record<string, Task[]> = {};
  colunas.forEach((c) => (mapa[c.id] = []));
  tarefas
    .slice()
    .sort((a, b) => a.posicao - b.posicao)
    .forEach((t) => {
      if (!mapa[t.column_id]) mapa[t.column_id] = [];
      mapa[t.column_id].push(t);
    });
  return mapa;
}

export default function BoardColumns({
  boardId,
  initialColumns,
  initialTasks,
  teamMembers,
  currentUserId,
  userRole,
}: BoardColumnsProps) {
  const supabase = createClient();
  const [columns, setColumns] = useState(initialColumns.slice().sort((a, b) => a.ordem - b.ordem));
  const [tasksPorColuna, setTasksPorColuna] = useState(agruparPorColuna(initialColumns, initialTasks));
  const [modal, setModal] = useState<{ taskId: string | null; columnId: string } | null>(null);
  const [novaColuna, setNovaColuna] = useState(false);
  const [nomeNovaColuna, setNomeNovaColuna] = useState("");
  const [editandoColuna, setEditandoColuna] = useState<string | null>(null);

  const podeAprovar = userRole === "cliente";

  function recarregar() {
    location.reload();
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, type } = result;
    if (!destination) return;

    if (type === "COLUMN") {
      const reordenadas = columns.slice();
      const [movida] = reordenadas.splice(source.index, 1);
      reordenadas.splice(destination.index, 0, movida);
      setColumns(reordenadas);
      await Promise.all(
        reordenadas.map((c, i) => supabase.from("columns").update({ ordem: i }).eq("id", c.id))
      );
      return;
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const origemId = source.droppableId;
    const destinoId = destination.droppableId;

    const novoEstado = { ...tasksPorColuna };
    const origemLista = novoEstado[origemId].slice();
    const [tarefa] = origemLista.splice(source.index, 1);
    novoEstado[origemId] = origemLista;

    const destinoLista = origemId === destinoId ? origemLista : novoEstado[destinoId].slice();
    destinoLista.splice(destination.index, 0, { ...tarefa, column_id: destinoId });
    novoEstado[destinoId] = destinoLista;

    setTasksPorColuna(novoEstado);

    // Persiste posição/coluna: renumeramos do zero as colunas afetadas.
    const atualizacoes: PromiseLike<unknown>[] = [];
    const listasAfetadas = origemId === destinoId ? [origemId] : [origemId, destinoId];
    listasAfetadas.forEach((colId) => {
      novoEstado[colId].forEach((t, i) => {
        atualizacoes.push(
          supabase.from("tasks").update({ column_id: colId, posicao: i }).eq("id", t.id)
        );
      });
    });

    await Promise.all(atualizacoes);
  }

  async function criarColuna() {
    if (!nomeNovaColuna.trim()) {
      setNovaColuna(false);
      return;
    }
    const { data } = await supabase
      .from("columns")
      .insert({ board_id: boardId, nome: nomeNovaColuna.trim(), ordem: columns.length, is_final: false })
      .select("*")
      .single();

    if (data) {
      setColumns((prev) => [...prev, data as Column]);
      setTasksPorColuna((prev) => ({ ...prev, [data.id]: [] }));
    }
    setNomeNovaColuna("");
    setNovaColuna(false);
  }

  async function renomearColuna(id: string, nome: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, nome } : c)));
    await supabase.from("columns").update({ nome }).eq("id", id);
    setEditandoColuna(null);
  }

  async function alternarConclusao(tarefa: Task, colunaAtual: Column) {
    const destino = colunaAtual.is_final
      ? columns.find((c) => !c.is_final)
      : columns.find((c) => c.is_final);
    if (!destino) return;

    const novaPosicao = (tasksPorColuna[destino.id] ?? []).length;

    setTasksPorColuna((prev) => {
      const novo = { ...prev };
      novo[colunaAtual.id] = novo[colunaAtual.id].filter((t) => t.id !== tarefa.id);
      novo[destino.id] = [...(novo[destino.id] ?? []), { ...tarefa, column_id: destino.id }];
      return novo;
    });

    await supabase.from("tasks").update({ column_id: destino.id, posicao: novaPosicao }).eq("id", tarefa.id);
  }

  async function excluirColuna(coluna: Column) {
    if (coluna.is_final) {
      alert('A coluna final ("Concluído") não pode ser excluída.');
      return;
    }
    if ((tasksPorColuna[coluna.id] ?? []).length > 0) {
      alert("Mova ou conclua as tarefas dessa coluna antes de excluí-la.");
      return;
    }
    if (!confirm(`Excluir a coluna "${coluna.nome}"?`)) return;
    await supabase.from("columns").delete().eq("id", coluna.id);
    setColumns((prev) => prev.filter((c) => c.id !== coluna.id));
  }

  const primeiraColuna = columns[0];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-semibold text-navy-900">Quadro</h1>
        {primeiraColuna && (
          <button
            onClick={() => setModal({ taskId: null, columnId: primeiraColuna.id })}
            className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            + Nova tarefa
          </button>
        )}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" type="COLUMN" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="flex flex-1 gap-4 overflow-x-auto px-6 pb-6"
            >
              {columns.map((coluna, index) => (
                <Draggable draggableId={coluna.id} index={index} key={coluna.id}>
                  {(providedCol) => (
                    <div
                      ref={providedCol.innerRef}
                      {...providedCol.draggableProps}
                      className="flex w-72 shrink-0 flex-col rounded-xl bg-navy-900/[0.04] border border-border"
                    >
                      <div
                        {...providedCol.dragHandleProps}
                        className="flex items-center justify-between gap-2 rounded-t-xl bg-navy-800 px-3 py-2"
                      >
                        {editandoColuna === coluna.id ? (
                          <input
                            autoFocus
                            defaultValue={coluna.nome}
                            onBlur={(e) => renomearColuna(coluna.id, e.target.value.trim() || coluna.nome)}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            className="w-full rounded bg-white/10 px-1 text-sm text-white outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setEditandoColuna(coluna.id)}
                            className="truncate text-left text-sm font-medium text-white"
                          >
                            {coluna.emoji} {coluna.nome}{" "}
                            <span className="text-white/50">({(tasksPorColuna[coluna.id] ?? []).length})</span>
                          </button>
                        )}
                        {!coluna.is_final && (
                          <button
                            onClick={() => excluirColuna(coluna)}
                            className="shrink-0 text-white/50 hover:text-white"
                            title="Excluir coluna"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <Droppable droppableId={coluna.id} type="TASK">
                        {(providedList) => (
                          <div
                            ref={providedList.innerRef}
                            {...providedList.droppableProps}
                            className="flex min-h-[80px] flex-1 flex-col gap-2 p-2"
                          >
                            {(tasksPorColuna[coluna.id] ?? []).map((tarefa, i) => {
                              const responsavel = teamMembers.find((m) => m.id === tarefa.responsavel_id);
                              return (
                                <Draggable draggableId={tarefa.id} index={i} key={tarefa.id}>
                                  {(providedTask) => (
                                    <div
                                      ref={providedTask.innerRef}
                                      {...providedTask.draggableProps}
                                      {...providedTask.dragHandleProps}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setModal({ taskId: tarefa.id, columnId: coluna.id })}
                                      onKeyDown={(e) => e.key === "Enter" && setModal({ taskId: tarefa.id, columnId: coluna.id })}
                                      className={`cursor-pointer rounded-lg border border-border bg-white p-3 text-left shadow-sm transition hover:shadow-md ${
                                        coluna.is_final ? "opacity-60" : ""
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <button
                                          type="button"
                                          title={coluna.is_final ? "Reabrir tarefa" : "Concluir tarefa"}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            alternarConclusao(tarefa, coluna);
                                          }}
                                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition ${
                                            coluna.is_final
                                              ? "border-success bg-success text-white"
                                              : "border-border text-transparent hover:border-success"
                                          }`}
                                        >
                                          ✓
                                        </button>
                                        <div className="min-w-0 flex-1">
                                          <p
                                            className={`text-sm font-medium ${
                                              coluna.is_final ? "text-muted line-through" : "text-navy-900"
                                            }`}
                                          >
                                            {tarefa.titulo}
                                          </p>
                                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                                            {tarefa.prazo && (
                                              <span
                                                className={
                                                  !tarefa.data_conclusao_real &&
                                                  tarefa.prazo < new Date().toISOString().slice(0, 10)
                                                    ? "font-medium text-alert"
                                                    : ""
                                                }
                                              >
                                                {new Date(tarefa.prazo + "T00:00:00").toLocaleDateString("pt-BR")}
                                              </span>
                                            )}
                                            {tarefa.canal_plataforma && <span>· {tarefa.canal_plataforma}</span>}
                                          </div>
                                        </div>
                                        {responsavel && (
                                          <Avatar nome={responsavel.nome} url={responsavel.avatar_url} tamanho={22} />
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })}
                            {providedList.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              <div className="w-64 shrink-0">
                {novaColuna ? (
                  <div className="rounded-xl border border-dashed border-navy-400 p-2">
                    <input
                      autoFocus
                      value={nomeNovaColuna}
                      onChange={(e) => setNomeNovaColuna(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && criarColuna()}
                      onBlur={criarColuna}
                      placeholder="Nome da coluna"
                      className="w-full rounded-md border border-border px-2 py-1.5 text-sm outline-none"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setNovaColuna(true)}
                    className="w-full rounded-xl border border-dashed border-navy-300 py-3 text-sm text-navy-600 hover:bg-navy-50"
                  >
                    + Nova coluna
                  </button>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {modal && (
        <TaskModal
          taskId={modal.taskId}
          boardId={boardId}
          defaultColumnId={modal.columnId}
          teamMembers={teamMembers}
          columns={columns}
          currentUserId={currentUserId}
          podeAprovar={podeAprovar}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            recarregar();
          }}
        />
      )}
    </div>
  );
}
