import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import {
  getDatabase,
  saveDatabase,
  Usuario,
  Produto,
  Horario,
  Lancamento,
  HistoricoAcesso,
} from './server/db';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Helper para log de auditoria
function registrarAuditoria(
  acao: HistoricoAcesso['acao'],
  status: HistoricoAcesso['status'],
  usuarioNome: string,
  usuarioId: string | null,
  detalhe: string,
  req?: express.Request
) {
  const db = getDatabase();
  const id = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const ip = req ? (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1' : '127.0.0.1';
  db.historico_acessos.unshift({
    id,
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    acao,
    status,
    timestamp: new Date().toISOString(),
    detalhe,
    ip,
  });
  // Manter no máximo 500 registros de auditoria
  if (db.historico_acessos.length > 500) {
    db.historico_acessos = db.historico_acessos.slice(0, 500);
  }
  saveDatabase();
}

// Recalcular rankings de um setor
function recalcularRankingsSetor(setorId: string) {
  const db = getDatabase();
  const prodsSetor = db.produtos.filter((p) => p.setor_id === setorId && p.ativo);
  prodsSetor.sort((a, b) => b.vendas_qtd - a.vendas_qtd);
  prodsSetor.forEach((p, index) => {
    p.ranking = index + 1;
    p.atualizado_em = new Date().toISOString();
  });
  saveDatabase();
}

// -------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { usuario, senha } = req.body;
  if (!usuario || !senha) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const cleanUser = String(usuario).trim().toLowerCase();
  const db = getDatabase();
  const now = Date.now();

  // Verificar bloqueio temporário por tentativas
  const tentativa = db.tentativas_login[cleanUser];
  if (tentativa && tentativa.bloqueado_ate) {
    if (now < tentativa.bloqueado_ate) {
      const segundosRestantes = Math.ceil((tentativa.bloqueado_ate - now) / 1000);
      registrarAuditoria(
        'bloqueio_temporario',
        'aviso',
        usuario,
        null,
        `Tentativa de login enquanto bloqueado. Tempo restante: ${segundosRestantes}s`,
        req
      );
      return res.status(429).json({
        error: `Muitas tentativas incorretas. Usuário temporariamente bloqueado. Tente novamente em ${segundosRestantes} segundos.`,
        bloqueado: true,
        segundosRestantes,
      });
    } else {
      // Bloqueio expirou, reiniciar contador
      delete db.tentativas_login[cleanUser];
      saveDatabase();
    }
  }

  // Buscar usuário (insensível a maiúsculas)
  const user = db.usuarios.find((u) => u.usuario.toLowerCase() === cleanUser);

  if (!user) {
    // Registrar falha
    registrarAuditoria('login_falha', 'falha', usuario, null, 'Usuário não encontrado.', req);
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  if (!user.ativo) {
    registrarAuditoria('login_falha', 'aviso', user.nome, user.id, 'Tentativa de acesso com usuário desativado.', req);
    return res.status(403).json({ error: 'Este usuário está inativo no sistema. Procure o Administrador.' });
  }

  // Validar senha criptografada com bcrypt
  const senhaCorreta = bcrypt.compareSync(senha, user.senha_hash);

  if (!senhaCorreta) {
    if (!db.tentativas_login[cleanUser]) {
      db.tentativas_login[cleanUser] = { usuario: cleanUser, tentativas: 0, bloqueado_ate: null };
    }
    db.tentativas_login[cleanUser].tentativas += 1;
    const tentativasAtuais = db.tentativas_login[cleanUser].tentativas;

    if (tentativasAtuais >= 5) {
      // Bloquear por 15 minutos (900.000 ms)
      const lockUntil = now + 15 * 60 * 1000;
      db.tentativas_login[cleanUser].bloqueado_ate = lockUntil;
      saveDatabase();
      registrarAuditoria(
        'bloqueio_temporario',
        'aviso',
        user.nome,
        user.id,
        'Usuário bloqueado por 15 minutos após 5 tentativas de senha incorreta.',
        req
      );
      return res.status(429).json({
        error: 'Você errou a senha 5 vezes consecutivas. Acesso bloqueado temporariamente por 15 minutos por segurança.',
        bloqueado: true,
        segundosRestantes: 900,
      });
    }

    saveDatabase();
    registrarAuditoria('login_falha', 'falha', user.nome, user.id, `Senha incorreta (tentativa ${tentativasAtuais}/5).`, req);
    return res.status(401).json({
      error: `Senha incorreta. Tentativa ${tentativasAtuais} de 5 antes do bloqueio temporário.`,
    });
  }

  // Login com sucesso!
  if (db.tentativas_login[cleanUser]) {
    delete db.tentativas_login[cleanUser];
  }
  user.ultimo_acesso = new Date().toISOString();
  saveDatabase();

  registrarAuditoria('login_sucesso', 'sucesso', user.nome, user.id, `Login efetuado com sucesso (Perfil: ${user.perfil}).`, req);

  // Retornar usuário sem o hash da senha
  const { senha_hash, ...safeUser } = user;
  return res.json({
    user: safeUser,
    token: `porto_${user.id}_${Date.now()}`,
  });
});

