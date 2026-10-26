import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Horario, Setor } from '../types';
import { api } from '../services/api';
import {
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Layers,
  Info,
  AlertCircle,
} from 'lucide-react';

interface HorariosManagerProps {
  setores: Setor[];
  onOpenSetoresModal?: () => void;
}

export const HorariosManager: React.FC<HorariosManagerProps> = ({ setores, onOpenSetoresModal }) => {
  const { canManageSchedules, canManageProducts } = useAuth();
  const [selectedSetorId, setSelectedSetorId] = useState<string>('padaria');
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(false);

  // Formulário de novo horário
  const [novoHorarioStr, setNovoHorarioStr] = useState('08:00');
  const [error, setError] = useState<string | null>(null);

  const carregarHorarios = () => {
    setLoading(true);
    api
      .getHorarios(selectedSetorId)
      .then((res) => {
        setHorarios(res);
      })
      .catch((err) => {
        console.error('Erro ao carregar horários:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    carregarHorarios();
  }, [selectedSetorId]);

  const handleAddHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validação de formato HH:MM
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!regex.test(novoHorarioStr)) {
      setError('Formato inválido. Use HH:MM (ex: 09:30).');
      return;
    }

    try {
      await api.createHorario(selectedSetorId, novoHorarioStr);
      setNovoHorarioStr('');
      carregarHorarios();
    } catch (err: any) {
      setError(err.message || 'Erro ao cadastrar horário.');
    }
  };

  const handleToggleAtivo = async (h: Horario) => {
    try {
      await api.updateHorario(h.id, { ativo: !h.ativo });
      carregarHorarios();
    } catch (err) {
      alert('Erro ao atualizar status do horário.');
    }
  };

  const handleDelete = async (id: string, hora: string) => {
    const confirmou = window.confirm(
      `Deseja realmente remover o horário ${hora} do setor ${
        setores.find((s) => s.id === selectedSetorId)?.nome
      }?`
    );
    if (!confirmou) return;

    try {
      await api.deleteHorario(id);
      carregarHorarios();
    } catch (err) {
      alert('Erro ao excluir horário.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header e Seleção de Setor */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-100/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
              Horários de Conferência de Ruptura
            </h2>
            <p className="text-xs text-slate-500">
              Configure as rodadas de inspeção diárias para cada setor de produção.
            </p>
          </div>
        </div>

        {/* Abas de Setores */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {setores.map((s) => {
            const isSelected = selectedSetorId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSetorId(s.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-900 border border-slate-200/70'
                }`}
              >
                <Layers className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-200' : 'text-slate-400'}`} />
                <span>{s.nome}</span>
              </button>
            );
          })}

          {canManageProducts && onOpenSetoresModal && (
            <button
              type="button"
              onClick={onOpenSetoresModal}
              className="px-3 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Cadastrar ou gerenciar setores"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700" />
              <span>+ Setor</span>
            </button>
          )}
        </div>
      </div>

      {/* Formulário de Adição de Horário */}
      {canManageSchedules && (
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-700" />
            Adicionar Novo Horário para {setores.find((s) => s.id === selectedSetorId)?.nome}
          </h3>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAddHorario} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="time"
                  value={novoHorarioStr}
                  onChange={(e) => setNovoHorarioStr(e.target.value)}
                  className="pl-9 pr-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 transition cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Horário</span>
            </button>
          </form>
        </div>
      )}

      {/* Lista de Horários do Setor */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase">
            Horários Cadastrados ({horarios.length})
          </span>
          <span className="text-[11px] text-slate-500">
            Estes horários formam as colunas na tela de Lançamento e na Folha Semanal.
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Carregando horários...</div>
        ) : horarios.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            Nenhum horário cadastrado para este setor.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {horarios.map((h, idx) => {
              return (
                <div
                  key={h.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold font-mono flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span className="text-base font-extrabold font-mono text-slate-900 tracking-tight">
                        {h.horario}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAtivo(h)}
                      disabled={!canManageSchedules}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase transition flex items-center gap-1 cursor-pointer disabled:cursor-default ${
                        h.ativo
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                      }`}
                      title={h.ativo ? 'Clique para desativar' : 'Clique para ativar'}
                    >
                      {h.ativo ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ativo</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Inativo</span>
                        </>
                      )}
                    </button>

                    {canManageSchedules && (
                      <button
                        type="button"
                        onClick={() => handleDelete(h.id, h.horario)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Excluir horário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
