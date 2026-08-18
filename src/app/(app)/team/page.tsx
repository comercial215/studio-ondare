"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamMember } from "@/lib/types";

export default function TeamPage() {
  const supabase = createClient();
  const [membros, setMembros] = useState<TeamMember[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);

  async function carregar() {
    const { data } = await supabase.from("team_members").select("*").order("nome");
    setMembros((data ?? []) as TeamMember[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) return;
    await supabase.from("team_members").insert({ nome: nome.trim(), email: email.trim(), cargo: cargo.trim() || null });
    setNome("");
    setEmail("");
    setCargo("");
    carregar();
  }

  async function salvarEdicao(membro: TeamMember, campo: keyof TeamMember, valor: string) {
    await supabase.from("team_members").update({ [campo]: valor || null }).eq("id", membro.id);
    setMembros((prev) => prev.map((m) => (m.id === membro.id ? { ...m, [campo]: valor } : m)));
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-navy-900">Time</h1>
      <p className="mb-6 text-sm text-muted">Membros disponíveis no seletor de "Responsável" das tarefas.</p>

      <form onSubmit={adicionar} className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-4">
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-navy-800">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-navy-800">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="mb-1 block text-xs font-medium text-navy-800">Cargo</label>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} className="input" />
        </div>
        <button type="submit" className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
          Adicionar
        </button>
      </form>

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
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Cargo</th>
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <EditableCell membro={m} campo="nome" onSalvar={salvarEdicao} />
                  <EditableCell membro={m} campo="email" onSalvar={salvarEdicao} />
                  <EditableCell membro={m} campo="cargo" onSalvar={salvarEdicao} />
                </tr>
              ))}
              {membros.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted">
                    Nenhum membro cadastrado ainda.
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

function EditableCell({
  membro,
  campo,
  onSalvar,
}: {
  membro: TeamMember;
  campo: "nome" | "email" | "cargo";
  onSalvar: (m: TeamMember, campo: keyof TeamMember, valor: string) => void;
}) {
  const [valor, setValor] = useState(membro[campo] ?? "");
  return (
    <td className="px-4 py-1.5">
      <input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => valor !== (membro[campo] ?? "") && onSalvar(membro, campo, valor)}
        className="w-full rounded px-1.5 py-1 outline-none hover:bg-background focus:bg-background"
      />
    </td>
  );
}
