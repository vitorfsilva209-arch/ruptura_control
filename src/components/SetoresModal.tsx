import React, { useState } from 'react';
import { Setor } from '../types';
import { api } from '../services/api';
import {
  Layers,
  Plus,
  X,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface SetoresModalProps {
  setores: Setor[];
  onClose: () => void;
  onSetoresChange: () => void;
}

export const SetoresModal: React.FC<SetoresModalProps> = ({
  setores,
  onClose,
  onSetoresChange,
}) => {
  const [novoNome, setNovoNome] = useState('');
  const [editingSetor, setEditingSetor] = useState<Setor | null>(null);
  const [editNome, setEditNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCreateSetor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) {
      setError('Por favor, informe o nome do novo setor.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const created = await api.createSetor(novoNome.trim());
      setSuccess(`Setor "${created.nome}" criado com sucesso com horários padrão iniciais!`);
      setNovoNome('');
      onSetoresChange();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar setor.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (s: Setor) => {
    setEditingSetor(s);
    setEditNome(s.nome);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingSetor || !editNome.trim()) return;
    setLoading(true);
    try {
      await api.updateSetor(editingSetor.id, { nome: editNome.trim() });
      setEditingSetor(null);
      setSuccess('Setor atualizado com sucesso!');
      onSetoresChange();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar setor.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAtivo = async (s: Setor) => {
    try {
      await api.updateSetor(s.id, { ativo: !s.ativo });
      onSetoresChange();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar status do setor.');
    }
  };

  const handleDelete = async (s: Setor) => {
    const confirmou = window.confirm(
      `Deseja realmente excluir o setor "${s.nome}"? Seus horários e catálogo serão desativados.`
    );
    if (!confirmou) return;

    try {
      await api.deleteSetor(s.id);
      setSuccess(`Setor "${s.nome}" excluído.`);
      onSetoresChange();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir setor.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-sm">Gerenciador de Setores</h3>
              <p className="text-[11px] text-slate-400">
                Adicione novos setores para controle e análise de ruptura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Mensagens de Sucesso e Erro */}
          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Formulário de Novo Setor */}
          <form onSubmit={handleCreateSetor} className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4">
            <label className="block font-bold text-amber-950 uppercase mb-1.5 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-amber-700" />
              Cadastrar Novo Setor
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Cozinha, Rotisseria, Cafeteria..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900 font-semibold"
              />
              <button
                type="submit"
                disabled={loading || !novoNome.trim()}
                className="px-4 py-2 font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar</span>
              </button>
            </div>
            <p className="text-[10px] text-amber-800 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
              Ao criar, horários padrões (08:00, 11:00, 14:00, 17:00, 20:00) serão gerados automaticamente.
            </p>
          </form>

          {/* Lista de Setores Existentes */}
          <div>
            <h4 className="font-bold text-slate-700 uppercase mb-2">
              Setores Atuais ({setores.length})
            </h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
              {setores.map((s) => {
                const isEditing = editingSetor?.id === s.id;

                return (
                  <div
                    key={s.id}
                    className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          className="flex-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-900 font-bold"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded font-bold hover:bg-emerald-700 cursor-pointer text-[11px]"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSetor(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer text-[11px]"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center font-mono">
                          {s.ordem}
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{s.nome}</p>
                          <span className="text-[10px] text-slate-400 font-mono">ID: {s.id}</span>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAtivo(s)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition flex items-center gap-1 cursor-pointer ${
                            s.ativo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {s.ativo ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ativo</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Inativo</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(s)}
                          className="p-1 rounded text-slate-400 hover:text-amber-800 hover:bg-amber-50 cursor-pointer"
                          title="Editar nome"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(s)}
                          className="p-1 rounded text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="Excluir setor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-end border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
