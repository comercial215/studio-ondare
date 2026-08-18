"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BarraPorPessoa({ dados }: { dados: { nome: string; total: number }[] }) {
  if (dados.length === 0) return <EstadoVazio texto="Sem tarefas ativas atribuídas no momento." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--navy-900)", opacity: 0.05 }}
          contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
        />
        <Bar dataKey="total" name="Tarefas" fill="var(--navy-600)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TabelaPorCliente({ dados }: { dados: { workspace_nome: string; total: number }[] }) {
  if (dados.length === 0) return <EstadoVazio texto="Sem tarefas ativas no momento." />;
  const max = Math.max(...dados.map((d) => d.total), 1);
  return (
    <div className="flex flex-col gap-2">
      {dados.map((d) => (
        <div key={d.workspace_nome} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-navy-800">{d.workspace_nome}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-navy-600"
              style={{ width: `${(d.total / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium text-navy-900">{d.total}</span>
        </div>
      ))}
    </div>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-sm text-muted">{texto}</p>;
}
