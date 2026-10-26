import {
  Setor,
  Horario,
  Produto,
  Lancamento,
  Usuario,
  HistoricoAcesso,
  IndicadoresData,
  FolhaSemanalData,
} from '../types';

const OFFLINE_QUEUE_KEY = 'porto_offline_lancamentos_queue';

export function getOfflineQueue(): any[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: any[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Erro ao salvar fila offline:', err);
  }
}

export function addToOfflineQueue(item: any) {
  const queue = getOfflineQueue();
  const key = `${item.data}_${item.produto_id}_${item.horario_id}`;
  const idx = queue.findIndex((q) => `${q.data}_${q.produto_id}_${q.horario_id}` === key);
  if (idx !== -1) {
    queue[idx] = item;
  } else {
    queue.push(item);
  }
  saveOfflineQueue(queue);
}

export async function syncOfflineQueue(): Promise<{ synced: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { synced: 0 };

  try {
    const res = await fetch('/api/lancamentos/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lancamentos: queue }),
    });

    if (res.ok) {
      const count = queue.length;
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
      return { synced: count };
    }
  } catch (err) {
    console.warn('Falha ao sincronizar fila offline, tentará novamente depois:', err);
  }
  return { synced: 0 };
}

// Helper seguro para parsing de JSON que nunca falha com "Unexpected end of JSON input"
async function parseResponseJson<T = any>(res: Response, defaultErrorMsg: string = 'Erro na operação'): Promise<T> {
  const text = await res.text();
  let data: any = null;

  if (text && text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  } else {
    data = {};
  }

  if (!res.ok) {
    const errorMsg =
      data?.error ||
      (res.status === 401
        ? 'Usuário ou senha inválidos.'
        : res.status === 404
        ? 'Recurso não encontrado no servidor.'
        : res.status === 429
        ? data?.error || 'Muitas tentativas. Acesso temporariamente bloqueado.'
        : `${defaultErrorMsg} (Status: ${res.status})`);
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Autenticação
  login: async (usuario: string, senha: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, senha }),
      });
      return await parseResponseJson(res, 'Erro ao realizar login');
    } catch (err: any) {
      if (err.name === 'TypeError' || err.message?.includes('fetch')) {
        throw new Error('Falha de conexão com o servidor. Verifique se o servidor está ativo.');
      }
      throw err;
    }
  },

  logout: async (usuario_id?: string, usuario_nome?: string) => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id, usuario_nome }),
      });
    } catch (err) {
      console.warn('Erro ao notificar logout:', err);
    }
  },

  changePassword: async (usuario_id: string, senha_atual: string, nova_senha: string) => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id, senha_atual, nova_senha }),
    });
    return await parseResponseJson(res, 'Erro ao alterar senha');
  },

  // Usuários
  getUsers: async (): Promise<Usuario[]> => {
    const res = await fetch('/api/users');
    return await parseResponseJson<Usuario[]>(res, 'Falha ao carregar usuários');
  },

  createUser: async (payload: any): Promise<Usuario> => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await parseResponseJson<Usuario>(res, 'Erro ao cadastrar usuário');
  },

  updateUser: async (id: string, payload: any): Promise<Usuario> => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await parseResponseJson<Usuario>(res, 'Erro ao atualizar usuário');
  },

  resetPassword: async (id: string, nova_senha: string) => {
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nova_senha }),
    });
    return await parseResponseJson(res, 'Erro ao redefinir senha');
  },

  deleteUser: async (id: string) => {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    return await parseResponseJson(res, 'Erro ao excluir usuário');
  },

  getAccessLogs: async (): Promise<HistoricoAcesso[]> => {
    const res = await fetch('/api/access-logs');
    return await parseResponseJson<HistoricoAcesso[]>(res, 'Falha ao carregar logs de acesso');
  },

  // Setores & Horários
  getSetores: async (): Promise<Setor[]> => {
    const res = await fetch('/api/setores');
    return await parseResponseJson<Setor[]>(res, 'Falha ao carregar setores');
  },

  createSetor: async (nome: string): Promise<Setor> => {
    const res = await fetch('/api/setores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    });
    return await parseResponseJson<Setor>(res, 'Erro ao criar setor');
  },

  updateSetor: async (id: string, payload: Partial<Setor>): Promise<Setor> => {
    const res = await fetch(`/api/setores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await parseResponseJson<Setor>(res, 'Erro ao atualizar setor');
  },

  deleteSetor: async (id: string) => {
    const res = await fetch(`/api/setores/${id}`, { method: 'DELETE' });
    return await parseResponseJson(res, 'Erro ao excluir setor');
  },

  getHorarios: async (setor_id?: string): Promise<Horario[]> => {
    const url = setor_id ? `/api/horarios?setor_id=${setor_id}` : '/api/horarios';
    const res = await fetch(url);
    return await parseResponseJson<Horario[]>(res, 'Falha ao carregar horários');
  },

  createHorario: async (setor_id: string, horario: string): Promise<Horario> => {
    const res = await fetch('/api/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setor_id, horario }),
    });
    return await parseResponseJson<Horario>(res, 'Erro ao criar horário');
  },

  updateHorario: async (id: string, payload: Partial<Horario>): Promise<Horario> => {
    const res = await fetch(`/api/horarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await parseResponseJson<Horario>(res, 'Erro ao atualizar horário');
  },

  deleteHorario: async (id: string) => {
    const res = await fetch(`/api/horarios/${id}`, { method: 'DELETE' });
    return await parseResponseJson(res, 'Erro ao excluir horário');
  },

  // Produtos
  getProdutos: async (setor_id?: string, apenas_ativos: boolean = true): Promise<Produto[]> => {
    const params = new URLSearchParams();
    if (setor_id) params.append('setor_id', setor_id);
    if (apenas_ativos) params.append('apenas_ativos', 'true');
    const res = await fetch(`/api/produtos?${params.toString()}`);
    return await parseResponseJson<Produto[]>(res, 'Falha ao carregar produtos');
  },

  createProduto: async (payload: Partial<Produto>): Promise<Produto> => {
    const res = await fetch('/api/produtos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await parseResponseJson<Produto>(res, 'Erro ao criar produto');
  },

  updateProduto: async (id: string, payload: Partial<Produto>): Promise<Produto> => {
    const res = await fetch(`/api/produtos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await parseResponseJson<Produto>(res, 'Erro ao atualizar produto');
  },

  reorderProdutos: async (setor_id: string, ordered_ids: string[]) => {
    const res = await fetch('/api/produtos/reorder-setor', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setor_id, ordered_ids }),
    });
    return await parseResponseJson(res, 'Erro ao reordenar produtos');
  },

  deleteProduto: async (id: string) => {
    const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
    return await parseResponseJson(res, 'Erro ao excluir produto');
  },

  importProdutos: async (setor_id: string, itens: any[]) => {
    const res = await fetch('/api/produtos/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setor_id, itens }),
    });
    return await parseResponseJson(res, 'Erro ao importar produtos');
  },

  // Lançamentos
  getLancamentos: async (data: string, setor_id?: string): Promise<Lancamento[]> => {
    const params = new URLSearchParams();
    if (data) params.append('data', data);
    if (setor_id) params.append('setor_id', setor_id);
    const res = await fetch(`/api/lancamentos?${params.toString()}`);
    return await parseResponseJson<Lancamento[]>(res, 'Falha ao carregar lançamentos');
  },

  saveLancamento: async (payload: {
    data: string;
    setor_id: string;
    produto_id: string;
    horario_id: string;
    valor: number | null;
    usuario_id: string;
    usuario_nome: string;
  }) => {
    if (!navigator.onLine) {
      addToOfflineQueue(payload);
      return { offline: true, ...payload };
    }

    try {
      const res = await fetch('/api/lancamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await parseResponseJson(res, 'Falha ao salvar lançamento');
    } catch (err) {
      addToOfflineQueue(payload);
      return { offline: true, ...payload };
    }
  },

  saveLancamentosBatch: async (lancamentos: any[]) => {
    if (!navigator.onLine) {
      lancamentos.forEach((item) => addToOfflineQueue(item));
      return { offline: true, count: lancamentos.length };
    }

    try {
      const res = await fetch('/api/lancamentos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lancamentos }),
      });
      return await parseResponseJson(res, 'Falha ao salvar em lote');
    } catch (err) {
      lancamentos.forEach((item) => addToOfflineQueue(item));
      return { offline: true, count: lancamentos.length };
    }
  },

  // Relatórios
  getIndicadores: async (filters: {
    inicio?: string;
    fim?: string;
    setor_id?: string;
    horario_id?: string;
    produto_id?: string;
  }): Promise<IndicadoresData> => {
    const params = new URLSearchParams();
    if (filters.inicio) params.append('inicio', filters.inicio);
    if (filters.fim) params.append('fim', filters.fim);
    if (filters.setor_id) params.append('setor_id', filters.setor_id);
    if (filters.horario_id) params.append('horario_id', filters.horario_id);
    if (filters.produto_id) params.append('produto_id', filters.produto_id);

    const res = await fetch(`/api/relatorios/indicadores?${params.toString()}`);
    return await parseResponseJson<IndicadoresData>(res, 'Falha ao calcular indicadores');
  },

  getFolhaSemanal: async (setor_id: string, inicio_semana?: string): Promise<FolhaSemanalData> => {
    const params = new URLSearchParams();
    params.append('setor_id', setor_id);
    if (inicio_semana) params.append('inicio_semana', inicio_semana);
    const res = await fetch(`/api/relatorios/folha-semanal?${params.toString()}`);
    return await parseResponseJson<FolhaSemanalData>(res, 'Falha ao carregar folha semanal');
  },
};
