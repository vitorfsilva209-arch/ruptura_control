import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Setor, Horario, Produto, Lancamento } from '../types';
import { api } from '../services/api';
import {
  Calendar,
  CheckCheck,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  User,
  Info,
  Check,
  X,
  TrendingDown,
  Layers,
  Plus,
} from 'lucide-react';

interface LancamentoGridProps {
  setores: Setor[];
  onOpenSetoresModal?: () => void;
}

export const LancamentoGrid: React.FC<LancamentoGridProps> = ({ setores, onOpenSetoresModal }) => {
  const { user, canAccessSector, canManageProducts } = useAuth();

  // Filtrar setores disponíveis conforme permissão do usuário
  const setoresPermitidos = useMemo(() => {
    return setores.filter((s) => s.ativo && canAccessSector(s.id));
  }, [setores, canAccessSector]);

  const [selectedSetorId, setSelectedSetorId] = useState<string>(() => {
    return setoresPermitidos[0]?.id || 'padaria';
  });

  // Atualizar setor selecionado se o atual não for permitido
  useEffect(() => {
    if (setoresPermitidos.length > 0 && !setoresPermitidos.some((s) => s.id === selectedSetorId)) {
      setSelectedSetorId(setoresPermitidos[0].id);
    }
  }, [setoresPermitidos, selectedSetorId]);

  // Data do lançamento (default: data atual no fuso local)
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [responsavelNome, setResponsavelNome] = useState<string>(user?.nome || 'Operador');

  // Dados do setor ativo
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Carregar horários e produtos do setor
  useEffect(() => {
    if (!selectedSetorId) return;

    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.getHorarios(selectedSetorId),
      api.getProdutos(selectedSetorId, true),
      api.getLancamentos(selectedDate, selectedSetorId),
    ])
      .then(([hList, pList, lList]) => {
        if (!isMounted) return;
        setHorarios(hList.filter((h) => h.ativo));
        setProdutos(pList);
        setLancamentos(lList);
      })
      .catch((err) => {
        console.error('Erro ao carregar dados da grade:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSetorId, selectedDate]);

  // Mapa rápido de lançamentos: key = `${produto_id}_${horario_id}`
  const lancamentosMap = useMemo(() => {
    const map = new Map<string, Lancamento>();
    lancamentos.forEach((l) => {
      map.set(`${l.produto_id}_${l.horario_id}`, l);
    });
    return map;
  }, [lancamentos]);

  // Estatísticas rápidas do dia e setor
  const stats = useMemo(() => {
    let totalPreenchidos = 0;
    let totalRupturas = 0; // 0
    let totalDisponiveis = 0; // 1

    lancamentos.forEach((l) => {
      totalPreenchidos++;
      if (l.valor === 0) totalRupturas++;
      if (l.valor === 1) totalDisponiveis++;
    });

    const taxaRuptura = totalPreenchidos > 0 ? (totalRupturas / totalPreenchidos) * 100 : 0;
    const totalPossiveis = produtos.length * horarios.length;
    const progresso = totalPossiveis > 0 ? (totalPreenchidos / totalPossiveis) * 100 : 0;

    return {
      totalPreenchidos,
      totalRupturas,
      totalDisponiveis,
      taxaRuptura,
      totalPossiveis,
      progresso,
    };
  }, [lancamentos, produtos, horarios]);

  // Filtragem de produtos por busca
  const produtosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return produtos;
    const term = searchTerm.toLowerCase();
    return produtos.filter(
      (p) => p.nome.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term)
    );
  }, [produtos, searchTerm]);

  // Alternar valor da célula: vazio (-) -> 1 -> 0 -> vazio
  const handleToggleCell = async (produtoId: string, horarioId: string) => {
    const key = `${produtoId}_${horarioId}`;
    setSavingCellKey(key);

    const currentLanc = lancamentosMap.get(key);
    let nextVal: number | null = 1; // default para primeiro clique: tem produto (1)

    if (currentLanc !== undefined) {
      if (currentLanc.valor === 1) {
        nextVal = 0; // segundo clique: ruptura (0)
      } else if (currentLanc.valor === 0) {
        nextVal = null; // terceiro clique: limpa/desmarca
      }
    }

    // Atualização otimista imediata na UI
    if (nextVal === null) {
      setLancamentos((prev) => prev.filter((l) => !(l.produto_id === produtoId && l.horario_id === horarioId)));
    } else {
      const updatedLanc: Lancamento = {
        id: `${selectedDate}_${produtoId}_${horarioId}`,
        data: selectedDate,
        setor_id: selectedSetorId,
        produto_id: produtoId,
        horario_id: horarioId,
        valor: nextVal,
        usuario_id: user?.id || 'usr_operador',
        usuario_nome: responsavelNome || user?.nome || 'Operador',
        timestamp: new Date().toISOString(),
      };
      setLancamentos((prev) => {
        const filtered = prev.filter((l) => !(l.produto_id === produtoId && l.horario_id === horarioId));
        return [...filtered, updatedLanc];
      });
    }

    try {
      await api.saveLancamento({
        data: selectedDate,
        setor_id: selectedSetorId,
        produto_id: produtoId,
        horario_id: horarioId,
        valor: nextVal,
        usuario_id: user?.id || 'usr_operador',
        usuario_nome: responsavelNome || user?.nome || 'Operador',
      });
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSavingCellKey(null);
    }
  };

  // Botão "Marcar tudo como 1" para a coluna inteira de um horário
  const handleMarcarTudoComo1 = async (horarioId: string, horarioLabel: string) => {
    const confirmou = window.confirm(
      `Deseja marcar todos os ${produtos.length} produtos do horário ${horarioLabel} como DISPONÍVEIS (1)?`
    );
    if (!confirmou) return;

    const novosLancamentos = produtos.map((p) => ({
      data: selectedDate,
      setor_id: selectedSetorId,
      produto_id: p.id,
      horario_id: horarioId,
      valor: 1,
      usuario_id: user?.id || 'usr_operador',
      usuario_nome: responsavelNome || user?.nome || 'Operador',
    }));

    // Otimista
    setLancamentos((prev) => {
      const outros = prev.filter((l) => l.horario_id !== horarioId);
      const novosCompletos: Lancamento[] = novosLancamentos.map((n) => ({
        ...n,
        id: `${n.data}_${n.produto_id}_${n.horario_id}`,
        timestamp: new Date().toISOString(),
      }));
      return [...outros, ...novosCompletos];
    });

    setStatusFeedback(`Horário ${horarioLabel}: todos marcados como 1!`);
    setTimeout(() => setStatusFeedback(null), 3000);

    try {
      await api.saveLancamentosBatch(novosLancamentos);
    } catch (err) {
      console.error('Erro ao marcar lote:', err);
    }
  };

  // Navegar dias
  const handleMudarDia = (diasDelta: number) => {
    const current = new Date(selectedDate + 'T12:00:00');
    current.setDate(current.getDate() + diasDelta);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${y}-${m}-${d}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Barra de Controles Superiores */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-100/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Seletor de Data e Navegação */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => handleMudarDia(-1)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                title="Dia anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-800">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent font-bold focus:outline-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => handleMudarDia(1)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                title="Próximo dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                selectedDate === getTodayStr()
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Hoje
            </button>
          </div>

          {/* Responsável pelo Lançamento */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900">
              <User className="w-3.5 h-3.5 text-amber-700" />
              <span className="font-semibold text-slate-600">Responsável:</span>
              <input
                type="text"
                value={responsavelNome}
                onChange={(e) => setResponsavelNome(e.target.value)}
                placeholder="Nome do operador"
                className="bg-transparent font-bold text-amber-950 focus:outline-none w-32 sm:w-40"
              />
            </div>

            {statusFeedback && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-fadeIn">
                {statusFeedback}
              </span>
            )}
          </div>
        </div>

        {/* Abas de Setores com visual de Padaria Porto */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {setoresPermitidos.map((s) => {
              const isSelected = selectedSetorId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSetorId(s.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isSelected
                      ? 'bg-amber-800 text-white shadow-sm shadow-amber-900/20'
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
      </div>

      {/* Barra de Indicadores Rápidos do Dia Selecionado */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Índice de Ruptura</p>
            <p className="text-xl font-bold font-display text-slate-900 mt-0.5">
              {stats.taxaRuptura.toFixed(1)}%
            </p>
          </div>
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              stats.taxaRuptura > 15
                ? 'bg-rose-100 text-rose-700'
                : stats.taxaRuptura > 5
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Produtos em Falta (0)</p>
            <p className="text-xl font-bold font-display text-rose-700 mt-0.5">
              {stats.totalRupturas}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold text-sm">
            0
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Disponíveis (1)</p>
            <p className="text-xl font-bold font-display text-emerald-700 mt-0.5">
              {stats.totalDisponiveis}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
            1
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Conferências Feitas</p>
            <p className="text-xl font-bold font-display text-slate-900 mt-0.5">
              {stats.totalPreenchidos} / {stats.totalPossiveis}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold text-xs">
            {stats.progresso.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Legenda & Barra de Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        {/* Legenda das Cores da Grade */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-500 text-[11px] uppercase">Legenda:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
              1
            </span>
            <span className="text-slate-700 font-medium">Tem produto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-rose-500 text-white font-bold text-xs flex items-center justify-center">
              0
            </span>
            <span className="text-slate-700 font-medium">Ruptura (Falta)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-500 font-bold text-xs flex items-center justify-center">
              -
            </span>
            <span className="text-slate-500">Pendente</span>
          </div>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar produto por nome ou código..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 text-slate-900"
          />
        </div>
      </div>

      {/* GRADE DE CONFERÊNCIA (GRID PRINCIPAL) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Carregando grade de conferência...</p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-base font-semibold">Nenhum produto encontrado neste setor.</p>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre novos itens na aba "Produtos & Ranking".
            </p>
          </div>
        ) : horarios.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-base font-semibold">Nenhum horário cadastrado para este setor.</p>
            <p className="text-xs text-slate-400 mt-1">
              Configure os horários na aba "Horários".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  {/* Coluna de Produto fixa à esquerda */}
                  <th className="py-3 px-3 sm:px-4 text-xs font-bold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-100 z-10 min-w-[200px] sm:min-w-[260px] shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between">
                      <span>Produto (Ranking de Vendas)</span>
                      <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-mono">
                        {produtosFiltrados.length} itens
                      </span>
                    </div>
                  </th>

                  {/* Colunas de Horários com Botão 'Marcar Tudo 1' */}
                  {horarios.map((h) => (
                    <th
                      key={h.id}
                      className="py-3 px-2 sm:px-3 text-center border-l border-slate-200 min-w-[100px] sm:min-w-[120px]"
                    >
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-extrabold text-slate-800 font-mono tracking-tight">
                          {h.horario}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMarcarTudoComo1(h.id, h.horario)}
                          className="mt-1.5 px-2 py-1 rounded-md text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-2xs border border-emerald-300"
                          title={`Marcar todos os produtos das ${h.horario} como 1`}
                        >
                          <CheckCheck className="w-3 h-3 text-emerald-700" />
                          <span>Tudo 1</span>
                        </button>
                      </div>
                    </th>
                  ))}

                  {/* Coluna de Resumo da Linha */}
                  <th className="py-3 px-3 text-center border-l border-slate-200 min-w-[90px] text-xs font-bold text-slate-600 uppercase">
                    Ruptura
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {produtosFiltrados.map((prod) => {
                  // Calcular índice de ruptura da linha do produto hoje
                  let linhaTotal = 0;
                  let linhaRupturas = 0;

                  horarios.forEach((h) => {
                    const l = lancamentosMap.get(`${prod.id}_${h.id}`);
                    if (l !== undefined) {
                      linhaTotal++;
                      if (l.valor === 0) linhaRupturas++;
                    }
                  });

                  const linhaIndice = linhaTotal > 0 ? (linhaRupturas / linhaTotal) * 100 : 0;
                  const isTopVendido = prod.ranking <= 3;

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-amber-50/30 transition-colors group"
                    >
                      {/* Nome e Dados do Produto */}
                      <td className="py-2.5 px-3 sm:px-4 sticky left-0 bg-white group-hover:bg-amber-50/40 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                              isTopVendido
                                ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                            title={`Posição ${prod.ranking}º no ranking de vendas`}
                          >
                            {prod.ranking}º
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                              {prod.nome}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono">{prod.codigo}</span>
                              <span>•</span>
                              <span>{prod.vendas_qtd} vendas</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Células de Conferência por Horário (BOTÕES GRANDES TOUCH) */}
                      {horarios.map((h) => {
                        const cellKey = `${prod.id}_${h.id}`;
                        const lanc = lancamentosMap.get(cellKey);
                        const isSaving = savingCellKey === cellKey;

                        let bgClass = 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200';
                        let label = '-';
                        let desc = 'Não conferido (Toque para marcar 1)';

                        if (lanc !== undefined) {
                          if (lanc.valor === 1) {
                            bgClass = 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-sm shadow-emerald-700/20';
                            label = '1';
                            desc = `Disponível (Por ${lanc.usuario_nome})`;
                          } else if (lanc.valor === 0) {
                            bgClass = 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700 shadow-sm shadow-rose-700/20';
                            label = '0';
                            desc = `RUPTURA / EM FALTA (Por ${lanc.usuario_nome})`;
                          }
                        }

                        return (
                          <td
                            key={h.id}
                            className="p-1 sm:p-2 text-center border-l border-slate-100 align-middle"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleCell(prod.id, h.id)}
                              title={desc}
                              className={`w-full max-w-[80px] h-12 sm:h-14 mx-auto rounded-xl border text-base sm:text-lg font-bold flex flex-col items-center justify-center transition-all cursor-pointer cell-touch-active ${bgClass} ${
                                isSaving ? 'opacity-50 scale-95' : ''
                              }`}
                            >
                              <span>{label}</span>
                              <span className="text-[9px] uppercase font-normal tracking-tight opacity-80 leading-none mt-0.5">
                                {label === '1' ? 'Tem' : label === '0' ? 'Falta' : 'Vazio'}
                              </span>
                            </button>
                          </td>
                        );
                      })}

                      {/* Resumo da Ruptura do Produto no Dia */}
                      <td className="py-2.5 px-3 text-center border-l border-slate-100">
                        {linhaTotal > 0 ? (
                          <span
                            className={`inline-block px-2 py-1 rounded-md text-xs font-bold font-mono ${
                              linhaIndice > 20
                                ? 'bg-rose-100 text-rose-800'
                                : linhaIndice > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {linhaIndice.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé explicativo do Grid */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Dica rápida:</strong> Toque na célula para alternar: <strong>1</strong> (Tem produto) ➜ <strong>0</strong> (Falta/Ruptura) ➜ <strong>-</strong> (Limpar).
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">
            Lançamentos salvos automaticamente no banco de dados.
          </span>
        </div>
      </div>
    </div>
  );
};
