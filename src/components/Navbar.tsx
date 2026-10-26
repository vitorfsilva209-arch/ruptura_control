import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardCheck,
  BarChart3,
  CalendarDays,
  Croissant,
  Clock,
  Users,
  BookOpen,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  User as UserIcon,
  Menu,
  X,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenProfile: () => void;
  onOpenSetores?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onOpenProfile,
  onOpenSetores,
}) => {
  const { user, logout, isOnline, offlineCount, syncPending, canManageUsers, canManageProducts } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncPending();
    } finally {
      setSyncing(false);
    }
  };

  const navItems = [
    { id: 'lancamento', label: 'Lançamento', icon: ClipboardCheck },
    { id: 'dashboard', label: 'Painel & Indicadores', icon: BarChart3 },
    { id: 'folha', label: 'Folha Semanal', icon: CalendarDays },
    { id: 'produtos', label: 'Produtos & Ranking', icon: Croissant },
    { id: 'horarios', label: 'Horários', icon: Clock },
    ...(canManageUsers ? [{ id: 'usuarios', label: 'Usuários', icon: Users }] : []),
    { id: 'documentacao', label: 'Manual & BD', icon: BookOpen },
  ];

  return (
    <header className="bg-white border-b border-amber-200/80 sticky top-0 z-40 shadow-xs">
      {/* Barra superior de status e marca */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Marca */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange('lancamento')}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <div className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
                <img
                  src="/assets/aistudio/Emblema_Vintage_Porto_Primo_Delicatessen_d1445651.png"
                  alt="Porto Primo Delicatessen"
                  className="h-full w-auto object-contain drop-shadow-xs"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-slate-900 text-base sm:text-lg leading-tight">
                    Porto Primo Delicatéssen
                  </span>
                  <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300/60">
                    Ruptura
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block">
                  Controle & Gestão de Estoque em Gôndola
                </p>
              </div>
            </button>
          </div>

          {/* Área Direita: Conexão, Perfil e Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Status Online / Offline */}
            <div className="flex items-center">
              {isOnline ? (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title="Conectado ao servidor"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden md:inline">Online</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200"
                  title="Modo offline: dados serão salvos localmente"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline</span>
                </div>
              )}

              {offlineCount > 0 && (
                <button
                  onClick={handleManualSync}
                  disabled={syncing || !isOnline}
                  className="ml-1.5 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 cursor-pointer disabled:opacity-50"
                  title="Lançamentos aguardando sincronização"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{offlineCount} pendente{offlineCount > 1 ? 's' : ''}</span>
                </button>
              )}
            </div>

            {/* Gerenciar Setores */}
            {canManageProducts && onOpenSetores && (
              <button
                onClick={onOpenSetores}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-100/70 hover:bg-amber-100 border border-amber-300 transition cursor-pointer"
                title="Cadastrar ou gerenciar setores"
              >
                <Layers className="w-3.5 h-3.5 text-amber-800" />
                <span>+ Setores</span>
              </button>
            )}

            {/* Usuário Logado */}
            {user && (
              <button
                onClick={onOpenProfile}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition text-left cursor-pointer"
                title="Ver perfil e trocar senha"
              >
                <div className="w-7 h-7 rounded-full bg-amber-800 text-white font-bold text-xs flex items-center justify-center">
                  {user.nome.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.nome.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-amber-800 uppercase font-bold leading-tight">
                    {user.perfil}
                  </p>
                </div>
              </button>
            )}

            {/* Botão Sair Obrigatório e Visível em Todas as Telas */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
              title="Encerrar sessão"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            {/* Botão Menu Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden cursor-pointer"
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Navegação Horizontal (Desktop) */}
      <div className="hidden md:block bg-slate-50/80 border-t border-slate-200/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 py-1.5 overflow-x-auto scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-amber-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Menu Dropdown Mobile */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-800 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
