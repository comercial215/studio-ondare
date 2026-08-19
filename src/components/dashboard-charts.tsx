"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const formatoMoedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function rotuloMes(mes: string) {
  const [ano, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${ano.slice(2)}`;
}

export function GraficoReceita({ dados }: { dados: { mes: string; total: number }[] }) {
  if (dados.length === 0) return <EstadoVazio texto="Sem dados de contrato no período." />;
  const formatados = dados.map((d) => ({ ...d, rotulo: rotuloMes(d.mes) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={formatados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="receitaGradiente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-ring)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent-ring)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="rotulo" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis
          tickFormatter={(v) => formatoMoedaCompacta.format(v)}
          tick={{ fontSize: 12, fill: "var(--muted)" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          formatter={(v) => formatoMoeda.format(Number(v))}
          cursor={{ stroke: "var(--accent-ring)", strokeWidth: 1 }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--glass-border)",
            background: "var(--glass-bg-strong, var(--surface))",
            color: "var(--foreground)",
            fontSize: 13,
          }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Area
          type="monotone"
          dataKey="total"
          name="Receita"
          stroke="var(--accent-ring)"
          strokeWidth={2}
          fill="url(#receitaGradiente)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarraPorPessoa({ dados }: { dados: { nome: string; total: number }[] }) {
  if (dados.length === 0) return <EstadoVazio texto="Sem tarefas ativas atribuídas no momento." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--foreground)", opacity: 0.06 }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--glass-border)",
            background: "var(--glass-bg-strong, var(--surface))",
            color: "var(--foreground)",
            fontSize: 13,
          }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Bar dataKey="total" name="Tarefas" fill="var(--accent-ring)" radius={[4, 4, 0, 0]} />
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
          <span className="w-28 shrink-0 truncate text-foreground/80">{d.workspace_nome}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-accent-ring"
              style={{ width: `${(d.total / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium tabular-nums text-foreground">{d.total}</span>
        </div>
      ))}
    </div>
  );
}

function EstadoVazio({ texto }: { texto: string }) {
  return <p className="py-8 text-center text-sm text-muted">{texto}</p>;
}
