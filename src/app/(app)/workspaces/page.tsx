"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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

const CORES = ["#1e3a5f", "#2b4d78", "#b3791a", "#1f7a52", "#7a3b8f", "#c0442c", "#3d6396", "#5b6b85"];

export default function WorkspacesPage() {
  const supabase = createClient();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [statusContrato, setStatusContrato] = useState<StatusContrato>("ativo");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const { data } = await supabase.from("workspaces").select("*").order("nome");
    setWorkspaces((data ?? []) as Workspace[]);
    setCarregando(false);
  }

  useEffect(() => {
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
    });

    if (error) {
      setErro("Não foi possível criar — talvez já exista um cliente com esse nome.");
      return;
    }

    setNome("");
    setValor("");
    setStatusContrato("ativo");
    carregar();
  }

  async function atualizar(ws: Workspace, campo: keyof Workspace, valor: string | number | null) {
    await supabase.from("workspaces").update({ [campo]: valor }).eq("id", ws.id);
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, [campo]: valor } : w)));
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Clientes</h1>
      <p className="mb-6 text-sm text-muted">
        Cada cliente novo já nasce com quadro e as 6 colunas padrão. O MRR soma o valor de contrato dos clientes com status "ativo".
      </p>

      <form onSubmit={criar} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-4">
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-navy-800">Nome do cliente</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-navy-800">Valor mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="opcional"
            className="input"
          />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-navy-800">Status do contrato</label>
          <select value={statusContrato} onChange={(e) => setStatusContrato(e.target.value as StatusContrato)} className="input">
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
          Criar cliente
        </button>
      </form>
      {erro && <p className="mb-4 text-sm text-alert">{erro}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {carregando ? (
          <div className="space-y-2 p-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-background" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy-900/[0.03] text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Valor mensal</th>
                <th className="px-4 py-2 font-medium">Contrato</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr key={w.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: w.cor }} />
                    {w.nome}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={w.valor_contrato_mensal ?? ""}
                      onBlur={(e) => atualizar(w, "valor_contrato_mensal", e.target.value ? Number(e.target.value) : null)}
                      className="w-28 rounded px-1.5 py-1 outline-none hover:bg-background focus:bg-background"
                      placeholder="—"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={w.status_contrato}
                      onChange={(e) => atualizar(w, "status_contrato", e.target.value)}
                      className="rounded px-1.5 py-1 outline-none hover:bg-background"
                    >
                      <option value="ativo">Ativo</option>
                      <option value="pausado">Pausado</option>
                      <option value="encerrado">Encerrado</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/w/${w.slug}/board`} className="text-navy-600 hover:underline">
                      Ver quadro →
                    </Link>
                  </td>
                </tr>
              ))}
              {workspaces.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted">
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
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: var(--navy-500);
        }
      `}</style>
    </div>
  );
}