app.post('/api/auth/logout', (req, res) => {
  const { usuario_nome, usuario_id } = req.body;
  registrarAuditoria('logout', 'sucesso', usuario_nome || 'Desconhecido', usuario_id || null, 'Logout efetuado.', req);
  res.json({ success: true });
});

app.post('/api/auth/change-password', (req, res) => {
  const { usuario_id, senha_atual, nova_senha } = req.body;
  if (!usuario_id || !nova_senha) {
    return res.status(400).json({ error: 'Parâmetros incompletos.' });
  }
  if (nova_senha.length < 4) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
  }

  const db = getDatabase();
  const user = db.usuarios.find((u) => u.id === usuario_id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (senha_atual) {
    const check = bcrypt.compareSync(senha_atual, user.senha_hash);
    if (!check) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }
  }

  const salt = bcrypt.genSaltSync(10);
  user.senha_hash = bcrypt.hashSync(nova_senha, salt);
  saveDatabase();

  registrarAuditoria('troca_senha', 'sucesso', user.nome, user.id, 'Senha alterada com sucesso.', req);
  return res.json({ success: true, message: 'Senha alterada com sucesso!' });
});

// -------------------------------------------------------------
// ROTAS DE USUÁRIOS (ADMINISTRADOR)
// -------------------------------------------------------------
app.get('/api/users', (req, res) => {
  const db = getDatabase();
  const safeUsers = db.usuarios.map(({ senha_hash, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/users', (req, res) => {
  const { nome, usuario, senha, perfil, setores_permitidos } = req.body;
  if (!nome || !usuario || !senha || !perfil) {
    return res.status(400).json({ error: 'Nome, usuário, senha e perfil são obrigatórios.' });
  }

  const cleanUser = String(usuario).trim().toLowerCase();
  const db = getDatabase();

  if (db.usuarios.some((u) => u.usuario.toLowerCase() === cleanUser)) {
    return res.status(400).json({ error: 'Já existe um usuário cadastrado com este nome de login.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const senha_hash = bcrypt.hashSync(senha, salt);

  const newUser: Usuario = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    nome: nome.trim(),
    usuario: cleanUser,
    senha_hash,
    perfil,
    setores_permitidos: perfil === 'operador' ? (setores_permitidos || []) : ['padaria', 'padaria_artesanal', 'expedicao', 'confeitaria', 'confeitaria_fina', 'pastelaria'],
    ativo: true,
    criado_em: new Date().toISOString(),
    ultimo_acesso: null,
  };

  db.usuarios.push(newUser);
  saveDatabase();

  registrarAuditoria('troca_senha', 'sucesso', 'Admin', null, `Novo usuário criado: ${newUser.nome} (${newUser.usuario})`, req);
  const { senha_hash: _, ...safe } = newUser;
  res.json(safe);
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { nome, perfil, setores_permitidos, ativo } = req.body;
  const db = getDatabase();
  const user = db.usuarios.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  // Prevenir inativação do admin Vitor Silva se for o único admin ativo
  if (user.usuario === 'vitor silva' && ativo === false) {
    return res.status(400).json({ error: 'O administrador principal não pode ser inativado.' });
  }

  if (nome !== undefined) user.nome = nome.trim();
  if (perfil !== undefined) user.perfil = perfil;
  if (setores_permitidos !== undefined) user.setores_permitidos = setores_permitidos;
  if (ativo !== undefined) user.ativo = Boolean(ativo);

  saveDatabase();
  const { senha_hash, ...safe } = user;
  res.json(safe);
});

app.put('/api/users/:id/reset-password', (req, res) => {
  const { id } = req.params;
  const { nova_senha } = req.body;
  if (!nova_senha || nova_senha.length < 4) {
    return res.status(400).json({ error: 'A nova senha deve ter no mínimo 4 caracteres.' });
  }

  const db = getDatabase();
  const user = db.usuarios.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const salt = bcrypt.genSaltSync(10);
  user.senha_hash = bcrypt.hashSync(nova_senha, salt);
  saveDatabase();

  registrarAuditoria('troca_senha', 'sucesso', 'Admin', null, `Senha redefinida pelo admin para: ${user.nome}`, req);
  res.json({ success: true, message: `Senha do usuário ${user.nome} redefinida com sucesso.` });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const userIndex = db.usuarios.findIndex((u) => u.id === id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  if (db.usuarios[userIndex].usuario === 'vitor silva') {
    return res.status(400).json({ error: 'O administrador Vitor Silva não pode ser excluído.' });
  }

  const removed = db.usuarios.splice(userIndex, 1)[0];
  saveDatabase();
  registrarAuditoria('troca_senha', 'aviso', 'Admin', null, `Usuário excluído: ${removed.nome}`, req);
  res.json({ success: true });
});

app.get('/api/access-logs', (req, res) => {
  const db = getDatabase();
  res.json(db.historico_acessos.slice(0, 150));
});

// -------------------------------------------------------------
// SETORES E HORÁRIOS
// -------------------------------------------------------------
app.get('/api/setores', (req, res) => {
  const db = getDatabase();
  res.json(db.setores);
});

app.post('/api/setores', (req, res) => {
  const { nome } = req.body;
  if (!nome || !String(nome).trim()) {
    return res.status(400).json({ error: 'O nome do setor é obrigatório.' });
  }

  const db = getDatabase();
  const nomeTrim = String(nome).trim();

  // Gerar ID seguro
  const idBase = nomeTrim
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const id = idBase || `setor_${Date.now()}`;

  if (db.setores.some((s) => s.id === id || s.nome.toLowerCase() === nomeTrim.toLowerCase())) {
    return res.status(400).json({ error: 'Já existe um setor com este nome.' });
  }

  const novoSetor = {
    id,
    nome: nomeTrim,
    ordem: db.setores.length + 1,
    ativo: true,
  };

  db.setores.push(novoSetor);

  // Inicializar horários padrão de conferência para este setor
  const defaultHours = ['08:00', '11:00', '14:00', '17:00', '20:00'];
  defaultHours.forEach((h, idx) => {
    db.horarios.push({
      id: `${id}_${h.replace(':', '')}`,
      setor_id: id,
      horario: h,
      ativo: true,
      ordem: idx + 1,
    });
  });

  // Liberar o novo setor automaticamente para administradores e gestores
  db.usuarios.forEach((u) => {
    if (u.perfil === 'administrador' || u.perfil === 'gestor') {
      if (!u.setores_permitidos.includes(id)) {
        u.setores_permitidos.push(id);
      }
    }
  });

  saveDatabase();
  res.json(novoSetor);
});

app.put('/api/setores/:id', (req, res) => {
  const { id } = req.params;
  const { nome, ativo, ordem } = req.body;
  const db = getDatabase();
  const setor = db.setores.find((s) => s.id === id);
  if (!setor) {
    return res.status(404).json({ error: 'Setor não encontrado.' });
  }

  if (nome !== undefined && String(nome).trim()) {
    setor.nome = String(nome).trim();
  }
  if (ativo !== undefined) {
    setor.ativo = Boolean(ativo);
  }
  if (ordem !== undefined) {
    setor.ordem = Number(ordem);
  }

  saveDatabase();
  res.json(setor);
});

app.delete('/api/setores/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const index = db.setores.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Setor não encontrado.' });
  }

  const [removed] = db.setores.splice(index, 1);
  // Desativar produtos relacionados
  db.produtos.forEach((p) => {
    if (p.setor_id === id) p.ativo = false;
  });

  saveDatabase();
  res.json({ success: true, removed });
});

app.get('/api/horarios', (req, res) => {
  const db = getDatabase();
  const { setor_id } = req.query;
  let horarios = db.horarios;
  if (setor_id) {
    horarios = horarios.filter((h) => h.setor_id === setor_id);
  }
  horarios.sort((a, b) => a.ordem - b.ordem);
  res.json(horarios);
});

app.post('/api/horarios', (req, res) => {
  const { setor_id, horario } = req.body;
  if (!setor_id || !horario) {
    return res.status(400).json({ error: 'Setor e horário são obrigatórios.' });
  }

  const db = getDatabase();
  const setorHorarios = db.horarios.filter((h) => h.setor_id === setor_id);
  const exists = setorHorarios.some((h) => h.horario === horario);
  if (exists) {
    return res.status(400).json({ error: 'Este horário já está cadastrado para este setor.' });
  }

  const newHorario: Horario = {
    id: `${setor_id}_${horario.replace(':', '')}_${Date.now().toString(36).substr(-3)}`,
    setor_id,
    horario,
    ativo: true,
    ordem: setorHorarios.length + 1,
  };

  db.horarios.push(newHorario);
  saveDatabase();
  res.json(newHorario);
});

app.put('/api/horarios/:id', (req, res) => {
  const { id } = req.params;
  const { horario, ativo, ordem } = req.body;
  const db = getDatabase();
  const item = db.horarios.find((h) => h.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Horário não encontrado.' });
  }

  if (horario !== undefined) item.horario = horario;
  if (ativo !== undefined) item.ativo = Boolean(ativo);
  if (ordem !== undefined) item.ordem = Number(ordem);

  saveDatabase();
  res.json(item);
});

app.delete('/api/horarios/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const idx = db.horarios.findIndex((h) => h.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Horário não encontrado.' });
  }

  const removed = db.horarios.splice(idx, 1)[0];
  saveDatabase();
  res.json({ success: true, removed });
});

