import React, { useState, useEffect, useMemo } from 'react';
import { IndicadoresData, Setor, Horario } from '../types';
import { api } from '../services/api';
import * as XLSX from 'xlsx';
import {
  TrendingDown,
  AlertTriangle,
  Clock,
  Layers,
  Flame,
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface DashboardProps {
  setores: Setor[];
}

export const Dashboard: React.FC<DashboardProps> = ({ setores }) => {
  const [periodoPreset, setPeriodoPreset] = useState<'hoje' | '7d' | '30d' | 'custom'>('7d');
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [selectedSetorId, setSelectedSetorId] = useState<string>('');
  const [selectedHorarioId, setSelectedHorarioId] = useState<string>('');
  const [horariosList, setHorariosList] = useState<Horario[]>([]);
  const [data, setData] = useState<IndicadoresData | null>(null);
  const [loading, setLoading] = useState(false);

  // Carregar lista de horários quando setor mudar
  useEffect(() => {
    api.getHorarios(selectedSetorId || undefined).then((res) => {
      setHorariosList(res);
    });
  }, [selectedSetorId]);

  // Atualizar datas com base no preset
  const handlePresetChange = (preset: 'hoje' | '7d' | '30d' | 'custom') => {
    setPeriodoPreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'hoje') {
      setDataInicio(todayStr);
      setDataFim(todayStr);
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(today.getDate() - 6);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(todayStr);
    } else if (preset === '30d') {
      const d = new Date();
      d.setDate(today.getDate() - 29);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(todayStr);
    }
  };

  const carregarIndicadores = () => {
    setLoading(true);
    api
      .getIndicadores({
        inicio: dataInicio,
        fim: dataFim,
        setor_id: selectedSetorId || undefined,
        horario_id: selectedHorarioId || undefined,
      })
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Erro ao carregar indicadores:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    carregarIndicadores();
  }, [dataInicio, dataFim, selectedSetorId, selectedHorarioId]);

  // Exportar dados completos para Excel (.xlsx) usando a biblioteca xlsx instalada
  const handleExportExcel = () => {
    if (!data) return;

    // Planilha 1: Resumo Geral
    const wsGeralData = [
      ['PADARIA PORTO DELICATÉSSEN - RELATÓRIO DE RUPTURA'],
      ['Período:', `${dataInicio} até ${dataFim}`],
      ['Setor:', selectedSetorId ? setores.find((s) => s.id === selectedSetorId)?.nome : 'Todos os Setores'],
      ['Gerado em:', new Date().toLocaleString('pt-BR')],
      [],
      ['INDICADORES PRINCIPAIS'],
      ['Índice Geral de Ruptura (%)', `${data.indiceGeral}%`],
      ['Total de Conferências Realizadas', data.totalAvaliados],
      ['Total de Rupturas Registradas', data.totalRupturas],
      ['Setor com Maior Ruptura', data.piorSetor ? `${data.piorSetor.nome} (${data.piorSetor.indice.toFixed(1)}%)` : 'N/A'],
      ['Horário Crítico', data.horarioCritico ? `${data.horarioCritico.horario} (${data.horarioCritico.indice.toFixed(1)}%)` : 'N/A'],
      ['Produto Mais Faltante', data.produtoMaisFaltante ? `${data.produtoMaisFaltante.nome} (${data.produtoMaisFaltante.indice.toFixed(1)}%)` : 'N/A'],
    ];
    const wsGeral = XLSX.utils.aoa_to_sheet(wsGeralData);

    // Planilha 2: Ranking de Produtos
    const wsProdutosData = [
      ['Código', 'Nome do Produto', 'Setor', 'Ranking Vendas', 'Vendas Qtd', 'Conferências', 'Faltas', 'Índice Ruptura (%)'],
      ...data.produtosRanking.map((p) => [
        p.codigo,
        p.nome,
        setores.find((s) => s.id === p.setor_id)?.nome || p.setor_id,
        p.ranking_vendas,
        p.vendas_qtd,
        p.total,
        p.rupturas,
        Number(p.indice.toFixed(1)),
      ]),
    ];
    const wsProdutos = XLSX.utils.aoa_to_sheet(wsProdutosData);

    // Planilha 3: Ruptura por Setor
    const wsSetoresData = [
      ['Setor', 'Total Conferências', 'Total Faltas', 'Índice de Ruptura (%)'],
      ...data.setoresRanking.map((s) => [
        s.nome,
        s.total,
        s.rupturas,
        Number(s.indice.toFixed(1)),
      ]),
    ];
    const wsSetores = XLSX.utils.aoa_to_sheet(wsSetoresData);

    // Criar Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsGeral, 'Resumo Geral');
    XLSX.utils.book_append_sheet(wb, wsProdutos, 'Ranking de Produtos');
    XLSX.utils.book_append_sheet(wb, wsSetores, 'Por Setor');

    // Salvar arquivo
    XLSX.writeFile(wb, `Porto_Relatorio_Ruptura_${dataInicio}_a_${dataFim}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper para cor do heatmap (taxa de 0% a 50%+)
  const getHeatmapColor = (indice: number, total: number) => {
    if (total === 0) return 'bg-slate-50 text-slate-300';
    if (indice === 0) return 'bg-emerald-50 text-emerald-700 font-medium';
    if (indice <= 10) return 'bg-amber-100 text-amber-900 font-semibold';
    if (indice <= 25) return 'bg-orange-200 text-orange-950 font-bold';
    return 'bg-rose-500 text-white font-extrabold';
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
      {/* Barra de Filtros e Ações de Exportação */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-100/80 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Presets e Datas */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              Período:
            </span>
            {(['hoje', '7d', '30d', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                  periodoPreset === p
                    ? 'bg-amber-800 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p === 'hoje'
                  ? 'Hoje'
                  : p === '7d'
                  ? 'Últimos 7 dias'
                  : p === '30d'
                  ? 'Últimos 30 dias'
                  : 'Personalizado'}
              </button>
            ))}

            <div className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPeriodoPreset('custom');
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
              />
              <span className="text-slate-400">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPeriodoPreset('custom');
                }}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Botões de Exportação */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <button
              onClick={handleExportExcel}
              disabled={!data}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Filtros de Setor e Horário */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold uppercase">
            <Filter className="w-3.5 h-3.5 text-amber-700" />
            <span>Filtros Específicos:</span>
          </div>

          <select
            value={selectedSetorId}
            onChange={(e) => setSelectedSetorId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="">Todos os Setores (Geral)</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>

          <select
            value={selectedHorarioId}
            onChange={(e) => setSelectedHorarioId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="">Todos os Horários</option>
            {Array.from(new Set(horariosList.map((h) => h.horario))).map((hour) => (
              <option key={hour} value={horariosList.find((h) => h.horario === hour)?.id}>
                {hour}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 CARDS PRINCIPAIS DE INDICADORES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Índice Geral de Ruptura */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Índice Geral de Ruptura
            </p>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-display text-slate-900">
              {data ? `${data.indiceGeral}%` : '--'}
            </span>
            <span className="text-xs text-slate-500">
              ({data ? `${data.totalRupturas} faltas / ${data.totalAvaliados} avaliações` : ''})
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (data?.indiceGeral || 0) > 15
                    ? 'bg-rose-500'
                    : (data?.indiceGeral || 0) > 7
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, (data?.indiceGeral || 0) * 3)}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>Meta: &lt; 5%</span>
              <span>Alerta: &gt; 10%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Setor com Maior Ruptura */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Setor Mais Crítico
            </p>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-slate-900 truncate">
              {data?.piorSetor ? data.piorSetor.nome : 'Sem dados suficientes'}
            </p>
            <p className="text-xs font-semibold text-rose-700 mt-0.5">
              {data?.piorSetor
                ? `${data.piorSetor.indice.toFixed(1)}% de falta (${data.piorSetor.rupturas} rupturas)`
                : '100% abastecido'}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Setor com maior frequência de itens zerados no período.
          </p>
        </div>

        {/* Card 3: Horário Crítico */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Horário Crítico
            </p>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold font-mono text-slate-900">
              {data?.horarioCritico ? data.horarioCritico.horario : 'N/A'}
            </p>
            <p className="text-xs font-semibold text-orange-700 mt-0.5">
              {data?.horarioCritico
                ? `${data.horarioCritico.indice.toFixed(1)}% de falta neste horário`
                : '--'}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Momento do dia com maior perda de presença em gôndola.
          </p>
        </div>

        {/* Card 4: Produto Mais Faltante */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Produto Mais Faltante
            </p>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm font-bold text-slate-900 truncate" title={data?.produtoMaisFaltante?.nome}>
              {data?.produtoMaisFaltante ? data.produtoMaisFaltante.nome : 'Nenhum'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold text-purple-700">
                {data?.produtoMaisFaltante ? `${data.produtoMaisFaltante.indice.toFixed(1)}% ruptura` : '--'}
              </span>
              {data?.produtoMaisFaltante && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                  {data.produtoMaisFaltante.ranking_vendas}º no ranking
                </span>
              )}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Item que mais vezes esteve com status 0 nas conferências.
          </p>
        </div>
      </div>

      {/* ALERTA CRÍTICO: PRODUTOS DE ALTO GIRO EM RUPTURA (Item 7 do briefing) */}
      {data && data.alertasAltoGiro && data.alertasAltoGiro.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300 rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-rose-950 flex items-center gap-2">
                  <span>Alerta de Perda de Vendas: Produtos de Alto Giro em Ruptura!</span>
                  <span className="text-xs font-extrabold bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Urgente
                  </span>
                </h3>
                <span className="text-xs text-rose-800 font-semibold">
                  {data.alertasAltoGiro.length} produto(s) campeões de venda com faltas frequentes
                </span>
              </div>
              <p className="text-xs text-rose-900 mt-1">
                Estes itens estão entre os mais vendidos da padaria (Top 5 do setor) e apresentam taxa de ruptura elevada. Cada hora sem esses produtos causa perda direta e imediata de faturamento!
              </p>

              {/* Lista dos produtos em alerta */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {data.alertasAltoGiro.map((item) => (
                  <div
                    key={item.produto_id}
                    className="bg-white/90 backdrop-blur-xs border border-rose-200 rounded-xl p-3 flex items-center justify-between shadow-2xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono">
                          {item.ranking_vendas}º Mais Vendido
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{item.codigo}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate mt-1">
                        {item.nome}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {item.vendas_qtd} vendas registradas
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-rose-600">
                        {item.indice.toFixed(1)}%
                      </span>
                      <p className="text-[9px] text-rose-700 uppercase font-semibold">de ruptura</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRÁFICO DE EVOLUÇÃO DIÁRIA E COMPARAÇÃO */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Evolução Diária do Índice de Ruptura (%)
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhamento da taxa de falta dia a dia no período selecionado
            </p>
          </div>
          <span className="text-xs text-slate-400">Meta: 0% ruptura</span>
        </div>

        {data && data.evolucaoDiaria && data.evolucaoDiaria.length > 0 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {data.evolucaoDiaria.map((d) => {
                const [_, m, dia] = d.data.split('-');
                const ind = d.indice;
                return (
                  <div
                    key={d.data}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center hover:border-amber-400 transition"
                  >
                    <p className="text-[11px] font-semibold text-slate-500 font-mono">
                      {dia}/{m}
                    </p>
                    <div className="h-16 flex items-end justify-center my-2">
                      <div
                        className={`w-8 rounded-t-md transition-all ${
                          ind > 15
                            ? 'bg-rose-500'
                            : ind > 7
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ height: `${Math.max(12, Math.min(100, ind * 2.5))}%` }}
                        title={`${d.data}: ${ind.toFixed(1)}% (${d.rupturas} faltas)`}
                      />
                    </div>
                    <p className="text-sm font-bold text-slate-800 font-mono">{ind.toFixed(1)}%</p>
                    <p className="text-[10px] text-slate-400">{d.total} conf.</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 text-xs">
            Nenhum dado diário disponível para o período selecionado.
          </div>
        )}
      </div>

      {/* MAPA DE CALOR: PRODUTO X HORÁRIO (Heatmap) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span>Mapa de Calor: Produto × Horário de Conferência</span>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                Heatmap
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Identifique instantaneamente quais produtos faltam e em quais horários específicos
            </p>
          </div>

          {/* Legenda do Heatmap */}
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 mr-1">Ruptura:</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">0%</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">&lt;10%</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-200 text-orange-950 font-bold">&lt;25%</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold">&gt;25%</span>
          </div>
        </div>

        {data && data.heatmap && data.heatmap.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-bold text-slate-700 uppercase min-w-[200px]">
                    Produto
                  </th>
                  {Array.from(new Set(horariosList.map((h) => h.horario))).map((hour) => (
                    <th key={hour} className="py-2.5 px-2 text-center font-bold text-slate-700 font-mono">
                      {hour}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.heatmap.map((item) => {
                  return (
                    <tr key={item.produto_id} className="hover:bg-slate-50/70">
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {item.ranking}º
                          </span>
                          <span className="truncate">{item.produto_nome}</span>
                        </div>
                      </td>
                      {Array.from(new Set(horariosList.map((h) => h.horario))).map((hour) => {
                        const hData = item.horarios[hour] || { total: 0, rupturas: 0, indice: 0 };
                        const colorClass = getHeatmapColor(hData.indice, hData.total);
                        return (
                          <td key={hour} className="p-1.5 text-center">
                            <div
                              className={`py-1.5 px-2 rounded-lg font-mono text-[11px] transition ${colorClass}`}
                              title={`${item.produto_nome} às ${hour}: ${hData.indice.toFixed(1)}% (${hData.rupturas} faltas / ${hData.total} testes)`}
                            >
                              {hData.total > 0 ? `${hData.indice.toFixed(0)}%` : '-'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400 text-xs">
            Nenhum dado disponível para compor o mapa de calor.
          </div>
        )}
      </div>

      {/* DUAS COLUNAS: RANKING DE RUPTURA POR SETOR E RANKING DE PRODUTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Setores */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">
            Índice de Ruptura por Setor
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Comparativo de desempenho entre as áreas da Porto delicatéssen
          </p>

          <div className="space-y-3">
            {data?.setoresRanking.map((s, idx) => {
              return (
                <div key={s.setor_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-500 font-mono">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm">
                        {s.nome}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        s.indice > 15
                          ? 'bg-rose-100 text-rose-800'
                          : s.indice > 7
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {s.indice.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s.indice > 15 ? 'bg-rose-500' : s.indice > 7 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, s.indice * 2.5)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>{s.rupturas} produtos faltantes</span>
                    <span>{s.total} conferências realizadas</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ranking dos Produtos com Maior Ruptura */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">
            Top Produtos com Maior Ruptura
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Itens que exigem ajuste imediato no plano de abastecimento
          </p>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {data?.produtosRanking.slice(0, 10).map((p, idx) => {
              return (
                <div
                  key={p.produto_id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{p.nome}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="font-mono">{p.codigo}</span>
                        <span>•</span>
                        <span>{p.ranking_vendas}º em vendas</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        p.indice > 20
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {p.indice.toFixed(1)}%
                    </span>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {p.rupturas} / {p.total} conf.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
