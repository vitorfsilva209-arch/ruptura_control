import React, { useState } from 'react';
import {
  BookOpen,
  Database,
  Terminal,
  ShieldCheck,
  Calculator,
  CheckCircle2,
  Copy,
  Layers,
  Sparkles,
} from 'lucide-react';

export const DocumentacaoView: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const sqlSchema = `-- ====================================================================
-- ESTRUTURA DO BANCO DE DADOS RELACIONAL: PORTO DELICATÉSSEN
-- Compatível com PostgreSQL / SQLite / MySQL
-- ====================================================================

-- 1. TABELA DE SETORES
CREATE TABLE setores (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 1,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2. TABELA DE HORÁRIOS DE CONFERÊNCIA POR SETOR
CREATE TABLE horarios (
    id VARCHAR(50) PRIMARY KEY,
    setor_id VARCHAR(50) NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
    horario VARCHAR(5) NOT NULL, -- Ex: '08:00', '11:00'
    ordem INTEGER NOT NULL DEFAULT 1,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. TABELA DE PRODUTOS E RANKING DE VENDAS
CREATE TABLE produtos (
    id VARCHAR(50) PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    nome VARCHAR(150) NOT NULL,
    setor_id VARCHAR(50) NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
    vendas_qtd INTEGER NOT NULL DEFAULT 0,
    ranking INTEGER NOT NULL DEFAULT 999,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_produtos_setor_ranking ON produtos(setor_id, ranking);

-- 4. TABELA DE LANÇAMENTOS DIÁRIOS DE RUPTURA
CREATE TABLE lancamentos (
    id VARCHAR(120) PRIMARY KEY, -- formato: 'YYYY-MM-DD_produtoId_horarioId'
    data DATE NOT NULL,
    setor_id VARCHAR(50) NOT NULL REFERENCES setores(id),
    produto_id VARCHAR(50) NOT NULL REFERENCES produtos(id),
    horario_id VARCHAR(50) NOT NULL REFERENCES horarios(id),
    valor SMALLINT NOT NULL CHECK (valor IN (0, 1)), -- 1 = Disponível, 0 = Ruptura
    usuario_id VARCHAR(50) NOT NULL,
    usuario_nome VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lancamentos_data_setor ON lancamentos(data, setor_id);
CREATE INDEX idx_lancamentos_produto ON lancamentos(produto_id);

-- 5. TABELA DE USUÁRIOS E SEGURANÇA
CREATE TABLE usuarios (
    id VARCHAR(50) PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    usuario VARCHAR(60) NOT NULL UNIQUE, -- Case-insensitive
    senha_hash VARCHAR(255) NOT NULL,    -- Criptografia bcrypt
    perfil VARCHAR(30) NOT NULL CHECK (perfil IN ('administrador', 'gestor', 'operador')),
    setores_permitidos JSONB DEFAULT '[]', -- Apenas setores liberados para operadores
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP WITH TIME ZONE
);

-- 6. TABELA DE HISTÓRICO DE AUDITORIA E TENTATIVAS DE ACESSO
CREATE TABLE historico_acessos (
    id VARCHAR(60) PRIMARY KEY,
    usuario_id VARCHAR(50),
    usuario_nome VARCHAR(100) NOT NULL,
    acao VARCHAR(40) NOT NULL, -- 'login_sucesso', 'login_falha', 'bloqueio_temporario', etc.
    status VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    detalhe TEXT,
    ip VARCHAR(45)
);`;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-amber-100/80">
        <div className="flex items-center gap-3.5">
          <img
            src="/assets/aistudio/Emblema_Vintage_Porto_Primo_Delicatessen_d1445651.png"
            alt="Porto Primo Delicatessen"
            className="w-12 h-auto shrink-0 drop-shadow-xs"
          />
          <div>
            <h2 className="text-lg font-bold font-display text-slate-900">
              Manual do Sistema & Documentação Técnica
            </h2>
            <p className="text-xs text-slate-500">
              Padaria Porto Primo Delicatéssen • Arquitetura, estrutura relacional, regras e operação.
            </p>
          </div>
        </div>
      </div>

      {/* Seção 1: Justificativa da Stack e Arquitetura */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 text-xs leading-relaxed text-slate-700">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-700" />
          <h3>1. Arquitetura e Justificativa da Stack Escolhida</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <h4 className="font-bold text-amber-950 text-xs mb-1">Frontend: React 19 + Tailwind</h4>
            <p className="text-slate-600">
              Interface extremamente rápida e responsiva para celulares e computadores. Grade tátil otimizada para toque rápido por operadores de produção mesmo com luvas.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <h4 className="font-bold text-amber-950 text-xs mb-1">Backend: Node.js + Express</h4>
            <p className="text-slate-600">
              Servidor full-stack com API REST unificada, controle de sessão, recálculo automático de ranking por vendas e proteção contra força bruta.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <h4 className="font-bold text-amber-950 text-xs mb-1">Banco Relacional & Zero-Crash</h4>
            <p className="text-slate-600">
              Armazenamento relacional normalizado com atomicidade ACID (gravação com substituição de arquivo atômico). Elimina dependências nativas (node-gyp/C++), garantindo 100% de portabilidade e persistência.
            </p>
          </div>
        </div>
      </div>

      {/* Seção 2: Regra de Cálculo do Índice de Ruptura */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4 text-xs leading-relaxed text-slate-700">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
          <Calculator className="w-4 h-4 text-amber-700" />
          <h3>2. Fórmula e Regras do Índice de Ruptura</h3>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 text-white font-mono text-center text-sm">
          Índice de Ruptura (%) = ( Total de Lançamentos com 0 ÷ Total de Lançamentos Avaliados ) × 100
        </div>

        <ul className="list-disc list-inside space-y-1.5 text-slate-600">
          <li>
            <strong>Valor 1:</strong> Produto presente na gôndola/vitrine (Disponível para venda imediata).
          </li>
          <li>
            <strong>Valor 0:</strong> Produto em falta total (Ruptura).
          </li>
          <li>
            <strong>Células Vazias (-):</strong> Não avaliadas / não inspecionadas naquele horário. São <em>rigorosamente ignoradas</em> no divisor do cálculo para não mascarar a média real.
          </li>
          <li>
            <strong>Alerta de Alto Giro:</strong> Produtos ranqueados no Top 5 de vendas que apresentam índice de ruptura &ge; 10% entram automaticamente em alarme prioritário por causarem perda direta de receita.
          </li>
        </ul>
      </div>

      {/* Seção 3: DDL SQL do Banco de Dados Relacional */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3 text-xs leading-relaxed">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
            <Database className="w-4 h-4 text-amber-700" />
            <h3>3. Estrutura das Tabelas do Banco Relacional (DDL SQL)</h3>
          </div>
          <button
            onClick={() => copyToClipboard(sqlSchema, 'sql')}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1 cursor-pointer"
          >
            {copiedSection === 'sql' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar SQL</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto font-mono text-[11px] leading-relaxed max-h-[380px]">
          <pre>{sqlSchema}</pre>
        </div>
      </div>

      {/* Seção 4: Segurança, Login e Auditoria */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-3 text-xs leading-relaxed text-slate-700">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-amber-700" />
          <h3>4. Segurança e Acesso Conforme Especificações</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="font-bold text-slate-900 mb-1">Criptografia BCrypt</h4>
            <p className="text-slate-600">
              Todas as senhas são armazenadas com salt dinâmico e hash seguro (bcryptjs). Nenhuma senha transita ou é salva em texto puro.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="font-bold text-slate-900 mb-1">Proteção Anti Força-Bruta</h4>
            <p className="text-slate-600">
              Após 5 tentativas erradas sucessivas, o acesso ao usuário é automaticamente bloqueado por 15 minutos com contagem regressiva em tempo real.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="font-bold text-slate-900 mb-1">Login Insensível a Maiúsculas</h4>
            <p className="text-slate-600">
              O operador pode digitar "Vitor Silva", "vitor silva" ou "VITOR SILVA", garantindo facilidade no teclado de celulares.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="font-bold text-slate-900 mb-1">Desconexão Automática</h4>
            <p className="text-slate-600">
              Após 30 minutos sem nenhuma interação física (toque ou mouse), a sessão do usuário é encerrada automaticamente para segurança da bancada de produção.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