// -------------------------------------------------------------
// PRODUTOS & RANKING
// -------------------------------------------------------------
app.get('/api/produtos', (req, res) => {
  const { setor_id, apenas_ativos } = req.query;
  const db = getDatabase();
  let list = db.produtos;

  if (setor_id) {
    list = list.filter((p) => p.setor_id === setor_id);
  }
  if (apenas_ativos === 'true') {
    list = list.filter((p) => p.ativo);
  }

  // Ordenar por ranking
  list.sort((a, b) => a.ranking - b.ranking);
  res.json(list);
});

app.post('/api/produtos', (req, res) => {
  const { codigo, nome, setor_id, vendas_qtd } = req.body;
  if (!codigo || !nome || !setor_id) {
    return res.status(400).json({ error: 'Código, nome e setor são obrigatórios.' });
  }

  const db = getDatabase();
  const setorProds = db.produtos.filter((p) => p.setor_id === setor_id && p.ativo);
  const now = new Date().toISOString();

  const newProd: Produto = {
    id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    codigo: String(codigo).trim().toUpperCase(),
    nome: String(nome).trim(),
    setor_id,
    vendas_qtd: Number(vendas_qtd) || 0,
    ranking: setorProds.length + 1,
    ativo: true,
    criado_em: now,
    atualizado_em: now,
  };

  db.produtos.push(newProd);
  saveDatabase();

  // Recalcular rankings com base no volume de vendas
  recalcularRankingsSetor(setor_id);

  const updatedProd = db.produtos.find((p) => p.id === newProd.id);
  res.json(updatedProd);
});

