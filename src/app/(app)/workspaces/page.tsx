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

export default function WorkspacesPage() {
  const supabase = createClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [statusContrato, setStatusContrato] = useState<StatusContrato>("ativo");
  const [inicio, setInicio] = useState(() => new Date().toISOString().slice(0, 7));
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const { data } = await supabase.from("workspaces").select("*").order("nome");
    setWorkspaces((data ?? []) as Workspace[]);
    setCarregando(false);
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
    await supabase.from("workspaces").update({ [campo]: valor }).eq("id", ws.id);
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

      <div className="glass overflow-hidden rounded-xl">
        {carregando ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-black/15 text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Valor mensal</th>
                <th className="px-4 py-2 font-medium">Início</th>
                <th className="px-4 py-2 font-medium">Contrato</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <LinhaWorkspace
                  key={w.id}
                  ws={w}
                  enviandoLogo={enviandoLogo === w.id}
                  onAtualizar={atualizar}
                  onTrocarLogo={trocarLogo}
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
  onAtualizar,
  onTrocarLogo,
}: {
  ws: Workspace;
  enviandoLogo: boolean;
  onAtualizar: (ws: Workspace, campo: keyof Workspace, valor: string | number | null) => void;
  onTrocarLogo: (ws: Workspace, arquivo: File) => void;
}) {
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputCor = useRef<HTMLInputElement>(null);

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => inputLogo.current?.click()} className="relative shrink-0" title="Trocar logo">
            <Avatar nome={ws.nome} url={ws.logo_url} tamanho={28} />
            {enviandoLogo && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[9px] text-white">
                ...
              </span>
            )}
          </button>
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
          <span className="text-foreground">{ws.nome}</span>
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
      <td className="px-4 py-2">
        <input
          type="month"
          value={dataParaMes(ws.contrato_inicio)}
          onChange={(e) => onAtualizar(ws, "contrato_inicio", mesParaData(e.target.value))}
          className="rounded px-1.5 py-1 text-foreground outline-none [color-scheme:dark] hover:bg-white/8 focus:bg-white/8"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <select
            value={ws.status_contrato}
            onChange={(e) => onAtualizar(ws, "status_contrato", e.target.value)}
            className="rounded bg-transparent px-1.5 py-1 text-foreground outline-none hover:bg-white/8"
          >
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="encerrado">Encerrado</option>
          </select>
          {ws.status_contrato !== "ativo" && (
            <label className="flex items-center gap-1 text-xs text-muted">
              até
              <input
                type="month"
                value={dataParaMes(ws.contrato_fim)}
                onChange={(e) => onAtualizar(ws, "contrato_fim", mesParaData(e.target.value))}
                className="rounded px-1 py-0.5 text-foreground outline-none [color-scheme:dark] hover:bg-white/8 focus:bg-white/8"
              />
            </label>
          )}
        </div>
      </td>
      <td className="px-4 py-2 text-right">
        <Link href={`/w/${ws.slug}/board`} className="text-accent-ring hover:underline">
          Ver quadro →
        </Link>
      </td>
    </tr>
  );
}
