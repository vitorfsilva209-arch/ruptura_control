import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ShieldAlert, Clock } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);

  // Countdown para bloqueio temporário
  useEffect(() => {
    if (lockCountdown === null || lockCountdown <= 0) return;
    const interval = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !senha) {
      setError('Por favor, informe seu usuário e senha.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(usuario, senha);
    } catch (err: any) {
      let msg = err.message || 'Falha no acesso.';
      if (
        msg.includes('Unexpected end') ||
        msg.includes('Fim inesperado') ||
        msg.includes('JSON') ||
        msg.includes('fetch')
      ) {
        msg = 'Falha momentânea na conexão com o servidor. Por favor, tente novamente.';
      }
      setError(msg);
      // Se a mensagem mencionar bloqueio com segundos
      const match = msg.match(/(\d+)\s*segundos/);
      if (match) {
        setLockCountdown(parseInt(match[1], 10));
      }
    } finally {
      setLoading(false);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-stone-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
        {/* Header Elegante Padaria Porto Primo */}
        <div className="bg-gradient-to-r from-amber-800 via-amber-900 to-stone-900 px-8 pt-7 pb-6 text-center text-white relative">
          <div className="flex justify-center mb-2">
            <img
              src="/assets/aistudio/Emblema_Vintage_Porto_Primo_Delicatessen_d1445651.png"
              alt="Porto Primo Delicatessen"
              className="w-32 sm:w-36 h-auto drop-shadow-lg hover:scale-105 transition-transform"
            />
          </div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-amber-100">
            Porto Primo Delicatéssen
          </h1>
          <p className="text-xs uppercase tracking-widest text-amber-300 font-semibold mt-1">
            Controle & Análise de Ruptura
          </p>
          <div className="mt-3 inline-block px-3 py-1 rounded-full bg-black/25 text-[11px] text-amber-200">
            Padaria • Confeitaria • Pastelaria • Expedição
          </div>
        </div>

        {/* Formulário de Acesso */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-800">Acesso ao Sistema</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Informe suas credenciais para acessar os registros e indicadores.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-xs leading-relaxed animate-shake">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Aviso de Segurança:</span>
                {error}
                {lockCountdown !== null && lockCountdown > 0 && (
                  <div className="mt-2 font-mono font-bold text-rose-700 bg-rose-100/70 px-2 py-1 rounded inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Desbloqueio em: {formatSeconds(lockCountdown)}
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Usuário
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ex: Vitor Silva"
                  autoComplete="username"
                  disabled={lockCountdown !== null && lockCountdown > 0}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50 disabled:opacity-50 text-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Não diferencia maiúsculas de minúsculas.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={lockCountdown !== null && lockCountdown > 0}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-slate-50/50 disabled:opacity-50 text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (lockCountdown !== null && lockCountdown > 0)}
              className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 shadow-md shadow-amber-900/10 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Validando acesso seguro...</span>
                </>
              ) : (
                <span>Entrar no Sistema</span>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé institucional */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center text-[11px] text-slate-400">
          Padaria Porto Delicatéssen • Sistema Seguro v2.5
        </div>
      </div>
    </div>
  );
};
