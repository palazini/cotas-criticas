import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

type Role = 'gestor' | 'operador';
type AuthCtx = {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signInGestor: (email: string, password: string) => Promise<{ error?: string }>;
  signInOperador: (pin4: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be inside <AuthProvider/>');
  return v;
};

const OPERADOR_DOMAIN = (import.meta.env.VITE_OPERADOR_DOMAIN || 'operador.local') as string;
const OPERADOR_PASSWORD = (import.meta.env.VITE_OPERADOR_PASSWORD || '123456') as string;

function deriveRole(user: User | null): Role | null {
  if (!user?.email) return null;
  return user.email.endsWith(`@${OPERADOR_DOMAIN}`) ? 'operador' : 'gestor';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const user = session?.user ?? null;
  const role = useMemo(() => deriveRole(user), [user]);

  async function signInGestor(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  }

  async function signInOperador(pin4: string) {
    if (!/^\d{4}$/.test(pin4)) return { error: 'Informe um ID de 4 dígitos.' };
    const email = `${pin4}@${OPERADOR_DOMAIN}`;
    // 1) tenta login
    const sign = await supabase.auth.signInWithPassword({ email, password: OPERADOR_PASSWORD });
    if (!sign.error) return {};
    // 2) se falhar, tenta criar (funciona se Auto-confirm estiver ativo)
    const up = await supabase.auth.signUp({ email, password: OPERADOR_PASSWORD });
    if (up.error) return { error: up.error.message };
    // 3) loga de novo (garantia)
    const sign2 = await supabase.auth.signInWithPassword({ email, password: OPERADOR_PASSWORD });
    return { error: sign2.error?.message };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthCtx = { user, role, loading, signInGestor, signInOperador, signOut };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
