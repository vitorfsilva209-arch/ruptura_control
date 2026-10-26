import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginScreen } from './components/LoginScreen';
import { Navbar } from './components/Navbar';
import { LancamentoGrid } from './components/LancamentoGrid';
import { Dashboard } from './components/Dashboard';
import { FolhaSemanal } from './components/FolhaSemanal';
import { ProdutosManager } from './components/ProdutosManager';
import { HorariosManager } from './components/HorariosManager';
import { UsuariosManager } from './components/UsuariosManager';
import { DocumentacaoView } from './components/DocumentacaoView';
import { PerfilModal } from './components/PerfilModal';
import { SetoresModal } from './components/SetoresModal';
import { Setor } from './types';
import { api } from './services/api';

const MainApp: React.FC = () => {
  const { user, canManageUsers } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('lancamento');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showSetoresModal, setShowSetoresModal] = useState<boolean>(false);

  const carregarSetores = () => {
    api
      .getSetores()
      .then((data) => {
        setSetores(data.filter((s) => s.ativo));
      })
      .catch((err) => {
        console.error('Erro ao carregar setores:', err);
      });
  };

  // Carregar lista de setores ativos
  useEffect(() => {
    if (!user) return;
    carregarSetores();
  }, [user]);

  // Se não estiver autenticado, exibe a tela de login
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'usuarios' && !canManageUsers) return;
          setCurrentTab(tab);
        }}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenSetores={() => setShowSetoresModal(true)}
      />

      <main className="flex-1 pb-12">
        {currentTab === 'lancamento' && (
          <LancamentoGrid
            setores={setores}
            onOpenSetoresModal={() => setShowSetoresModal(true)}
          />
        )}
        {currentTab === 'dashboard' && <Dashboard setores={setores} />}
        {currentTab === 'folha' && <FolhaSemanal setores={setores} />}
        {currentTab === 'produtos' && (
          <ProdutosManager
            setores={setores}
            onOpenSetoresModal={() => setShowSetoresModal(true)}
          />
        )}
        {currentTab === 'horarios' && (
          <HorariosManager
            setores={setores}
            onOpenSetoresModal={() => setShowSetoresModal(true)}
          />
        )}
        {currentTab === 'usuarios' && canManageUsers && <UsuariosManager setores={setores} />}
        {currentTab === 'documentacao' && <DocumentacaoView />}
      </main>

      {/* Modal de Perfil e Troca de Senha */}
      {showProfileModal && <PerfilModal onClose={() => setShowProfileModal(false)} />}

      {/* Modal de Gerenciamento e Criação de Setores */}
      {showSetoresModal && (
        <SetoresModal
          setores={setores}
          onClose={() => setShowSetoresModal(false)}
          onSetoresChange={carregarSetores}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
