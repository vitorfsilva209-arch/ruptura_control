import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Usuario } from '../types';
import { api, syncOfflineQueue, getOfflineQueue } from '../services/api';

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  isOnline: boolean;
  offlineCount: number;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  updateCurrentUser: (u: Partial<Usuario>) => void;
  syncPending: () => Promise<number>;
  canAccessSector: (sectorId: string) => boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isOperador: boolean;
  canManageProducts: boolean;
  canManageSchedules: boolean;
  canManageUsers: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'porto_auth_user';
const TOKEN_STORAGE_KEY = 'porto_auth_token';
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inatividade

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState<number>(() => getOfflineQueue().length);

  // Monitorar conectividade e sincronizar fila quando voltar online
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const res = await syncOfflineQueue();
      setOfflineCount(getOfflineQueue().length);
      if (res.synced > 0) {
        console.log(`Sincronizados ${res.synced} lançamentos gravados offline!`);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      setOfflineCount(getOfflineQueue().length);
    }, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const logout = useCallback(() => {
    if (user) {
      api.logout(user.id, user.nome);
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }, [user]);

  // Monitorar inatividade do usuário para desconexão automática
  useEffect(() => {
    if (!user) return;

    let timeoutId: any;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        alert('Sessão expirada por inatividade (30 minutos sem interação). Faça login novamente.');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    activityEvents.forEach((evt) => window.addEventListener(evt, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [user, logout]);

  const login = async (usuario: string, senha: string) => {
    const data = await api.login(usuario, senha);
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
  };

  const updateCurrentUser = (updated: Partial<Usuario>) => {
    if (!user) return;
    const newUser = { ...user, ...updated };
    setUser(newUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
  };

  const syncPending = async (): Promise<number> => {
    const res = await syncOfflineQueue();
    setOfflineCount(getOfflineQueue().length);
    return res.synced;
  };

  const isAdmin = user?.perfil === 'administrador';
  const isGestor = user?.perfil === 'gestor';
  const isOperador = user?.perfil === 'operador';

  const canManageProducts = isAdmin || isGestor;
  const canManageSchedules = isAdmin || isGestor;
  const canManageUsers = isAdmin;

  const canAccessSector = (sectorId: string): boolean => {
    if (!user) return false;
    if (isAdmin || isGestor) return true;
    return user.setores_permitidos?.includes(sectorId) ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isOnline,
        offlineCount,
        login,
        logout,
        updateCurrentUser,
        syncPending,
        canAccessSector,
        isAdmin,
        isGestor,
        isOperador,
        canManageProducts,
        canManageSchedules,
        canManageUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
