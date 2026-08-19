"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadImagem } from "@/lib/upload";
import Avatar from "@/components/avatar";
import type { TeamMember } from "@/lib/types";

export default function TeamPage() {
  const supabase = createClient();
  const [membros, setMembros] = useState<TeamMember[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState<string | null>(null);

  async function carregar() {
    const { data } = await supabase.from("team_members").select("*").order("nome");
    setMembros((data ?? []) as TeamMember[]);
    setCarregando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca inicial da lista
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

  async function trocarFoto(membro: TeamMember, arquivo: File) {
    setEnviandoFoto(membro.id);
    try {
      const url = await uploadImagem(supabase, "avatars", arquivo);
      await supabase.from("team_members").update({ avatar_url: url }).eq("id", membro.id);
      setMembros((prev) => prev.map((m) => (m.id === membro.id ? { ...m, avatar_url: url } : m)));
    } catch {
      alert("Não foi possível enviar a foto. Tente uma imagem menor (JPG ou PNG).");
    } finally {
      setEnviandoFoto(null);
    }
  }

  async function remover(membro: TeamMember) {
    if (!confirm(`Remover ${membro.nome} do time? As tarefas já atribuídas a essa pessoa continuam existindo, só ficam sem responsável.`))
      return;
    await supabase.from("team_members").delete().eq("id", membro.id);
    setMembros((prev) => prev.filter((m) => m.id !== membro.id));
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Time</h1>
      <p className="mb-6 text-sm text-muted">Membros disponíveis no seletor de &quot;Responsável&quot; das tarefas.</p>

      <form onSubmit={adicionar} className="glass mb-6 flex flex-wrap items-end gap-2 rounded-xl p-4">
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-xs font-medium text-foreground/80">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" required />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-foreground/80">E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="mb-1 block text-xs font-medium text-foreground/80">Cargo</label>
          <input value={cargo} onChange={(e) => setCargo(e.target.value)} className="input" />
        </div>
        <button type="submit" className="rounded-lg border border-border-strong bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Adicionar
        </button>
      </form>

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
                <th className="px-4 py-2 font-medium" />
                <th className="px-4 py-2 font-medium">Nome</th>
                <th className="px-4 py-2 font-medium">E-mail</th>
                <th className="px-4 py-2 font-medium">Cargo</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {membros.map((m) => (
                <FilaMembro
                  key={m.id}
                  membro={m}
                  enviando={enviandoFoto === m.id}
                  onSalvar={salvarEdicao}
                  onTrocarFoto={trocarFoto}
                  onRemover={remover}
                />
              ))}
              {membros.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
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

function FilaMembro({
  membro,
  enviando,
  onSalvar,
  onTrocarFoto,
  onRemover,
}: {
  membro: TeamMember;
  enviando: boolean;
  onSalvar: (m: TeamMember, campo: keyof TeamMember, valor: string) => void;
  onTrocarFoto: (m: TeamMember, arquivo: File) => void;
  onRemover: (m: TeamMember) => void;
}) {
  const inputFoto = useRef<HTMLInputElement>(null);

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-1.5">
        <button
          type="button"
          onClick={() => inputFoto.current?.click()}
          className="relative block"
          title="Trocar foto"
        >
          <Avatar nome={membro.nome} url={membro.avatar_url} tamanho={32} />
          {enviando && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-[9px] text-white">
              ...
            </span>
          )}
        </button>
        <input
          ref={inputFoto}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onTrocarFoto(membro, e.target.files[0])}
        />
      </td>
      <EditableCell membro={membro} campo="nome" onSalvar={onSalvar} />
      <EditableCell membro={membro} campo="email" onSalvar={onSalvar} />
      <EditableCell membro={membro} campo="cargo" onSalvar={onSalvar} />
      <td className="px-4 py-1.5 text-right">
        <button
          onClick={() => onRemover(membro)}
          className="rounded px-2 py-1 text-xs text-muted hover:bg-alert-bg hover:text-alert"
        >
          Remover
        </button>
      </td>
    </tr>
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
        className="w-full rounded px-1.5 py-1 text-foreground outline-none hover:bg-white/8 focus:bg-white/8"
      />
    </td>
  );
}
