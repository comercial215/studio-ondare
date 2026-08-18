"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CanalPlataforma,
  Column,
  FormatoConteudo,
  StatusAprovacao,
  Task,
  TaskComment,
  TeamMember,
} from "@/lib/types";

const FORMATOS: FormatoConteudo[] = ["Carrossel", "Video_Reels", "Foto", "Stories", "Impressos"];
const CANAIS: CanalPlataforma[] = ["Instagram", "Stories", "LinkedIn", "Trafego", "Presencial"];
const STATUS_LABEL: Record<StatusAprovacao, string> = {
  em_analise: "Em análise",
  aprovado: "Aprovado",
  ajuste_solicitado: "Solicitar ajustes",
};

interface TaskModalProps {
  taskId: string | null;
  boardId: string;
  defaultColumnId?: string;
  teamMembers: TeamMember[];
  columns: Column[];
  currentUserId: string;
  podeAprovar: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function TaskModal({
  taskId,
  boardId,
  defaultColumnId,
  teamMembers,
  columns,
  currentUserId,
  podeAprovar,
  onClose,
  onSaved,
}: TaskModalProps) {
  const supabase = createClient();
  const [carregando, setCarregando] = useState(!!taskId);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [prazo, setPrazo] = useState("");
  const [statusAprovacao, setStatusAprovacao] = useState<StatusAprovacao>("em_analise");
  const [statusAprovacaoOriginal, setStatusAprovacaoOriginal] = useState<StatusAprovacao>("em_analise");
  const [formato, setFormato] = useState<FormatoConteudo | "">("");
  const [canal, setCanal] = useState<CanalPlataforma | "">("");
  const [linkMaterial, setLinkMaterial] = useState("");

  const [comentarios, setComentarios] = useState<(TaskComment & { autor_nome: string })[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  useEffect(() => {
    if (!taskId) return;

    (async () => {
      const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (task) {
        const t = task as Task;
        setTitulo(t.titulo);
        setDescricao(t.descricao ?? "");
        setResponsavelId(t.responsavel_id ?? "");
        setPrazo(t.prazo ?? "");
        setStatusAprovacao(t.status_aprovacao);
        setStatusAprovacaoOriginal(t.status_aprovacao);
        setFormato(t.formato_conteudo ?? "");
        setCanal(t.canal_plataforma ?? "");
        setLinkMaterial(t.link_material ?? "");
      }

      const { data: comments } = await supabase
        .from("task_comments")
        .select("*, profiles:autor_id(nome, email)")
        .eq("task_id", taskId)
        .order("criado_em", { ascending: true });

      setComentarios(
        (comments ?? []).map((c) => ({
          ...c,
          autor_nome: (c.profiles as { nome: string | null; email: string } | null)?.nome ??
            (c.profiles as { nome: string | null; email: string } | null)?.email ??
            "—",
        }))
      );

      setCarregando(false);
    })();
  }, [taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  function colunaPorNome(nomeParcial: string) {
    return columns.find((c) => c.nome.toLowerCase().includes(nomeParcial.toLowerCase()));
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const mudouAprovacao = taskId && statusAprovacao !== statusAprovacaoOriginal;

    if (mudouAprovacao && statusAprovacao === "ajuste_solicitado" && !novoComentario.trim()) {
      setErro("Pedir ajuste exige um comentário explicando o que precisa mudar.");
      return;
    }

    setSalvando(true);

    const payload = {
      titulo,
      descricao: descricao || null,
      responsavel_id: responsavelId || null,
      prazo: prazo || null,
      status_aprovacao: statusAprovacao,
      formato_conteudo: formato || null,
      canal_plataforma: canal || null,
      link_material: linkMaterial || null,
    };

    let erroSalvar = null;
    let idTarefa = taskId;

    if (taskId) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
      erroSalvar = error;
    } else {
      const { data: existentes } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: false })
        .eq("column_id", defaultColumnId);

      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...payload, board_id: boardId, column_id: defaultColumnId, posicao: existentes?.length ?? 0 })
        .select("id")
        .single();

      erroSalvar = error;
      idTarefa = data?.id ?? null;
    }

