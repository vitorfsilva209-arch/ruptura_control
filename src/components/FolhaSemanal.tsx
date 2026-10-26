import React, { useState, useEffect } from 'react';
import { FolhaSemanalData, Setor } from '../types';
import { api } from '../services/api';
import * as XLSX from 'xlsx';
import {
  CalendarDays,
  Printer,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface FolhaSemanalProps {
  setores: Setor[];
}

export const FolhaSemanal: React.FC<FolhaSemanalProps> = ({ setores }) => {
  const [selectedSetorId, setSelectedSetorId] = useState<string>('padaria');

  // Segunda-feira da semana atual
  const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const [inicioSemana, setInicioSemana] = useState<string>(getMondayOfCurrentWeek());
  const [data, setData] = useState<FolhaSemanalData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getFolhaSemanal(selectedSetorId, inicioSemana)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Erro ao carregar folha semanal:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedSetorId, inicioSemana]);

  const handleNavegarSemana = (semanasDelta: number) => {
    const d = new Date(inicioSemana + 'T12:00:00');
    d.setDate(d.getDate() + semanasDelta * 7);
    setInicioSemana(d.toISOString().split('T')[0]);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!data) return;

    const setorNome = data.setor?.nome || selectedSetorId;
    const headerRow1 = ['Código', 'Produto', 'Ranking'];
    const headerRow2 = ['', '', ''];

    data.diasSemana.forEach((dia) => {
      data.horarios.forEach((h, hIdx) => {
        if (hIdx === 0) {
          headerRow1.push(`${dia.diaSemana} (${dia.label})`);
        } else {
          headerRow1.push('');
        }
        headerRow2.push(h.horario);
      });
    });

    headerRow1.push('Total Conf.', 'Rupturas', '% Ruptura');
    headerRow2.push('', '', '');

    const rowsData = data.linhas.map((l) => {
      const row: any[] = [l.codigo, l.nome, l.ranking];
      l.dias.forEach((dia) => {
        dia.celulas.forEach((c) => {
          row.push(c.valor !== null ? c.valor : '');
        });
      });
      row.push(l.totalAvaliados, l.totalRupturas, `${l.indiceRuptura}%`);
      return row;
    });

    const sheetData = [
      ['PADARIA PORTO DELICATÉSSEN - FOLHA DE ACOMPANHAMENTO SEMANAL DE RUPTURA'],
      [`Setor: ${setorNome}`, `Semana de ${data.diasSemana[0]?.label} a ${data.diasSemana[6]?.label}`],
      [],
      headerRow1,
      headerRow2,
      ...rowsData,
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Folha_${setorNome.substring(0, 15)}`);
    XLSX.writeFile(wb, `Porto_Folha_Semanal_${setorNome}_${inicioSemana}.xlsx`);
  };

  const setorAtual = setores.find((s) => s.id === selectedSetorId);

  return (
    <div className="max-w-[98%] mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Controles de Topo (Ocultados na Impressão) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-100/80 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Setor */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase">Setor:</label>
              <select
                value={selectedSetorId}
                onChange={(e) => setSelectedSetorId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
              >
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Navegador de Semana */}
            <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => handleNavegarSemana(-1)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                title="Semana anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-slate-800">
                <CalendarDays className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  Semana: {data?.diasSemana[0]?.label} a {data?.diasSemana[6]?.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleNavegarSemana(1)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition cursor-pointer"
                title="Próxima semana"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setInicioSemana(getMondayOfCurrentWeek())}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              Semana Atual
            </button>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={!data}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exportar Excel (.xlsx)</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Folha A4</span>
            </button>
          </div>
        </div>
      </div>

      {/* CABEÇALHO DA FOLHA IMPRESSA */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 print-sheet">
        <div className="border-b-2 border-slate-800 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/Emblema_Vintage_Porto_Primo_Delicatessen_d1445651.png"
              alt="Porto Primo Delicatessen"
              className="w-14 sm:w-16 h-auto shrink-0 drop-shadow-xs"
            />
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display uppercase tracking-tight text-slate-900">
                Padaria Porto Primo Delicatéssen
              </h2>
              <p className="text-xs font-bold text-amber-900 uppercase tracking-widest mt-0.5">
                Acompanhamento Semanal de Ruptura de Gôndola
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-800">
              Setor: <span className="text-amber-800">{setorAtual?.nome}</span>
            </p>
            <p className="text-slate-500 font-mono">
              Período: {data?.diasSemana[0]?.label} até {data?.diasSemana[6]?.label}
            </p>
          </div>
        </div>

        {/* TABELA NO FORMATO FOLHA DE PRANCHETA */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Carregando folha semanal...</p>
          </div>
        ) : !data || data.linhas.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Nenhum dado encontrado para este setor nesta semana.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                {/* Linha 1 de Cabeçalho: Dias da Semana */}
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th
                    rowSpan={2}
                    className="py-2 px-2.5 text-left font-bold text-slate-700 uppercase border-r border-slate-300 sticky left-0 bg-slate-100 z-10 min-w-[170px]"
                  >
                    Produto (Mais Vendidos)
                  </th>

                  {data.diasSemana.map((dia) => (
                    <th
                      key={dia.data}
                      colSpan={data.horarios.length}
                      className="py-1.5 px-1 text-center font-bold text-slate-800 border-r border-slate-300 bg-amber-50/70"
                    >
                      <span className="block font-bold">{dia.diaSemana}</span>
                      <span className="text-[10px] text-slate-500 font-normal font-mono">
                        {dia.label}
                      </span>
                    </th>
                  ))}

                  <th
                    colSpan={3}
                    className="py-1.5 px-2 text-center font-bold text-slate-800 bg-slate-200"
                  >
                    Resumo Semanal
                  </th>
                </tr>

                {/* Linha 2 de Cabeçalho: Horários de cada dia */}
                <tr className="bg-slate-50 border-b border-slate-300">
                  {data.diasSemana.map((dia) =>
                    data.horarios.map((h, hIdx) => (
                      <th
                        key={`${dia.data}_${h.id}`}
                        className={`py-1 px-1 text-center font-bold font-mono text-[10px] text-slate-600 ${
                          hIdx === data.horarios.length - 1 ? 'border-r border-slate-300' : 'border-r border-slate-200'
                        }`}
                      >
                        {h.horario.substring(0, 5)}
                      </th>
                    ))
                  )}
                  <th className="py-1 px-1.5 text-center font-bold text-[10px] text-slate-600 border-r border-slate-200">
                    Conf.
                  </th>
                  <th className="py-1 px-1.5 text-center font-bold text-[10px] text-slate-600 border-r border-slate-200">
                    Faltas
                  </th>
                  <th className="py-1 px-1.5 text-center font-bold text-[10px] text-slate-600">
                    % Ruptura
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {data.linhas.map((linha, lIdx) => {
                  return (
                    <tr
                      key={linha.produto_id}
                      className={`hover:bg-amber-50/40 ${lIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                    >
                      {/* Produto */}
                      <td className="py-1.5 px-2 font-medium text-slate-900 border-r border-slate-300 sticky left-0 bg-inherit z-10 truncate max-w-[220px]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                            {linha.ranking}
                          </span>
                          <span className="truncate font-semibold">{linha.nome}</span>
                        </div>
                      </td>

                      {/* Células de cada dia e horário */}
                      {linha.dias.map((dia) =>
                        dia.celulas.map((c, cIdx) => {
                          const isLastHour = cIdx === dia.celulas.length - 1;
                          let cellContent = '-';
                          let cellStyle = 'text-slate-300';

                          if (c.valor === 1) {
                            cellContent = '1';
                            cellStyle = 'bg-emerald-50 text-emerald-800 font-bold';
                          } else if (c.valor === 0) {
                            cellContent = '0';
                            cellStyle = 'bg-rose-100 text-rose-800 font-extrabold';
                          }

                          return (
                            <td
                              key={`${dia.data}_${c.horario_id}`}
                              className={`py-1 px-0.5 text-center font-mono text-[10px] ${cellStyle} ${
                                isLastHour ? 'border-r border-slate-300' : 'border-r border-slate-100'
                              }`}
                            >
                              {cellContent}
                            </td>
                          );
                        })
                      )}

                      {/* Totais do Produto */}
                      <td className="py-1 px-1.5 text-center font-mono border-r border-slate-200 text-slate-600">
                        {linha.totalAvaliados}
                      </td>
                      <td className="py-1 px-1.5 text-center font-mono font-bold border-r border-slate-200 text-rose-700">
                        {linha.totalRupturas}
                      </td>
                      <td className="py-1 px-1.5 text-center font-mono font-extrabold">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            linha.indiceRuptura > 15
                              ? 'bg-rose-100 text-rose-800'
                              : linha.indiceRuptura > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {linha.indiceRuptura}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da Folha */}
        <div className="mt-4 pt-3 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-500">
          <div>
            <span>1 = Tem Produto (Disponível) | 0 = Ruptura (Falta) | - = Não Realizado</span>
          </div>
          <div>
            <span>Assinatura do Encarregado: ___________________________________</span>
          </div>
        </div>
      </div>
    </div>
  );
};
