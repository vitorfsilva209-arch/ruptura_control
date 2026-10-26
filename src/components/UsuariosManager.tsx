import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Usuario, Setor, HistoricoAcesso, PerfilUsuario } from '../types';
import { api } from '../services/api';
import {
  Users,
  UserPlus,
  KeyRound,
  Shield,
  ShieldAlert,
  Clock,
  History,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  AlertCircle,
  Lock,
  Layers,
} from 'lucide-react';

interface UsuariosManagerProps {
  setores: Setor[];
}

export const UsuariosManager: React.FC<UsuariosManagerProps> = ({ setores }) => {
  const { user: currentUser } = useAuth();
  const [subTab, setSubTab] = useState<'usuarios' | 'auditoria'>('usuarios');

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [logs, setLogs] = useState<HistoricoAcesso[]>([]);
  const [loading, setLoading] = useState(false);

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);

  // Form State
  const [formNome, setFormNome] = useState('');
  const [formUsuario, setFormUsuario] = useState('');
  const [formSenha, setFormSenha] = useState('');
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>('operador');
  const [formSetores, setFormSetores] = useState<string[]>([]);
  const [formAtivo, setFormAtivo] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset Senha Form
  const [resetSenhaNova, setResetSenhaNova] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const carregarUsuarios = () => {
    setLoading(true);
    api
      .getUsers()
      .then((res) => {
        setUsuarios(res);
      })
      .catch((err) => {
        console.error('Erro ao carregar usuários:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const carregarLogs = () => {
    setLoading(true);
    api
      .getAccessLogs()
      .then((res) => {
        setLogs(res);
      })
      .catch((err) => {
        console.error('Erro ao carregar logs:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (subTab === 'usuarios') {
      carregarUsuarios();
    } else {
      carregarLogs();
    }
  }, [subTab]);

  const handleOpenAdd = () => {
    setFormNome('');
    setFormUsuario('');
    setFormSenha('');
    setFormPerfil('operador');
    setFormSetores(['padaria']);
    setFormAtivo(true);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (u: Usuario) => {
    setSelectedUser(u);
    setFormNome(u.nome);
    setFormUsuario(u.usuario);
    setFormPerfil(u.perfil);
    setFormSetores(u.setores_permitidos || []);
    setFormAtivo(u.ativo);
    setFormError(null);
    setShowEditModal(true);
  };

  const handleOpenReset = (u: Usuario) => {
    setSelectedUser(u);
    setResetSenhaNova('');
    setResetError(null);
    setResetSuccess(null);
    setShowResetModal(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formNome.trim() || !formUsuario.trim() || !formSenha) {
      setFormError('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      await api.createUser({
        nome: formNome,
        usuario: formUsuario,
        senha: formSenha,
        perfil: formPerfil,
        setores_permitidos: formPerfil === 'operador' ? formSetores : setores.map((s) => s.id),
      });
      setShowAddModal(false);
      carregarUsuarios();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao criar usuário.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);

    try {
      await api.updateUser(selectedUser.id, {
        nome: formNome,
        perfil: formPerfil,
        setores_permitidos: formPerfil === 'operador' ? formSetores : setores.map((s) => s.id),
        ativo: formAtivo,
      });
      setShowEditModal(false);
      carregarUsuarios();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao atualizar usuário.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setResetError(null);

    if (!resetSenhaNova || resetSenhaNova.length < 4) {
      setResetError('A nova senha deve ter no mínimo 4 caracteres.');
      return;
    }

    try {
      const res = await api.resetPassword(selectedUser.id, resetSenhaNova);
      setResetSuccess(res.message);
      setTimeout(() => {
        setShowResetModal(false);
      }, 1500);
    } catch (err: any) {
      setResetError(err.message || 'Erro ao redefinir senha.');
    }
  };

  const handleDeleteUser = async (u: Usuario) => {
    if (u.usuario === 'vitor silva') {
      alert('O usuário administrador Vitor Silva não pode ser excluído.');
      return;
    }

    const confirmou = window.confirm(
      `Deseja realmente excluir permanentemente o usuário "${u.nome}"?`
    );
    if (!confirmou) return;

    try {
      await api.deleteUser(u.id);
      carregarUsuarios();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir usuário.');
    }
  };

  const toggleSetorPermitido = (setorId: string) => {
    setFormSetores((prev) =>
      prev.includes(setorId) ? prev.filter((id) => id !== setorId) : [...prev, setorId]
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header com Navegação entre Usuários e Auditoria */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-100/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
              Gestão de Usuários & Segurança
            </h2>
            <p className="text-xs text-slate-500">
              Controle de perfis, senhas criptografadas, restrições por setor e histórico de acessos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setSubTab('usuarios')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'usuarios'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Usuários ({usuarios.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSubTab('auditoria')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  subTab === 'auditoria'
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histórico de Acessos</span>
              </button>
            </div>

            {subTab === 'usuarios' && (
              <button
                onClick={handleOpenAdd}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>Novo Usuário</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ABA: LISTA DE USUÁRIOS */}
      {subTab === 'usuarios' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Carregando usuários...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                    <th className="py-3 px-4">Nome & Usuário</th>
                    <th className="py-3 px-3">Perfil de Acesso</th>
                    <th className="py-3 px-3">Setores Permitidos</th>
                    <th className="py-3 px-3">Último Acesso</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-4 text-center w-36">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const isMainAdmin = u.usuario === 'vitor silva';

                    return (
                      <tr key={u.id} className="hover:bg-amber-50/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-amber-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {u.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">
                                {u.nome} {isSelf && <span className="text-[10px] text-amber-800 font-semibold">(Você)</span>}
                              </p>
                              <p className="font-mono text-[11px] text-slate-400">@{u.usuario}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              u.perfil === 'administrador'
                                ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                : u.perfil === 'gestor'
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {u.perfil}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          {u.perfil === 'administrador' || u.perfil === 'gestor' ? (
                            <span className="text-[11px] font-semibold text-slate-600">
                              Todos os Setores (Total)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {u.setores_permitidos && u.setores_permitidos.length > 0 ? (
                                u.setores_permitidos.map((sId) => (
                                  <span
                                    key={sId}
                                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                                  >
                                    {setores.find((s) => s.id === sId)?.nome || sId}
                                  </span>
                                ))
                              ) : (
                                <span className="text-rose-600 text-[10px]">Nenhum setor liberado</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                          {u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : 'Nunca acessou'}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              u.ativo
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenReset(u)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-amber-800 hover:bg-amber-50 transition cursor-pointer"
                              title="Redefinir senha"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-800 hover:bg-blue-50 transition cursor-pointer"
                              title="Editar permissões"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!isMainAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                                title="Excluir usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA: HISTÓRICO DE ACESSOS (AUDITORIA) */}
      {subTab === 'auditoria' && (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase">
              Registros Recentes de Acesso e Tentativas de Login
            </span>
            <span className="text-[11px] text-slate-500">
              Auditoria em tempo real contra ataques e acessos indevidos
            </span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Carregando logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">
              Nenhum registro de acesso gravado até o momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                    <th className="py-2.5 px-3">Data & Hora</th>
                    <th className="py-2.5 px-3">Usuário Informado</th>
                    <th className="py-2.5 px-3">Ação</th>
                    <th className="py-2.5 px-4">Detalhes</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {logs.map((log) => {
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {log.usuario_nome}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[10px] font-bold">
                          {log.acao === 'login_sucesso' ? (
                            <span className="text-emerald-700">Login Sucesso</span>
                          ) : log.acao === 'login_falha' ? (
                            <span className="text-rose-700">Falha de Senha</span>
                          ) : log.acao === 'bloqueio_temporario' ? (
                            <span className="text-amber-800 bg-amber-100 px-1 py-0.5 rounded">
                              Bloqueio
                            </span>
                          ) : log.acao === 'logout' ? (
                            <span className="text-slate-500">Logout</span>
                          ) : (
                            <span className="text-blue-700">Troca Senha</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-sans text-xs">
                          {log.detalhe}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              log.status === 'sucesso'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'falha'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NOVO USUÁRIO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Cadastrar Novo Usuário</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Carlos Padaria"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase mb-1">
                    Nome de Usuário (Login)
                  </label>
                  <input
                    type="text"
                    value={formUsuario}
                    onChange={(e) => setFormUsuario(e.target.value)}
                    placeholder="Ex: carlos.operador"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Insensível a maiúsculas.</p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Senha Inicial
                </label>
                <input
                  type="password"
                  value={formSenha}
                  onChange={(e) => setFormSenha(e.target.value)}
                  placeholder="Mínimo 4 caracteres (será criptografada)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={formPerfil}
                  onChange={(e) => setFormPerfil(e.target.value as PerfilUsuario)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 font-bold"
                >
                  <option value="operador">Operador (Apenas lança setores permitidos)</option>
                  <option value="gestor">Gestor (Vê todos os relatórios, edita produtos e horários)</option>
                  <option value="administrador">Administrador (Acesso total)</option>
                </select>
              </div>

              {formPerfil === 'operador' && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                  <label className="block font-bold text-amber-950 uppercase mb-2">
                    Setores Liberados para este Operador:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {setores.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-slate-800 cursor-pointer font-medium"
                      >
                        <input
                          type="checkbox"
                          checked={formSetores.includes(s.id)}
                          onChange={() => toggleSetorPermitido(s.id)}
                          className="w-4 h-4 text-amber-700 rounded focus:ring-amber-500"
                        />
                        <span>{s.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs cursor-pointer"
                >
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR USUÁRIO */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Editar Usuário: {selectedUser.nome}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Perfil de Acesso
                </label>
                <select
                  value={formPerfil}
                  onChange={(e) => setFormPerfil(e.target.value as PerfilUsuario)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 font-bold"
                >
                  <option value="operador">Operador (Apenas lança setores permitidos)</option>
                  <option value="gestor">Gestor (Vê todos os relatórios, edita produtos e horários)</option>
                  <option value="administrador">Administrador (Acesso total)</option>
                </select>
              </div>

              {formPerfil === 'operador' && (
                <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                  <label className="block font-bold text-amber-950 uppercase mb-2">
                    Setores Liberados para este Operador:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {setores.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 text-slate-800 cursor-pointer font-medium"
                      >
                        <input
                          type="checkbox"
                          checked={formSetores.includes(s.id)}
                          onChange={() => toggleSetorPermitido(s.id)}
                          className="w-4 h-4 text-amber-700 rounded focus:ring-amber-500"
                        />
                        <span>{s.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userAtivo"
                  checked={formAtivo}
                  onChange={(e) => setFormAtivo(e.target.checked)}
                  disabled={selectedUser.usuario === 'vitor silva'}
                  className="w-4 h-4 text-amber-700 rounded focus:ring-amber-500"
                />
                <label htmlFor="userAtivo" className="font-semibold text-slate-800 cursor-pointer">
                  Usuário Ativo (Pode fazer login no sistema)
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REDEFINIR SENHA (PELO ADMIN) */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Redefinir Senha de {selectedUser.nome}</h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Digite a nova senha para o usuário <strong>@{selectedUser.usuario}</strong>. A senha será criptografada com hash seguro antes de ser gravada.
              </p>

              {resetSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {resetError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={resetSenhaNova}
                  onChange={(e) => setResetSenhaNova(e.target.value)}
                  placeholder="Informe a nova senha (mínimo 4 dígitos)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-900"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs cursor-pointer"
                >
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
