import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { X, KeyRound, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

interface PerfilModalProps {
  onClose: () => void;
}

export const PerfilModal: React.FC<PerfilModalProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsgSucesso(null);

    if (!novaSenha || novaSenha.length < 4) {
      setError('A nova senha deve possuir pelo menos 4 caracteres.');
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setError('A confirmação da nova senha não confere.');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(user.id, senhaAtual, novaSenha);
      setMsgSucesso('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmaSenha('');
    } catch (err: any) {
      setError(err.message || 'Falha ao alterar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base">Meu Perfil de Acesso</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações do Usuário */}
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-amber-700 text-white font-bold text-lg flex items-center justify-center shadow-sm">
              {user.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">{user.nome}</h4>
              <p className="text-xs text-slate-500 font-mono">@{user.usuario}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  {user.perfil}
                </span>
                {user.perfil === 'operador' && (
                  <span className="text-[11px] text-slate-500">
                    Setores liberados: {user.setores_permitidos?.length || 0}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Troca de Senha */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-600" />
              Alterar Minha Senha
            </h4>

            {msgSucesso && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{msgSucesso}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Senha Atual
                </label>
                <input
                  type="password"
                  value={senhaAtual}
                  onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Informe sua senha atual"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