app.put('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  const { codigo, nome, setor_id, vendas_qtd, ativo, ranking } = req.body;
  const db = getDatabase();
  const prod = db.produtos.find((p) => p.id === id);
  if (!prod) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  let vendasAlteradas = false;
  if (codigo !== undefined) prod.codigo = String(codigo).trim().toUpperCase();
  if (nome !== undefined) prod.nome = String(nome).trim();
  if (setor_id !== undefined && setor_id !== prod.setor_id) {
    const oldSetor = prod.setor_id;
    prod.setor_id = setor_id;
    recalcularRankingsSetor(oldSetor);
    vendasAlteradas = true;
  }
  if (vendas_qtd !== undefined && Number(vendas_qtd) !== prod.vendas_qtd) {
    prod.vendas_qtd = Number(vendas_qtd);
    vendasAlteradas = true;
  }
  if (ativo !== undefined) {
    prod.ativo = Boolean(ativo);
    vendasAlteradas = true;
  }
  if (ranking !== undefined && !vendasAlteradas) {
    prod.ranking = Number(ranking);
  }

  prod.atualizado_em = new Date().toISOString();
  saveDatabase();

  if (vendasAlteradas) {
    recalcularRankingsSetor(prod.setor_id);
  }

  res.json(prod);
});

// Reordenação manual
app.put('/api/produtos/reorder-setor', (req, res) => {
  const { setor_id, ordered_ids } = req.body;
  if (!setor_id || !Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: 'Setor e lista de IDs ordenados são necessários.' });
  }

  const db = getDatabase();
  ordered_ids.forEach((id, index) => {
    const prod = db.produtos.find((p) => p.id === id);
    if (prod) {
      prod.ranking = index + 1;
      prod.atualizado_em = new Date().toISOString();
    }
  });

  saveDatabase();
  res.json({ success: true });
});

