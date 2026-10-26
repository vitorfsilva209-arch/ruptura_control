export interface Setor {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface Horario {
  id: string;
  setor_id: string;
  horario: string;
  ativo: boolean;
  ordem: number;
}

export interface Produto {
  id: string;
  codigo: string;
  nome: string;
  setor_id: string;
  vendas_qtd: number;
  ranking: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Lancamento {
  id: string;
  data: string; // YYYY-MM-DD
  setor_id: string;
  produto_id: string;
  horario_id: string;
  valor: number; // 1 = tem produto, 0 = ruptura
  usuario_id: string;
  usuario_nome: string;
  timestamp: string;
}

export type PerfilUsuario = 'administrador' | 'gestor' | 'operador';

export interface Usuario {
  id: string;
  nome: string;
  usuario: string;
  perfil: PerfilUsuario;
  setores_permitidos: string[];
  ativo: boolean;
  criado_em: string;
  ultimo_acesso: string | null;
}

export interface HistoricoAcesso {
  id: string;
  usuario_id: string | null;
  usuario_nome: string;
  acao: 'login_sucesso' | 'login_falha' | 'bloqueio_temporario' | 'logout' | 'troca_senha';
  status: 'sucesso' | 'falha' | 'aviso';
  timestamp: string;
  detalhe: string;
  ip?: string;
}

export interface IndicadoresData {
  periodo: { inicio?: string; fim?: string };
  totalAvaliados: number;
  totalRupturas: number;
  indiceGeral: number;
  piorSetor: { setor_id: string; nome: string; total: number; rupturas: number; indice: number } | null;
  horarioCritico: { horario: string; setor_id: string; total: number; rupturas: number; indice: number } | null;
  produtoMaisFaltante: {
    produto_id: string;
    codigo: string;
    nome: string;
    setor_id: string;
    ranking_vendas: number;
    vendas_qtd: number;
    total: number;
    rupturas: number;
    indice: number;
  } | null;
  setoresRanking: Array<{
    setor_id: string;
    nome: string;
    total: number;
    rupturas: number;
    indice: number;
  }>;
  horariosRanking: Array<{
    horario: string;
    total: number;
    rupturas: number;
    indice: number;
  }>;
  produtosRanking: Array<{
    produto_id: string;
    codigo: string;
    nome: string;
    setor_id: string;
    ranking_vendas: number;
    vendas_qtd: number;
    total: number;
    rupturas: number;
    indice: number;
  }>;
  alertasAltoGiro: Array<{
    produto_id: string;
    codigo: string;
    nome: string;
    setor_id: string;
    ranking_vendas: number;
    vendas_qtd: number;
    total: number;
    rupturas: number;
    indice: number;
  }>;
  evolucaoDiaria: Array<{
    data: string;
    total: number;
    rupturas: number;
    indice: number;
  }>;
  heatmap: Array<{
    produto_id: string;
    produto_nome: string;
    produto_codigo: string;
    ranking: number;
    horarios: Record<string, { total: number; rupturas: number; indice: number }>;
  }>;
}

export interface FolhaSemanalData {
  setor?: Setor;
  diasSemana: Array<{ data: string; label: string; diaSemana: string }>;
  horarios: Horario[];
  linhas: Array<{
    produto_id: string;
    codigo: string;
    nome: string;
    ranking: number;
    dias: Array<{
      data: string;
      celulas: Array<{
        horario_id: string;
        horario: string;
        valor: number | null;
      }>;
    }>;
    totalAvaliados: number;
    totalRupturas: number;
    indiceRuptura: number;
  }>;
}
