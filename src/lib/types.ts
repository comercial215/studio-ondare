export type UserRole = "admin" | "time" | "cliente";
export type StatusAprovacao = "em_analise" | "aprovado" | "ajuste_solicitado";
export type StatusContrato = "ativo" | "pausado" | "encerrado";
export type FormatoConteudo = "Carrossel" | "Video_Reels" | "Foto" | "Stories" | "Impressos";
export type CanalPlataforma = "Instagram" | "Stories" | "LinkedIn" | "Trafego" | "Presencial";

export interface Profile {
  id: string;
  email: string;
  nome: string | null;
  avatar_url: string | null;
  role: UserRole;
  workspace_id: string | null;
}

export interface Workspace {
  id: string;
  nome: string;
  slug: string;
  status: "ativo" | "inativo";
  cor: string;
  valor_contrato_mensal: number | null;
  status_contrato: StatusContrato;
  criado_em: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  nome: string;
}

export interface Column {
  id: string;
  board_id: string;
  nome: string;
  emoji: string | null;
  ordem: number;
  is_final: boolean;
}

export interface TeamMember {
  id: string;
  profile_id: string | null;
  nome: string;
  email: string;
  cargo: string | null;
}

export interface Task {
  id: string;
  board_id: string;
  column_id: string;
  posicao: number;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  status_aprovacao: StatusAprovacao;
  formato_conteudo: FormatoConteudo | null;
  canal_plataforma: CanalPlataforma | null;
  link_material: string | null;
  data_conclusao_real: string | null;
  entrou_na_coluna_em: string;
  criado_em: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  autor_id: string;
  texto: string;
  criado_em: string;
}

export interface DashboardMetrics {
  atrasadas: number;
  em_aberto: number;
  concluidas_periodo: number;
  taxa_conclusao_prazo: number;
  aguardando_aprovacao_por_workspace: { workspace_id: string; workspace_nome: string; total: number }[];
  aguardando_aprovacao_detalhe: {
    task_id: string;
    board_id: string;
    titulo: string;
    workspace_nome: string;
    dias_parado: number;
  }[];
  mrr_total: number | null;
  por_responsavel: { nome: string; total: number }[];
  por_workspace: { workspace_nome: string; total: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
