import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Produto, Setor } from '../types';
import { api } from '../services/api';
import * as XLSX from 'xlsx';
import {
  Plus,
  Upload,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  AlertCircle,
  Search,
} from 'lucide-react';

interface ProdutosManagerProps {
  setores: Setor[];
  onOpenSetoresModal?: () => void;
}

export const ProdutosManager: React.FC<ProdutosManagerProps> = ({ setores, onOpenSetoresModal }) => {
  const { canManageProducts } = useAuth();
  const [selectedSetorId, setSelectedSetorId] = useState<string>('padaria');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);

  // Formulário de produto
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formVendas, setFormVendas] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Texto para importação em massa
  const [importText, setImportText] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const carregarProdutos = () => {
    setLoading(true);
    api
      .getProdutos(selectedSetorId, false) // incluir inativos para gerenciamento
      .then((res) => {
        setProdutos(res);
      })
      .catch((err) => {
        console.error('Erro ao carregar produtos:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    carregarProdutos();
  }, [selectedSetorId]);

  const handleOpenAdd = () => {
    setFormCodigo('');
    setFormNome('');
    setFormVendas(0);
    setFormStatus(true);
    setFormError(null);
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Produto) => {
    setEditingProduct(p);
    setFormCodigo(p.codigo);
    setFormNome(p.nome);
    setFormVendas(p.vendas_qtd);
    setFormStatus(p.ativo);
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim() || !formCodigo.trim()) {
      setFormError('Código e nome do produto são obrigatórios.');
      return;
    }

    try {
      if (editingProduct) {
        await api.updateProduto(editingProduct.id, {
          codigo: formCodigo,
          nome: formNome,
          vendas_qtd: Number(formVendas),
          ativo: formStatus,
        });
      } else {
        await api.createProduto({
          codigo: formCodigo,
          nome: formNome,
          setor_id: selectedSetorId,
          vendas_qtd: Number(formVendas),
        });
      }
      setShowAddModal(false);
      carregarProdutos();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar produto.');
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    const confirmou = window.confirm(`Deseja desativar o produto "${nome}"?`);
    if (!confirmou) return;

    try {
      await api.deleteProduto(id);
      carregarProdutos();
    } catch (err) {
      alert('Erro ao inativar produto.');
    }
  };

  // Reordenação manual
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= produtos.length) return;

    const newOrder = [...produtos];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setProdutos(newOrder);

    try {
      await api.reorderProdutos(
        selectedSetorId,
        newOrder.map((p) => p.id)
      );
      carregarProdutos();
    } catch (err) {
      console.error('Erro ao reordenar:', err);
    }
  };

  // Importar planilha / CSV
  const handleProcessImport = async () => {
    if (!importText.trim()) return;

    try {
      const lines = importText.trim().split('\n');
      const itens: any[] = [];

      lines.forEach((line) => {
        // Suporta separador por vírgula, ponto e vírgula ou tab
        const parts = line.split(/[;,\t]/).map((s) => s.trim());
        if (parts.length >= 2) {
          // Ignorar cabeçalho se houver
          if (parts[0].toLowerCase() === 'codigo' || parts[0].toLowerCase() === 'código') return;
          itens.push({
            codigo: parts[0],
            nome: parts[1],
            vendas: parts[2] ? parseInt(parts[2], 10) : 0,
          });
        }
      });

      if (itens.length === 0) {
        setImportFeedback('Nenhum item válido identificado no formato Código, Nome, Vendas.');
        return;
      }

      const res = await api.importProdutos(selectedSetorId, itens);
      setImportFeedback(`Sucesso! ${res.importados} novos cadastrados e ${res.atualizados} atualizados com ranking recalculado!`);
      setTimeout(() => {
        setShowImportModal(false);
        setImportFeedback(null);
        setImportText('');
        carregarProdutos();
      }, 1500);
    } catch (err: any) {
      setImportFeedback(err.message || 'Erro ao importar itens.');
    }
  };

  // Upload de arquivo .xlsx ou .csv
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        const itens = rawJson.map((r) => ({
          codigo: r.codigo || r.Codigo || r.CÓDIGO || r.CODIGO || '',
          nome: r.nome || r.Nome || r.NOME || r.produto || r.Produto || '',
          vendas: r.vendas || r.Vendas || r.quantidade || r.Quantidade || 0,
        })).filter((i) => i.nome);

        if (itens.length === 0) {
          alert('Nenhum produto válido encontrado na planilha.');
          return;
        }

        const res = await api.importProdutos(selectedSetorId, itens);
        alert(`Planilha importada com sucesso: ${res.importados} novos e ${res.atualizados} atualizados!`);
        setShowImportModal(false);
        carregarProdutos();
      } catch (err) {
        alert('Erro ao ler arquivo da planilha.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Baixar modelo de planilha
  const handleDownloadTemplate = () => {
    const templateData = [
      ['codigo', 'nome', 'vendas'],
      ['PAD-101', 'Pão Especial de Queijo e Ervas', 250],
      ['PAD-102', 'Baguete Rústica com Alho', 180],
      ['PAD-103', 'Pão Doce Tradicional', 120],
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, 'Modelo_Importacao_Produtos_Porto.xlsx');
  };

  // Exportar produtos atuais
  const handleExportCurrent = () => {
    const exportData = [
      ['Ranking', 'Código', 'Nome do Produto', 'Setor', 'Vendas Qtd', 'Status'],
      ...produtos.map((p) => [
        p.ranking,
        p.codigo,
        p.nome,
        setores.find((s) => s.id === p.setor_id)?.nome || p.setor_id,
        p.vendas_qtd,
        p.ativo ? 'Ativo' : 'Inativo',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    XLSX.writeFile(wb, `Produtos_Porto_${selectedSetorId}.xlsx`);
  };

  const produtosFiltrados = produtos.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return p.nome.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Barra de Seleção de Setor e Ações */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-amber-100/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
              Produtos & Ranking de Vendas
            </h2>
            <p className="text-xs text-slate-500">
              Gerencie a lista de cada setor, atualize volumes de venda e ordene do mais ao menos vendido.
            </p>
          </div>

          {canManageProducts && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                <span>Importar Planilha</span>
              </button>
              <button
                onClick={handleExportCurrent}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Exportar Lista</span>
              </button>
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-800 hover:bg-amber-900 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Produto</span>
              </button>
            </div>
          )}
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

      {/* Tabela de Produtos */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Barra de Filtro de Busca */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código ou nome..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-900"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Exibindo <strong>{produtosFiltrados.length}</strong> produtos ordenados por ranking de vendas
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-amber-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Carregando catálogo de produtos...</p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Nenhum produto cadastrado neste setor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase">
                  <th className="py-3 px-3 text-center w-16">Ranking</th>
                  <th className="py-3 px-3 w-28">Código</th>
                  <th className="py-3 px-4">Nome do Produto</th>
                  <th className="py-3 px-3 text-right w-32">Vendas (Qtd)</th>
                  <th className="py-3 px-3 text-center w-24">Status</th>
                  {canManageProducts && (
                    <th className="py-3 px-4 text-center w-36">Ações / Ordem</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {produtosFiltrados.map((prod, index) => {
                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-amber-50/40 transition-colors ${
                        !prod.ativo ? 'opacity-50 bg-slate-50/80' : ''
                      }`}
                    >
                      {/* Posição no Ranking */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold ${
                            prod.ranking === 1
                              ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                              : prod.ranking <= 3
                              ? 'bg-amber-200 text-amber-950 font-bold'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {prod.ranking}º
                        </span>
                      </td>

                      {/* Código */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                        {prod.codigo}
                      </td>

                      {/* Nome */}
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {prod.nome}
                      </td>

                      {/* Vendas Registradas */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {prod.vendas_qtd} un.
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            prod.ativo
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {prod.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>

                      {/* Ações */}
                      {canManageProducts && (
                        <td className="py-2.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Reordenação manual */}
                            <button
                              type="button"
                              onClick={() => handleMove(index, 'up')}
                              disabled={index === 0}
                              className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                              title="Subir posição"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(index, 'down')}
                              disabled={index === produtosFiltrados.length - 1}
                              className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-20 cursor-pointer"
                              title="Descer posição"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(prod)}
                              className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-100 transition cursor-pointer ml-1"
                              title="Editar produto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(prod.id, prod.nome)}
                              className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                              title="Inativar produto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADICIONAR / EDITAR PRODUTO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Código do Produto
                </label>
                <input
                  type="text"
                  value={formCodigo}
                  onChange={(e) => setFormCodigo(e.target.value)}
                  placeholder="Ex: PAD-012"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Nome do Produto
                </label>
                <input
                  type="text"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Ex: Croissant Especial com Frutas"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Quantidade Vendida (Volume de Vendas)
                </label>
                <input
                  type="number"
                  value={formVendas}
                  onChange={(e) => setFormVendas(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  placeholder="Ex: 350"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  O ranking do setor será recalculado automaticamente com base nesta quantidade.
                </p>
              </div>

              {editingProduct && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="statusProd"
                    checked={formStatus}
                    onChange={(e) => setFormStatus(e.target.checked)}
                    className="w-4 h-4 text-amber-700 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="statusProd" className="font-semibold text-slate-800 cursor-pointer">
                    Produto Ativo no Catálogo
                  </label>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
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
                  {editingProduct ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTAR PRODUTOS EM MASSA */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Importar Produtos em Massa</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Importe a lista de produtos do setor selecionado. Você pode enviar uma planilha Excel (.xlsx) ou colar linhas de texto no formato CSV.
              </p>

              {/* Botão de Upload de Arquivo */}
              <div className="border-2 border-dashed border-amber-300 bg-amber-50/50 rounded-xl p-4 text-center">
                <FileSpreadsheet className="w-8 h-8 text-amber-700 mx-auto mb-2" />
                <p className="font-bold text-slate-800">Selecione uma planilha Excel (.xlsx ou .csv)</p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="mt-2 text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-700 file:text-white hover:file:bg-amber-800 cursor-pointer"
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-amber-800 hover:underline font-semibold text-[11px]"
                  >
                    Baixar modelo de planilha de exemplo (.xlsx)
                  </button>
                </div>
              </div>

              {/* Opção Alternativa: Colar CSV */}
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">
                  Ou Cole Texto no Formato (Código, Nome, Vendas):
                </label>
                <textarea
                  rows={4}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`PAD-101, Pão Especial com Queijo, 250\nPAD-102, Baguete Rústica, 180`}
                  className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 font-mono text-[11px]"
                />
              </div>

              {importFeedback && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                  {importFeedback}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleProcessImport}
                  className="px-4 py-2 font-bold text-white bg-amber-800 hover:bg-amber-900 rounded-lg shadow-xs cursor-pointer"
                >
                  Processar Texto Colado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