    if (erroSalvar) {
      setErro("Não foi possível salvar. Tente de novo.");
      setSalvando(false);
      return;
    }

    if (mudouAprovacao && idTarefa) {
      const destino =
        statusAprovacao === "aprovado" ? colunaPorNome("Pronto") : colunaPorNome("Ajustes Solicitados");
      if (destino) {
        await supabase.from("tasks").update({ column_id: destino.id }).eq("id", idTarefa);
      }
    }

    if (novoComentario.trim() && idTarefa) {
      await supabase
        .from("task_comments")
        .insert({ task_id: idTarefa, autor_id: currentUserId, texto: novoComentario.trim() });
    }

    setSalvando(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">{taskId ? "Editar tarefa" : "Nova tarefa"}</h2>
          <button onClick={onClose} className="text-muted hover:text-navy-900">
            ✕
          </button>
        </div>

        {carregando ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-background" />
            ))}
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="flex flex-col gap-3">
            <Field label="Título">
              <input
                required
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsável">
                <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className="input">
                  <option value="">—</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prazo">
                <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="input" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Formato de conteúdo">
                <select value={formato} onChange={(e) => setFormato(e.target.value as FormatoConteudo)} className="input">
                  <option value="">—</option>
                  {FORMATOS.map((f) => (
                    <option key={f} value={f}>
                      {f.replace("_", "/")}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Canal/Plataforma">
                <select value={canal} onChange={(e) => setCanal(e.target.value as CanalPlataforma)} className="input">
                  <option value="">—</option>
                  {CANAIS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Link do material">
              <input
                type="url"
                value={linkMaterial}
                onChange={(e) => setLinkMaterial(e.target.value)}
                placeholder="https://…"
                className="input"
              />
            </Field>

            <Field label="Descrição / observações">
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="input resize-none"
              />
            </Field>

            <Field label="Status de aprovação">
              <div className="flex gap-2">
                {(Object.keys(STATUS_LABEL) as StatusAprovacao[]).map((s) => (
                  <button
                    type="button"
                    key={s}
                    disabled={!podeAprovar && !taskId}
                    onClick={() => setStatusAprovacao(s)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                      statusAprovacao === s
                        ? s === "aprovado"
                          ? "border-success bg-success/10 text-success"
                          : s === "ajuste_solicitado"
                          ? "border-alert bg-alert-bg text-alert"
                          : "border-navy-500 bg-navy-500/10 text-navy-700"
                        : "border-border text-muted hover:border-navy-300"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </Field>

            {statusAprovacao === "ajuste_solicitado" && statusAprovacao !== statusAprovacaoOriginal && (
              <p className="text-xs text-muted">Pedir ajuste move o card para &quot;Ajustes Solicitados&quot; e exige um comentário abaixo.</p>
            )}

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-2 text-sm font-medium text-navy-800">Comentários</p>
              <div className="mb-2 flex max-h-40 flex-col gap-2 overflow-y-auto">
                {comentarios.length === 0 && <p className="text-xs text-muted">Nenhum comentário ainda.</p>}
                {comentarios.map((c) => (
                  <div key={c.id} className="rounded-lg bg-background p-2 text-sm">
                    <p className="text-xs font-medium text-navy-700">{c.autor_nome}</p>
                    <p className="text-navy-900">{c.texto}</p>
                  </div>
                ))}
              </div>
              <textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                placeholder="Escrever um comentário…"
                rows={2}
                className="input resize-none"
              />
            </div>

            {erro && <p className="text-sm text-alert">{erro}</p>}

            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-background">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
        }
        .input:focus {
          border-color: var(--navy-500);
          box-shadow: 0 0 0 2px rgba(61, 99, 150, 0.15);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-navy-800">{label}</span>
      {children}
    </label>
  );
}
