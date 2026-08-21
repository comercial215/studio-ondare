"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { uploadImagem } from "@/lib/upload";
import { extrairCorDominante } from "@/lib/image";
import Avatar from "@/components/avatar";
import type { StatusContrato, Workspace } from "@/lib/types";

const DIACRITICOS = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g"
);

function slugify(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dataParaMes(data: string | null) {
  return data ? data.slice(0, 7) : "";
}

function mesParaData(mes: string) {
  return mes ? `${mes}-01` : null;
}

const CORES = ["#1e3a5f", "#2b4d78", "#b3791a", "#1f7a52", "#7a3b8f", "#c0442c", "#3d6396", "#5b6b85"];

interface ClienteVinculado {
  id: string; // id da linha em workspace_acessos
  profileId: string;
  email: string;
  workspace_id: string;
}

export default function WorkspacesPage() {
  const supabase = createClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [vinculados, setVinculados] = useState<ClienteVinculado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [statusContrato, setStatusContrato] = useState<StatusContrato>("ativo");
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 7));
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const [wsResp, vincResp] = await Promise.all([
      supabase.from("workspaces").select("*").order("nome"),
      supabase.from("workspace_acessos").select("id, workspace_id, profiles:profile_id(id, email)"),
    ]);
    setWorkspaces((wsResp.data ?? []) as Workspace[]);
    setVinculados(
      (vincResp.data ?? []).map((v) => {
        const perfil = v.profiles as unknown as { id: string; email: string } | null;
        return { id: v.id, profileId: perfil?.id ?? "", email: perfil?.email ?? "—", workspace_id: v.workspace_id };
      })
    );
    setCarregando(false);
  }

  async function vincularCliente(ws: Workspace, email: string): Promise<string | null> {
    const { data: perfil, error: erroBusca } = await supabase
      .from("profiles")
      .select("id, email, role")
      .ilike("email", email.trim())
      .maybeSingle();

    if (erroBusca || !perfil) {
      return "Não achei nenhum login com esse e-mail. Crie primeiro em Authentication → Users, no painel do Supabase.";
    }

    if (perfil.role !== "admin" && perfil.role !== "time") {
      await supabase.from("profiles").update({ role: "cliente" }).eq("id", perfil.id);
    }

    const { data: inserido, error } = await supabase
      .from("workspace_acessos")
      .insert({ profile_id: perfil.id, workspace_id: ws.id })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") return "Esse e-mail já tem acesso a esse cliente.";
      if (error.code === "42P01") {
        return "O banco recusou salvar isso (falta rodar a migration_06_multi_acesso.sql no SQL Editor do Supabase).";
      }
      return error.message;
    }
    if (!inserido) {
      return "O banco recusou salvar isso (provavelmente falta rodar alguma migração pendente no SQL Editor do Supabase).";
    }

    setVinculados((prev) => [...prev, { id: inserido.id, profileId: perfil.id, email: perfil.email, workspace_id: ws.id }]);
    return null;
  }

  async function desvincularCliente(vinculoId: string) {
    if (!confirm("Remover o acesso desse login a esse cliente? A pessoa não vai mais conseguir entrar nesse quadro.")) return;
    const { error } = await supabase.from("workspace_acessos").delete().eq("id", vinculoId);
    if (error) {
      alert(`Não foi possível remover: ${error.message}`);
      return;
    }
    setVinculados((prev) => prev.filter((v) => v.id !== vinculoId));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial da lista
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return;

    const cor = CORES[workspaces.length % CORES.length];
    const { error } = await supabase.from("workspaces").insert({
      nome: nome.trim(),
      slug: slugify(nome),
      cor,
      valor_contrato_mensal: valor ? Number(valor) : null,
      status_contrato: statusContrato,
      contrato_inicio: mesParaData(inicio),
    });

    if (error) {
      setErro("Não foi possível criar — talvez já exista um cliente com esse nome.");
      return;
    }

    setNome("");
    setValor("");
    setStatusContrato("ativo");
    setInicio(new Date().toISOString().slice(0, 7));
    carregar();
  }

  async function atualizar(ws: Workspace, campo: keyof Workspace, valor: string | number | null) {
    const { error } = await supabase.from("workspaces").update({ [campo]: valor }).eq("id", ws.id);
    if (error) {
      alert(`Não foi possível salvar: ${error.message}`);
      return;
    }
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, [campo]: valor } : w)));
  }

  const [enviandoLogo, setEnviandoLogo] = useState<string | null>(null);

  async function trocarLogo(ws: Workspace, arquivo: File) {
    setEnviandoLogo(ws.id);
    try {
      const [url, corDominante] = await Promise.all([
        uploadImagem(supabase, "logos", arquivo),
        extrairCorDominante(arquivo),
      ]);
      const payload: Partial<Workspace> = { logo_url: url };
      if (corDominante) payload.cor = corDominante;
      await supabase.from("workspaces").update(payload).eq("id", ws.id);
      setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, ...payload } : w)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      alert(`Não foi possível enviar a logo: ${msg}`);
    } finally {
      setEnviandoLogo(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Clientes</h1>
      <p className="mb-6 text-sm text-muted">
        Cada cliente novo já nasce com quadro e as 6 colunas padrão. Ao enviar a logo, a cor do ambiente é sugerida automaticamente
        a partir da imagem (dá pra trocar depois na bolinha de cor).
      </p>

      <form onSubmit={criar} className="glass mb-6 flex flex-wrap items-end gap-2 rounded-xl p-4">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-foreground/80">Nome do cliente</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-foreground/80">Valor mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="opcional"
            className="input"
          />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-foreground/80">Início do contrato</label>
          <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input [color-scheme:dark]" />
        </div>
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-foreground/80">Status do contrato</label>
          <select value={statusContrato} onChange={(e) => setStatusContrato(e.target.value as StatusContrato)} className="input">
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg border border-border-strong bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Criar cliente
        </button>
      </form>
      {erro && <p className="mb-4 text-sm text-alert">{erro}</p>}

      <div className="glass overflow-x-auto rounded-xl">
        {carregando ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : (
          <table className="w-full table-fixed text-sm" style={{ minWidth: 640 }}>
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[16%]" />
              <col className="w-[28%]" />
              <col className="w-[13%]" />
              <col className="w-[9%]" />
            </colgroup>
            <thead className="bg-black/15 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Valor mensal</th>
                <th className="px-4 py-2 font-medium">Contrato</th>
                <th className="px-4 py-2 font-medium" />
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <LinhaWorkspace
                  key={w.id}
                  ws={w}
                  enviandoLogo={enviandoLogo === w.id}
                  vinculados={vinculados.filter((v) => v.workspace_id === w.id)}
                  onAtualizar={atualizar}
                  onTrocarLogo={trocarLogo}
                  onVincular={vincularCliente}
                  onDesvincular={desvincularCliente}
                />
              ))}
              {workspaces.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    Nenhum cliente cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: var(--foreground);
          outline: none;
        }
        .input::placeholder {
          color: var(--muted);
        }
        .input:focus {
          border-color: var(--accent-ring);
        }
      `}</style>
    </div>
  );
}

function LinhaWorkspace({
  ws,
  enviandoLogo,
  vinculados,
  onAtualizar,
  onTrocarLogo,
  onVincular,
  onDesvincular,
}: {
  ws: Workspace;
  enviandoLogo: boolean;
  vinculados: ClienteVinculado[];
  onAtualizar: (ws: Workspace, campo: keyof Workspace, valor: string | number | null) => void;
  onTrocarLogo: (ws: Workspace, arquivo: File) => void;
  onVincular: (ws: Workspace, email: string) => Promise<string | null>;
  onDesvincular: (profileId: string) => void;
}) {
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputCor = useRef<HTMLInputElement>(null);

  return (
    <tr className="border-t border-border">
      <td className="min-w-0 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="relative shrink-0">
            <Link href={`/w/${ws.slug}/board`} title={`Abrir o quadro de ${ws.nome}`}>
              <Avatar nome={ws.nome} url={ws.logo_url} tamanho={30} />
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                inputLogo.current?.click();
              }}
              className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-border bg-surface text-[8px] text-foreground/70 hover:text-foreground"
              title="Trocar logo"
            >
              ✎
            </button>
            {enviandoLogo && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[9px] text-white">
                ...
              </span>
            )}
          </div>
          <input
            ref={inputLogo}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onTrocarLogo(ws, e.target.files[0])}
          />
          <button
            type="button"
            onClick={() => inputCor.current?.click()}
            className="relative inline-flex h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-white/20"
            style={{ background: ws.cor }}
            title="Trocar cor do cliente"
          />
          <input
            ref={inputCor}
            type="color"
            value={ws.cor}
            onChange={(e) => onAtualizar(ws, "cor", e.target.value)}
            className="h-0 w-0 opacity-0"
          />
          <NomeEditavel ws={ws} onAtualizar={onAtualizar} />
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          step="0.01"
          defaultValue={ws.valor_contrato_mensal ?? ""}
          onBlur={(e) => onAtualizar(ws, "valor_contrato_mensal", e.target.value ? Number(e.target.value) : null)}
          className="w-28 rounded px-1.5 py-1 text-foreground outline-none hover:bg-white/8 focus:bg-white/8"
          placeholder="—"
        />
      </td>
      <td className="min-w-0 px-4 py-2">
        <div className="flex min-w-0 flex-col gap-1 text-xs">
          <select
            value={ws.status_contrato}
            onChange={(e) => onAtualizar(ws, "status_contrato", e.target.value)}
            className="w-fit rounded bg-transparent py-0.5 text-foreground outline-none hover:bg-white/8"
          >
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="encerrado">Encerrado</option>
          </select>
          <label className="flex min-w-0 items-center gap-1 text-muted">
            desde
            <input
              type="month"
              value={dataParaMes(ws.contrato_inicio)}
              onChange={(e) => onAtualizar(ws, "contrato_inicio", mesParaData(e.target.value))}
              className="w-[6.5rem] min-w-0 rounded px-1 py-0.5 text-foreground outline-none [color-scheme:dark] hover:bg-white/8 focus:bg-white/8"
            />
          </label>
          {ws.status_contrato !== "ativo" && (
            <label className="flex min-w-0 items-center gap-1 text-muted">
              até
              <input
                type="month"
                value={dataParaMes(ws.contrato_fim)}
                onChange={(e) => onAtualizar(ws, "contrato_fim", mesParaData(e.target.value))}
                className="w-[6.5rem] min-w-0 rounded px-1 py-0.5 text-foreground outline-none [color-scheme:dark] hover:bg-white/8 focus:bg-white/8"
              />
            </label>
          )}
        </div>
      </td>
      <td className="px-4 py-2">
        <AcessoCliente ws={ws} vinculados={vinculados} onVincular={onVincular} onDesvincular={onDesvincular} />
      </td>
      <td className="px-4 py-2 text-right">
        <CopiarLink slug={ws.slug} />
      </td>
    </tr>
  );
}

function CopiarLink({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const link = `${window.location.origin}/w/${slug}/board`;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground/80 hover:bg-white/8"
      title="Copiar link do quadro desse cliente"
    >
      {copiado ? "Copiado!" : "Copiar link"}
    </button>
  );
}

function AcessoCliente({
  ws,
  vinculados,
  onVincular,
  onDesvincular,
}: {
  ws: Workspace;
  vinculados: ClienteVinculado[];
  onVincular: (ws: Workspace, email: string) => Promise<string | null>;
  onDesvincular: (profileId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function vincular(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setEnviando(true);
    setErro(null);
    const msgErro = await onVincular(ws, email.trim());
    setEnviando(false);
    if (msgErro) {
      setErro(msgErro);
      return;
    }
    setEmail("");
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-foreground/80 hover:bg-white/8"
        title="Acesso do cliente ao quadro"
      >
        Acesso{vinculados.length > 0 ? ` (${vinculados.length})` : ""}
      </button>

      {aberto && (
        <div className="glass-strong absolute right-0 z-20 mt-2 w-64 rounded-xl p-3" onMouseLeave={() => setAberto(false)}>
          <p className="mb-2 text-xs font-medium text-foreground/80">Quem acessa esse quadro</p>
          {vinculados.length === 0 && <p className="mb-2 text-xs text-muted">Ninguém vinculado ainda.</p>}
          <div className="mb-2 flex flex-col gap-1">
            {vinculados.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-1.5 text-xs">
                <span className="truncate text-foreground/80" title={v.email}>
                  {v.email}
                </span>
                <button onClick={() => onDesvincular(v.id)} className="shrink-0 text-muted hover:text-alert" title="Remover acesso">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={vincular} className="flex items-center gap-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e-mail já cadastrado"
              className="w-full rounded border border-border bg-white/5 px-1.5 py-1 text-xs text-foreground outline-none placeholder:text-muted focus:border-accent-ring"
            />
            <button type="submit" disabled={enviando} className="shrink-0 rounded bg-accent px-2 py-1 text-xs text-white hover:bg-accent-hover disabled:opacity-60">
              {enviando ? "..." : "+"}
            </button>
          </form>
          {erro && <p className="mt-1 text-[11px] text-alert">{erro}</p>}
        </div>
      )}
    </div>
  );
}

function NomeEditavel({
  ws,
  onAtualizar,
}: {
  ws: Workspace;
  onAtualizar: (ws: Workspace, campo: keyof Workspace, valor: string | number | null) => void;
}) {
  const [valor, setValor] = useState(ws.nome);

  function salvar() {
    const limpo = valor.trim();
    if (!limpo) {
      setValor(ws.nome);
      return;
    }
    if (limpo !== ws.nome) onAtualizar(ws, "nome", limpo);
  }

  return (
    <input
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="min-w-0 flex-1 rounded bg-transparent px-1.5 py-1 text-foreground outline-none hover:bg-white/8 focus:bg-white/8"
    />
  );
}
