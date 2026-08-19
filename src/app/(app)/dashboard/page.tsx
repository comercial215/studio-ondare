"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import TaskModal from "@/components/task-modal";
import { BarraPorPessoa, GraficoReceita, TabelaPorCliente } from "@/components/dashboard-charts";
import type { Column, DashboardMetrics, TeamMember } from "@/lib/types";

type Periodo = "semana" | "mes" | "personalizado";

function intervaloDoPeriodo(periodo: Periodo, personalizado: { inicio: string; fim: string }) {
  const hoje = new Date();

  if (periodo === "mes") {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  }

  if (periodo === "semana") {
    const diaSemana = hoje.getDay();
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - ((diaSemana + 6) % 7)); // segunda-feira
    const fim = new Date(inicio);
    fim.setDate(inicio.getDate() + 6);
    return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
  }

  return personalizado;
}

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function DashboardPage() {
  const supabase = createClient();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [personalizado, setPersonalizado] = useState({
    inicio: new Date().toISOString().slice(0, 10),
    fim: new Date().toISOString().slice(0, 10),
  });
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [receita, setReceita] = useState<{ mes: string; total: number }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [modal, setModal] = useState<{ taskId: string; boardId: string; columns: Column[] } | null>(null);

  const { inicio, fim } = useMemo(() => intervaloDoPeriodo(periodo, personalizado), [periodo, personalizado]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(false);
    const [metricasResp, receitaResp] = await Promise.all([
      supabase.rpc("get_dashboard_metrics", { p_data_inicio: inicio, p_data_fim: fim, p_workspace_id: null }),
      supabase.rpc("get_receita_historica", { p_data_inicio: inicio, p_data_fim: fim }),
    ]);

    if (metricasResp.error || !metricasResp.data) {
      setErro(true);
    } else {
      setMetrics(metricasResp.data as DashboardMetrics);
    }
    setReceita((receitaResp.data as { mes: string; total: number }[]) ?? []);
    setCarregando(false);
  }, [inicio, fim]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial + refetch ao trocar o período
    carregar();
  }, [carregar]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    supabase
      .from("team_members")
      .select("*")
      .order("nome")
      .then(({ data }) => setTeamMembers((data ?? []) as TeamMember[]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirTarefa(taskId: string, boardId: string) {
    const { data } = await supabase.from("columns").select("*").eq("board_id", boardId);
    setModal({ taskId, boardId, columns: (data ?? []) as Column[] });
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Visão geral</h1>

        <div className="flex flex-wrap items-center gap-2">
          {(["semana", "mes", "personalizado"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                periodo === p
                  ? "border-border-strong bg-accent text-white"
                  : "border-border text-foreground/80 hover:bg-white/8"
              }`}
            >
              {p === "semana" ? "Esta semana" : p === "mes" ? "Este mês" : "Personalizado"}
            </button>
          ))}
          {periodo === "personalizado" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={personalizado.inicio}
                onChange={(e) => setPersonalizado((s) => ({ ...s, inicio: e.target.value }))}
                className="rounded-lg border border-border bg-white/5 px-2 py-1 text-sm text-foreground [color-scheme:dark]"
              />
              <span className="text-muted">até</span>
              <input
                type="date"
                value={personalizado.fim}
                onChange={(e) => setPersonalizado((s) => ({ ...s, fim: e.target.value }))}
                className="rounded-lg border border-border bg-white/5 px-2 py-1 text-sm text-foreground [color-scheme:dark]"
              />
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-alert/30 bg-alert-bg p-4 text-sm text-alert">
          Não foi possível carregar as métricas.
          <button onClick={carregar} className="rounded-lg bg-alert px-3 py-1.5 text-white">
            Tentar de novo
          </button>
        </div>
      )}

      {carregando ? (
        <SkeletonDashboard />
      ) : (
        metrics && (
          <div className="flex flex-col gap-6">
            {/* Bloco 1 — Previsibilidade financeira */}
            <section className="glass rounded-2xl border-l-2 border-l-accent-ring p-6 text-foreground">
              <p className="text-sm text-muted">Receita Recorrente Mensal · agora</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">
                {metrics.mrr_total === null ? "—" : formatoMoeda.format(metrics.mrr_total)}
              </p>
            </section>

            {/* Ganhos — histórico de receita no período selecionado */}
            <Painel
              titulo="Ganhos"
              subtitulo={
                periodo === "semana"
                  ? "receita de contratos ativos nesta semana"
                  : periodo === "mes"
                  ? "receita de contratos ativos neste mês"
                  : "receita de contratos ativos no período"
              }
            >
              <GraficoReceita dados={receita} />
            </Painel>

            {/* Bloco 2 — Controle diário */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card
                titulo="Tarefas atrasadas"
                valor={metrics.atrasadas}
                rotulo="agora"
                destaque="alerta"
              />
              <Card titulo="Tarefas em aberto" valor={metrics.em_aberto} rotulo="agora" />
              <Card
                titulo="Tarefas concluídas"
                valor={metrics.concluidas_periodo}
                rotulo={periodo === "semana" ? "esta semana" : periodo === "mes" ? "este mês" : "no período"}
              />
              <Card
                titulo="Taxa de conclusão"
                valor={`${metrics.taxa_conclusao_prazo}%`}
                rotulo="no prazo, no período"
              />
            </section>

            {/* Bloco 3 — Previsibilidade & momento de contratar */}
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Painel titulo="Tarefas por pessoa" subtitulo="carga atual, por responsável">
                <BarraPorPessoa dados={metrics.por_responsavel} />
              </Painel>

              <Painel titulo="Volume por cliente" subtitulo="tarefas ativas, agora">
                <TabelaPorCliente dados={metrics.por_workspace} />
              </Painel>

              <Painel
                titulo="Aguardando aprovação"
                subtitulo={`${metrics.aguardando_aprovacao_detalhe.length} tarefa(s) paradas · agora`}
              >
                {metrics.aguardando_aprovacao_detalhe.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">Nada parado esperando cliente.</p>
                ) : (
                  <div className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
                    {metrics.aguardando_aprovacao_detalhe.map((t) => (
                      <button
                        key={t.task_id}
                        onClick={() => abrirTarefa(t.task_id, t.board_id)}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-white/8"
                      >
                        <span className="truncate">
                          <span className="font-medium text-foreground">{t.workspace_nome}</span>
                          <span className="text-muted"> · {t.titulo}</span>
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            t.dias_parado >= 3 ? "bg-alert-bg text-alert" : "bg-background text-muted"
                          }`}
                        >
                          {t.dias_parado}d
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Painel>
            </section>
          </div>
        )
      )}

      {modal && userId && (
        <TaskModal
          taskId={modal.taskId}
          boardId={modal.boardId}
          teamMembers={teamMembers}
          columns={modal.columns}
          currentUserId={userId}
          podeAprovar={false}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function Card({
  titulo,
  valor,
  rotulo,
  destaque,
}: {
  titulo: string;
  valor: number | string;
  rotulo: string;
  destaque?: "alerta";
}) {
  return (
    <div className={`glass rounded-2xl p-5 ${destaque === "alerta" ? "border-alert/30 bg-alert-bg" : ""}`}>
      <p className={`text-sm ${destaque === "alerta" ? "text-alert" : "text-muted"}`}>{titulo}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${destaque === "alerta" ? "text-alert" : "text-foreground"}`}>
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted">{rotulo}</p>
    </div>
  );
}

function Painel({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="mb-3 text-xs text-muted">{subtitulo}</p>
      {children}
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-28 animate-pulse rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