// Importação em massa de produtos por CSV/JSON
app.post('/api/produtos/import', (req, res) => {
  const { setor_id, itens } = req.body;
  if (!setor_id || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Setor e lista de itens válidos são necessários.' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  let importados = 0;
  let atualizados = 0;

  itens.forEach((item: any) => {
    const codigo = String(item.codigo || '').trim().toUpperCase();
    const nome = String(item.nome || '').trim();
    const vendas = Number(item.vendas || item.vendas_qtd || item.quantidade) || 0;

    if (!nome) return;

    // Verificar se já existe por código ou nome no setor
    const existing = db.produtos.find(
      (p) => p.setor_id === setor_id && (p.codigo === codigo || p.nome.toLowerCase() === nome.toLowerCase())
    );

    if (existing) {
      existing.vendas_qtd = vendas > 0 ? vendas : existing.vendas_qtd;
      existing.ativo = true;
      existing.atualizado_em = now;
      atualizados++;
    } else {
      const generatedCode = codigo || `PROD-${Math.floor(100 + Math.random() * 900)}`;
      db.produtos.push({
        id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        codigo: generatedCode,
        nome,
        setor_id,
        vendas_qtd: vendas,
        ranking: 999,
        ativo: true,
        criado_em: now,
        atualizado_em: now,
      });
      importados++;
    }
  });

  saveDatabase();
  recalcularRankingsSetor(setor_id);

  res.json({ success: true, importados, atualizados });
});

app.delete('/api/produtos/:id', (req, res) => {
  const { id } = req.params;
  const db = getDatabase();
  const prod = db.produtos.find((p) => p.id === id);
  if (!prod) {
    return res.status(404).json({ error: 'Produto não encontrado.' });
  }

  // Desativação lógica para não quebrar integridade de lançamentos históricos
  prod.ativo = false;
  prod.atualizado_em = new Date().toISOString();
  saveDatabase();
  recalcularRankingsSetor(prod.setor_id);

  res.json({ success: true, message: 'Produto inativado com sucesso.' });
});

// -------------------------------------------------------------
// LANÇAMENTOS (GRADE DE CONFERÊNCIA)
// -------------------------------------------------------------
app.get('/api/lancamentos', (req, res) => {
  const { data, setor_id, inicio, fim } = req.query;
  const db = getDatabase();
  let list = db.lancamentos;

  if (data) {
    list = list.filter((l) => l.data === data);
  } else if (inicio && fim) {
    list = list.filter((l) => l.data >= inicio && l.data <= fim);
  }

  if (setor_id) {
    list = list.filter((l) => l.setor_id === setor_id);
  }

  res.json(list);
});

// Alternar / salvar célula única
app.post('/api/lancamentos', (req, res) => {
  const { data, setor_id, produto_id, horario_id, valor, usuario_id, usuario_nome } = req.body;
  if (!data || !setor_id || !produto_id || !horario_id || valor === undefined) {
    return res.status(400).json({ error: 'Dados incompletos do lançamento.' });
  }

  const db = getDatabase();
  const id = `${data}_${produto_id}_${horario_id}`;
  const now = new Date().toISOString();

  const existingIdx = db.lancamentos.findIndex((l) => l.id === id);

  if (valor === null || valor === -1) {
    // Remover lançamento (voltar a vazio)
    if (existingIdx !== -1) {
      db.lancamentos.splice(existingIdx, 1);
      saveDatabase();
    }
    return res.json({ removed: true });
  }

  const lancamento: Lancamento = {
    id,
    data,
    setor_id,
    produto_id,
    horario_id,
    valor: valor === 1 ? 1 : 0,
    usuario_id: usuario_id || 'usr_desconhecido',
    usuario_nome: usuario_nome || 'Operador',
    timestamp: now,
  };

  if (existingIdx !== -1) {
    db.lancamentos[existingIdx] = lancamento;
  } else {
    db.lancamentos.push(lancamento);
  }

  saveDatabase();
  res.json(lancamento);
});

// Lançamento em lote ("Marcar tudo como 1" para uma coluna inteira de horário)
app.post('/api/lancamentos/batch', (req, res) => {
  const { lancamentos } = req.body;
  if (!Array.isArray(lancamentos) || lancamentos.length === 0) {
    return res.status(400).json({ error: 'Nenhum lançamento fornecido.' });
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  lancamentos.forEach((item) => {
    const { data, setor_id, produto_id, horario_id, valor, usuario_id, usuario_nome } = item;
    if (!data || !setor_id || !produto_id || !horario_id || valor === undefined) return;

    const id = `${data}_${produto_id}_${horario_id}`;
    const existingIdx = db.lancamentos.findIndex((l) => l.id === id);

    const novoLancamento: Lancamento = {
      id,
      data,
      setor_id,
      produto_id,
      horario_id,
      valor: valor === 1 ? 1 : 0,
      usuario_id: usuario_id || 'usr_desconhecido',
      usuario_nome: usuario_nome || 'Operador',
      timestamp: now,
    };

    if (existingIdx !== -1) {
      db.lancamentos[existingIdx] = novoLancamento;
    } else {
      db.lancamentos.push(novoLancamento);
    }
  });

  saveDatabase();
  res.json({ success: true, count: lancamentos.length });
});

// -------------------------------------------------------------
// RELATÓRIOS E INDICADORES DE RUPTURA
// -------------------------------------------------------------
app.get('/api/relatorios/indicadores', (req, res) => {
  const { inicio, fim, setor_id, horario_id, produto_id } = req.query;
  const db = getDatabase();

  // Filtrar lançamentos no período
  let lancs = db.lancamentos;
  if (inicio) lancs = lancs.filter((l) => l.data >= String(inicio));
  if (fim) lancs = lancs.filter((l) => l.data <= String(fim));
  if (setor_id) lancs = lancs.filter((l) => l.setor_id === String(setor_id));
  if (horario_id) lancs = lancs.filter((l) => l.horario_id === String(horario_id));
  if (produto_id) lancs = lancs.filter((l) => l.produto_id === String(produto_id));

  const totalAvaliados = lancs.length;
  const totalRupturas = lancs.filter((l) => l.valor === 0).length;
  const indiceGeral = totalAvaliados > 0 ? (totalRupturas / totalAvaliados) * 100 : 0;

  // Ruptura por Setor
  const setorMap: Record<string, { nome: string; total: number; rupturas: number }> = {};
  db.setores.forEach((s) => {
    setorMap[s.id] = { nome: s.nome, total: 0, rupturas: 0 };
  });

  lancs.forEach((l) => {
    if (!setorMap[l.setor_id]) {
      const sObj = db.setores.find((s) => s.id === l.setor_id);
      setorMap[l.setor_id] = { nome: sObj ? sObj.nome : l.setor_id, total: 0, rupturas: 0 };
    }
    setorMap[l.setor_id].total++;
    if (l.valor === 0) setorMap[l.setor_id].rupturas++;
  });

  const setoresRanking = Object.entries(setorMap).map(([id, d]) => ({
    setor_id: id,
    nome: d.nome,
    total: d.total,
    rupturas: d.rupturas,
    indice: d.total > 0 ? (d.rupturas / d.total) * 100 : 0,
  })).sort((a, b) => b.indice - a.indice);

  const piorSetor = setoresRanking.length > 0 && setoresRanking[0].total > 0 ? setoresRanking[0] : null;

  // Ruptura por Horário
  const horarioMap: Record<string, { horario: string; setor_id: string; total: number; rupturas: number }> = {};
  lancs.forEach((l) => {
    const hObj = db.horarios.find((h) => h.id === l.horario_id);
    const hourLabel = hObj ? hObj.horario : l.horario_id;
    if (!horarioMap[hourLabel]) {
      horarioMap[hourLabel] = { horario: hourLabel, setor_id: l.setor_id, total: 0, rupturas: 0 };
    }
    horarioMap[hourLabel].total++;
    if (l.valor === 0) horarioMap[hourLabel].rupturas++;
  });

  const horariosRanking = Object.entries(horarioMap).map(([horario, d]) => ({
    horario,
    total: d.total,
    rupturas: d.rupturas,
    indice: d.total > 0 ? (d.rupturas / d.total) * 100 : 0,
  })).sort((a, b) => b.indice - a.indice);

  const horarioCritico = horariosRanking.length > 0 && horariosRanking[0].total > 0 ? horariosRanking[0] : null;

  // Ruptura por Produto
  const prodMap: Record<string, { produto: Produto; total: number; rupturas: number }> = {};
  lancs.forEach((l) => {
    if (!prodMap[l.produto_id]) {
      const p = db.produtos.find((prod) => prod.id === l.produto_id);
      if (p) {
        prodMap[l.produto_id] = { produto: p, total: 0, rupturas: 0 };
      }
    }
    if (prodMap[l.produto_id]) {
      prodMap[l.produto_id].total++;
      if (l.valor === 0) prodMap[l.produto_id].rupturas++;
    }
  });

  const produtosRanking = Object.entries(prodMap).map(([id, d]) => ({
    produto_id: id,
    codigo: d.produto.codigo,
    nome: d.produto.nome,
    setor_id: d.produto.setor_id,
    ranking_vendas: d.produto.ranking,
    vendas_qtd: d.produto.vendas_qtd,
    total: d.total,
    rupturas: d.rupturas,
    indice: d.total > 0 ? (d.rupturas / d.total) * 100 : 0,
  })).sort((a, b) => b.indice - a.indice);

  const produtoMaisFaltante = produtosRanking.length > 0 && produtosRanking[0].total > 0 ? produtosRanking[0] : null;

  // Alerta de Produtos de Alto Giro em Ruptura:
  // Produtos com ranking de vendas <= 5 (os mais vendidos) e índice de ruptura >= 10%
  const alertasAltoGiro = produtosRanking.filter((p) => p.ranking_vendas <= 5 && p.indice >= 10);

  // Evolução Diária / Semanal
  const dataMap: Record<string, { data: string; total: number; rupturas: number }> = {};
  lancs.forEach((l) => {
    if (!dataMap[l.data]) {
      dataMap[l.data] = { data: l.data, total: 0, rupturas: 0 };
    }
    dataMap[l.data].total++;
    if (l.valor === 0) dataMap[l.data].rupturas++;
  });

  const evolucaoDiaria = Object.keys(dataMap).sort().map((d) => ({
    data: d,
    total: dataMap[d].total,
    rupturas: dataMap[d].rupturas,
    indice: dataMap[d].total > 0 ? (dataMap[d].rupturas / dataMap[d].total) * 100 : 0,
  }));

  // Mapa de calor (Produto x Horário)
  const heatmap: Array<{
    produto_id: string;
    produto_nome: string;
    produto_codigo: string;
    ranking: number;
    horarios: Record<string, { total: number; rupturas: number; indice: number }>;
  }> = [];

  // Filtrar produtos ativos do setor selecionado ou top produtos
  const produtosAlvo = db.produtos
    .filter((p) => p.ativo && (!setor_id || p.setor_id === setor_id))
    .sort((a, b) => a.ranking - b.ranking)
    .slice(0, 20); // Top 20 para visualização confortável

  produtosAlvo.forEach((p) => {
    const hRecord: Record<string, { total: number; rupturas: number; indice: number }> = {};
    const pLancs = lancs.filter((l) => l.produto_id === p.id);

    pLancs.forEach((l) => {
      const hObj = db.horarios.find((h) => h.id === l.horario_id);
      const label = hObj ? hObj.horario : l.horario_id;
      if (!hRecord[label]) {
        hRecord[label] = { total: 0, rupturas: 0, indice: 0 };
      }
      hRecord[label].total++;
      if (l.valor === 0) hRecord[label].rupturas++;
    });

    Object.keys(hRecord).forEach((k) => {
      const item = hRecord[k];
      item.indice = item.total > 0 ? (item.rupturas / item.total) * 100 : 0;
    });

    heatmap.push({
      produto_id: p.id,
      produto_nome: p.nome,
      produto_codigo: p.codigo,
      ranking: p.ranking,
      horarios: hRecord,
    });
  });

  res.json({
    periodo: { inicio, fim },
    totalAvaliados,
    totalRupturas,
    indiceGeral: Number(indiceGeral.toFixed(1)),
    piorSetor,
    horarioCritico,
    produtoMaisFaltante,
    setoresRanking,
    horariosRanking,
    produtosRanking: produtosRanking.slice(0, 30),
    alertasAltoGiro,
    evolucaoDiaria,
    heatmap,
  });
});

// Visão "Acompanhamento Semanal de Ruptura" (estilo folha impressa)
app.get('/api/relatorios/folha-semanal', (req, res) => {
  const { setor_id, inicio_semana } = req.query;
  const db = getDatabase();

  const setorId = String(setor_id || 'padaria');
  let startDate = inicio_semana ? new Date(String(inicio_semana)) : new Date();

  // Ajustar para segunda-feira da semana
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // se domingo volta 6, senão para segunda
  startDate = new Date(startDate.setDate(diff));

  const diasSemana: Array<{ data: string; label: string; diaSemana: string }> = [];
  const nomesDias = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const [_, mes, dia] = dateStr.split('-');
    diasSemana.push({
      data: dateStr,
      label: `${dia}/${mes}`,
      diaSemana: nomesDias[i],
    });
  }

  const produtos = db.produtos.filter((p) => p.setor_id === setorId && p.ativo).sort((a, b) => a.ranking - b.ranking);
  const horarios = db.horarios.filter((h) => h.setor_id === setorId && h.ativo).sort((a, b) => a.ordem - b.ordem);

  const dataInicio = diasSemana[0].data;
  const dataFim = diasSemana[6].data;

  const lancs = db.lancamentos.filter(
    (l) => l.setor_id === setorId && l.data >= dataInicio && l.data <= dataFim
  );

  // Mapear por produto x data x horario
  const lancMap: Record<string, number> = {};
  lancs.forEach((l) => {
    lancMap[`${l.produto_id}_${l.data}_${l.horario_id}`] = l.valor;
  });

  const linhas = produtos.map((prod) => {
    let totalProd = 0;
    let rupturasProd = 0;

    const diasData = diasSemana.map((dia) => {
      const celulas = horarios.map((h) => {
        const val = lancMap[`${prod.id}_${dia.data}_${h.id}`];
        if (val !== undefined) {
          totalProd++;
          if (val === 0) rupturasProd++;
        }
        return {
          horario_id: h.id,
          horario: h.horario,
          valor: val !== undefined ? val : null,
        };
      });
      return {
        data: dia.data,
        celulas,
      };
    });

    const indiceProd = totalProd > 0 ? (rupturasProd / totalProd) * 100 : 0;

    return {
      produto_id: prod.id,
      codigo: prod.codigo,
      nome: prod.nome,
      ranking: prod.ranking,
      dias: diasData,
      totalAvaliados: totalProd,
      totalRupturas: rupturasProd,
      indiceRuptura: Number(indiceProd.toFixed(1)),
    };
  });

  res.json({
    setor: db.setores.find((s) => s.id === setorId),
    diasSemana,
    horarios,
    linhas,
  });
});

// Middleware de tratamento de erros global para garantir sempre resposta em JSON
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro no servidor:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || 'Ocorreu um erro interno no servidor.',
    });
  }
});

// Inicialização com Vite Middleware
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Padaria Porto Delicatéssen server rodando na porta ${PORT}`);
  });
}

startServer();
