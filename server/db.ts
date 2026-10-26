import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'padaria_porto.json');

export interface Setor {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export interface Horario {
  id: string;
  setor_id: string;
  horario: string; // "08:00"
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
  id: string; // `${data}_${produto_id}_${horario_id}`
  data: string; // YYYY-MM-DD
  setor_id: string;
  produto_id: string;
  horario_id: string;
  valor: number; // 1 = tem produto, 0 = ruptura
  usuario_id: string;
  usuario_nome: string;
  timestamp: string; // ISO
}

export interface Usuario {
  id: string;
  nome: string;
  usuario: string; // lowercase comparison
  senha_hash: string;
  perfil: 'administrador' | 'gestor' | 'operador';
  setores_permitidos: string[]; // ids dos setores liberados para operador
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

export interface TentativaLogin {
  usuario: string;
  tentativas: number;
  bloqueado_ate: number | null; // epoch ms
}

export interface DatabaseSchema {
  setores: Setor[];
  horarios: Horario[];
  produtos: Produto[];
  lancamentos: Lancamento[];
  usuarios: Usuario[];
  historico_acessos: HistoricoAcesso[];
  tentativas_login: Record<string, TentativaLogin>;
}

let dbInstance: DatabaseSchema | null = null;

export function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function saveDatabase() {
  if (!dbInstance) return;
  ensureDataDirectory();
  const tempFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(dbInstance, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

export function getDatabase(): DatabaseSchema {
  if (dbInstance) return dbInstance;
  ensureDataDirectory();

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      dbInstance = JSON.parse(content);
      // Migração: garantir que o setor 'cozinha' existe
      if (dbInstance && !dbInstance.setores.some((s) => s.id === 'cozinha')) {
        dbInstance.setores.push({ id: 'cozinha', nome: 'Cozinha', ordem: dbInstance.setores.length + 1, ativo: true });
        
        // Horários da cozinha
        const defaultHours = ['08:00', '11:00', '14:00', '17:00', '20:00'];
        defaultHours.forEach((h, idx) => {
          dbInstance!.horarios.push({
            id: `cozinha_${h.replace(':', '')}`,
            setor_id: 'cozinha',
            horario: h,
            ativo: true,
            ordem: idx + 1,
          });
        });

        // Produtos da Cozinha
        const rawCozinha = [
          { codigo: 'COZ-001', nome: 'Omelete Especial de Queijo Brie e Parma', vendas: 240 },
          { codigo: 'COZ-002', nome: 'Sanduíche Quente de Pastrami na Baguete', vendas: 215 },
          { codigo: 'COZ-003', nome: 'Toast de Abacate com Ovos Poché no Sourdough', vendas: 195 },
          { codigo: 'COZ-004', nome: 'Quiche de Alho Poró com Queijo Minas Artesanal', vendas: 180 },
          { codigo: 'COZ-005', nome: 'Caldo Verde Tradicional com Paio e Couve', vendas: 165 },
          { codigo: 'COZ-006', nome: 'Tostex Especial Porto no Pão Brioche', vendas: 150 },
          { codigo: 'COZ-007', nome: 'Escondidinho de Carne Seca com Mandioca Cremosa', vendas: 135 },
          { codigo: 'COZ-008', nome: 'Prato do Dia: Filé Mignon ao Molho Madeira', vendas: 120 },
        ];

        const now = new Date().toISOString();
        rawCozinha.forEach((p, idx) => {
          dbInstance!.produtos.push({
            id: `prod_${p.codigo.toLowerCase().replace('-', '_')}`,
            codigo: p.codigo,
            nome: p.nome,
            setor_id: 'cozinha',
            vendas_qtd: p.vendas,
            ranking: idx + 1,
            ativo: true,
            criado_em: now,
            atualizado_em: now,
          });
        });

        // Liberar cozinha para os administradores e gestores
        dbInstance.usuarios.forEach((u) => {
          if (u.perfil === 'administrador' || u.perfil === 'gestor') {
            if (!u.setores_permitidos.includes('cozinha')) {
              u.setores_permitidos.push('cozinha');
            }
          }
        });

        saveDatabase();
      }
      return dbInstance!;
    } catch (err) {
      console.error('Erro ao ler banco de dados existente, reinicializando...', err);
    }
  }

  // Inicializar banco inicial
  dbInstance = createInitialSeed();
  saveDatabase();
  return dbInstance;
}

function createInitialSeed(): DatabaseSchema {
  const setores: Setor[] = [
    { id: 'padaria', nome: 'Padaria', ordem: 1, ativo: true },
    { id: 'padaria_artesanal', nome: 'Padaria Artesanal', ordem: 2, ativo: true },
    { id: 'expedicao', nome: 'Expedição', ordem: 3, ativo: true },
    { id: 'confeitaria', nome: 'Confeitaria', ordem: 4, ativo: true },
    { id: 'confeitaria_fina', nome: 'Confeitaria Fina', ordem: 5, ativo: true },
    { id: 'pastelaria', nome: 'Pastelaria', ordem: 6, ativo: true },
    { id: 'cozinha', nome: 'Cozinha', ordem: 7, ativo: true },
  ];

  const defaultHours = ['08:00', '11:00', '14:00', '17:00', '20:00'];
  const horarios: Horario[] = [];

  setores.forEach((s) => {
    defaultHours.forEach((h, idx) => {
      horarios.push({
        id: `${s.id}_${h.replace(':', '')}`,
        setor_id: s.id,
        horario: h,
        ativo: true,
        ordem: idx + 1,
      });
    });
  });

  const rawProdutos = [
    // 1. Padaria
    { setor_id: 'padaria', codigo: 'PAD-001', nome: 'Pão Francês Tradicional', vendas_qtd: 1850 },
    { setor_id: 'padaria', codigo: 'PAD-002', nome: 'Pão de Queijo Minas Especial', vendas_qtd: 1420 },
    { setor_id: 'padaria', codigo: 'PAD-003', nome: 'Pão Francês Integral', vendas_qtd: 680 },
    { setor_id: 'padaria', codigo: 'PAD-004', nome: 'Pão Francês com Gergelim', vendas_qtd: 490 },
    { setor_id: 'padaria', codigo: 'PAD-005', nome: 'Baguete Tradicional Parisiense', vendas_qtd: 420 },
    { setor_id: 'padaria', codigo: 'PAD-006', nome: 'Pão de Batata com Requeijão', vendas_qtd: 330 },
    { setor_id: 'padaria', codigo: 'PAD-007', nome: 'Pão de Queijo Multigrãos', vendas_qtd: 310 },
    { setor_id: 'padaria', codigo: 'PAD-008', nome: 'Broa de Milho Aerada', vendas_qtd: 260 },
    { setor_id: 'padaria', codigo: 'PAD-009', nome: 'Ciabatta Rústica de Azeite', vendas_qtd: 220 },
    { setor_id: 'padaria', codigo: 'PAD-010', nome: 'Pão Doce de Creme e Coco', vendas_qtd: 195 },

    // 2. Padaria Artesanal
    { setor_id: 'padaria_artesanal', codigo: 'ART-001', nome: 'Sourdough Tradicional Fermentação Natural', vendas_qtd: 380 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-002', nome: 'Pão Multicereais Rústico Levain', vendas_qtd: 310 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-003', nome: 'Pão Italiano Filão Rústico', vendas_qtd: 275 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-004', nome: 'Focaccia de Alecrim, Sal Grosso e Confit', vendas_qtd: 240 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-005', nome: 'Brioche Nanterre Artesanal na Manteiga', vendas_qtd: 215 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-006', nome: 'Pão Australiano com Mel e Cacau', vendas_qtd: 198 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-007', nome: 'Pão de Nozes com Figo Turco', vendas_qtd: 160 },
    { setor_id: 'padaria_artesanal', codigo: 'ART-008', nome: 'Pão 100% Centeio Integral Puro', vendas_qtd: 140 },

    // 3. Expedição
    { setor_id: 'expedicao', codigo: 'EXP-001', nome: 'Cesta Café da Manhã Porto Premium', vendas_qtd: 135 },
    { setor_id: 'expedicao', codigo: 'EXP-002', nome: 'Kit Lanche Corporativo Especial (5 pessoas)', vendas_qtd: 105 },
    { setor_id: 'expedicao', codigo: 'EXP-003', nome: 'Fatiado de Presunto Parma e Queijo Brie', vendas_qtd: 92 },
    { setor_id: 'expedicao', codigo: 'EXP-004', nome: 'Mini Sanduíches Sortidos para Evento (30 un)', vendas_qtd: 80 },
    { setor_id: 'expedicao', codigo: 'EXP-005', nome: 'Caixa Degustação Croissants da Casa', vendas_qtd: 70 },
    { setor_id: 'expedicao', codigo: 'EXP-006', nome: 'Pães Especiais Congelados para Assar', vendas_qtd: 55 },

    // 4. Confeitaria
    { setor_id: 'confeitaria', codigo: 'CNF-001', nome: 'Torta Holandesa Clássica Porto', vendas_qtd: 155 },
    { setor_id: 'confeitaria', codigo: 'CNF-002', nome: 'Bolo de Cenoura com Brigadeiro Belga', vendas_qtd: 142 },
    { setor_id: 'confeitaria', codigo: 'CNF-003', nome: 'Torta Alemã Delicatéssen', vendas_qtd: 130 },
    { setor_id: 'confeitaria', codigo: 'CNF-004', nome: 'Bolo Red Velvet com Cream Cheese', vendas_qtd: 110 },
    { setor_id: 'confeitaria', codigo: 'CNF-005', nome: 'Pudim de Leite Condensado Artesanal', vendas_qtd: 95 },
    { setor_id: 'confeitaria', codigo: 'CNF-006', nome: 'Torta de Morango com Chantilly Fresco', vendas_qtd: 90 },
    { setor_id: 'confeitaria', codigo: 'CNF-007', nome: 'Quindim Tradicional de Yolk', vendas_qtd: 82 },
    { setor_id: 'confeitaria', codigo: 'CNF-008', nome: 'Mousse de Chocolate 70% Amargo', vendas_qtd: 68 },

    // 5. Confeitaria Fina
    { setor_id: 'confeitaria_fina', codigo: 'FIN-001', nome: 'Macaron Francês Sortido (Caixa 6 un)', vendas_qtd: 340 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-002', nome: 'Mil-folhas de Baunilha Bourbon', vendas_qtd: 175 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-003', nome: 'Éclair de Chocolate Belga Callebaut', vendas_qtd: 155 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-004', nome: 'Tartelette de Frutas Vermelhas Frescas', vendas_qtd: 140 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-005', nome: 'Trufa Artesanal ao Licor Cointreau', vendas_qtd: 125 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-006', nome: 'Entremet de Pistache da Sicília e Framboesa', vendas_qtd: 98 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-007', nome: 'Cannoli Siciliano com Ricota Doce e Raspas', vendas_qtd: 90 },
    { setor_id: 'confeitaria_fina', codigo: 'FIN-008', nome: 'Ópera Cake Francês Tradicional', vendas_qtd: 76 },

    // 6. Pastelaria
    { setor_id: 'pastelaria', codigo: 'PAS-001', nome: 'Croissant Francês Manteiga AOP', vendas_qtd: 480 },
    { setor_id: 'pastelaria', codigo: 'PAS-002', nome: 'Pastel de Belém / Nata Tradicional', vendas_qtd: 440 },
    { setor_id: 'pastelaria', codigo: 'PAS-003', nome: 'Coxinha de Frango com Catupiry Dourada', vendas_qtd: 410 },
    { setor_id: 'pastelaria', codigo: 'PAS-004', nome: 'Croissant de Amêndoas Tostadas', vendas_qtd: 310 },
    { setor_id: 'pastelaria', codigo: 'PAS-005', nome: 'Pain au Chocolat Folhado', vendas_qtd: 285 },
    { setor_id: 'pastelaria', codigo: 'PAS-006', nome: 'Empada de Palmito Pupunha Cremosa', vendas_qtd: 260 },
    { setor_id: 'pastelaria', codigo: 'PAS-007', nome: 'Folhado de Frango com Queijo Gouda', vendas_qtd: 220 },
    { setor_id: 'pastelaria', codigo: 'PAS-008', nome: 'Folhado de Maçã com Canela e Uvas Passas', vendas_qtd: 190 },
  ];

  const now = new Date().toISOString();
  // Ordenar por vendas decrescentes e calcular ranking por setor
  const produtosPorSetor: Record<string, typeof rawProdutos> = {};
  rawProdutos.forEach((p) => {
    if (!produtosPorSetor[p.setor_id]) produtosPorSetor[p.setor_id] = [];
    produtosPorSetor[p.setor_id].push(p);
  });

  const produtos: Produto[] = [];
  Object.keys(produtosPorSetor).forEach((setorId) => {
    const sorted = [...produtosPorSetor[setorId]].sort((a, b) => b.vendas_qtd - a.vendas_qtd);
    sorted.forEach((p, index) => {
      produtos.push({
        id: `prod_${p.codigo.toLowerCase().replace('-', '_')}`,
        codigo: p.codigo,
        nome: p.nome,
        setor_id: p.setor_id,
        vendas_qtd: p.vendas_qtd,
        ranking: index + 1,
        ativo: true,
        criado_em: now,
        atualizado_em: now,
      });
    });
  });

  // Criar Usuário Administrador Obrigatório:
  // Usuário: Vitor Silva
  // Senha: 040220
  // Criptografada com bcrypt
  const salt = bcrypt.genSaltSync(10);
  const senhaHash = bcrypt.hashSync('040220', salt);

  const usuarios: Usuario[] = [
    {
      id: 'usr_admin_vitor',
      nome: 'Vitor Silva',
      usuario: 'vitor silva', // guardamos em lowercase para comparação insensível
      senha_hash: senhaHash,
      perfil: 'administrador',
      setores_permitidos: ['padaria', 'padaria_artesanal', 'expedicao', 'confeitaria', 'confeitaria_fina', 'pastelaria'],
      ativo: true,
      criado_em: now,
      ultimo_acesso: null,
    },
    {
      id: 'usr_gestor_clara',
      nome: 'Clara Delicatéssen',
      usuario: 'clara.gestora',
      senha_hash: bcrypt.hashSync('porto123', salt),
      perfil: 'gestor',
      setores_permitidos: ['padaria', 'padaria_artesanal', 'expedicao', 'confeitaria', 'confeitaria_fina', 'pastelaria'],
      ativo: true,
      criado_em: now,
      ultimo_acesso: null,
    },
    {
      id: 'usr_op_carlos',
      nome: 'Carlos Padaria',
      usuario: 'carlos.operador',
      senha_hash: bcrypt.hashSync('porto123', salt),
      perfil: 'operador',
      setores_permitidos: ['padaria', 'padaria_artesanal'],
      ativo: true,
      criado_em: now,
      ultimo_acesso: null,
    },
    {
      id: 'usr_op_mariana',
      nome: 'Mariana Confeitaria',
      usuario: 'mariana.operadora',
      senha_hash: bcrypt.hashSync('porto123', salt),
      perfil: 'operador',
      setores_permitidos: ['confeitaria', 'confeitaria_fina', 'pastelaria'],
      ativo: true,
      criado_em: now,
      ultimo_acesso: null,
    },
  ];

  // Gerar histórico de lançamentos dos últimos 7 dias para testar indicadores
  const lancamentos: Lancamento[] = [];
  const today = new Date();

  for (let d = 6; d >= 0; d--) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - d);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Para cada setor e horário
    setores.forEach((s) => {
      const setorProds = produtos.filter((p) => p.setor_id === s.id);
      const setorHours = horarios.filter((h) => h.setor_id === s.id);

      setorHours.forEach((h) => {
        // Se for hoje, podemos preencher apenas alguns horários passados para simular dia em andamento
        const hourNum = parseInt(h.horario.split(':')[0], 10);
        if (d === 0 && hourNum > 14) {
          // deixa horários das 17h e 20h vazios hoje para o usuário preencher na prática!
          return;
        }

        setorProds.forEach((prod) => {
          // Simulação realista de ruptura:
          // Produtos de alto giro têm faltas em horários de pico (ex: 17:00 ou 20:00)
          let ruptureChance = 0.08; // 8% base
          if (prod.ranking <= 3) {
            ruptureChance = hourNum >= 17 ? 0.28 : 0.06;
          } else if (prod.ranking >= 7) {
            ruptureChance = hourNum >= 14 ? 0.20 : 0.12;
          }

          // Determinar valor 1 ou 0
          const isRuptura = Math.random() < ruptureChance;
          const valor = isRuptura ? 0 : 1;

          lancamentos.push({
            id: `${dateStr}_${prod.id}_${h.id}`,
            data: dateStr,
            setor_id: s.id,
            produto_id: prod.id,
            horario_id: h.id,
            valor,
            usuario_id: 'usr_admin_vitor',
            usuario_nome: 'Vitor Silva',
            timestamp: new Date(targetDate.setHours(hourNum, 15, 0, 0)).toISOString(),
          });
        });
      });
    });
  }

  const historico_acessos: HistoricoAcesso[] = [
    {
      id: 'acc_init_1',
      usuario_id: 'usr_admin_vitor',
      usuario_nome: 'Vitor Silva',
      acao: 'login_sucesso',
      status: 'sucesso',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      detalhe: 'Inicialização do sistema e login do administrador inicial.',
    },
  ];

  return {
    setores,
    horarios,
    produtos,
    lancamentos,
    usuarios,
    historico_acessos,
    tentativas_login: {},
  };
}
