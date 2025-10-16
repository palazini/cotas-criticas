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

// Usado apenas para inferir o papel quando não houver user_metadata.role
const OPERADOR_DOMAIN = (import.meta.env.VITE_OPERADOR_DOMAIN || 'operador.local') as string;

function deriveRole(user: User | null): Role | null {
  if (!user?.email) return null;

  // Preferimos o papel salvo no metadata (setado pela API /api/op-login)
  const metaRole = (user.user_metadata?.role as Role | undefined);
  if (metaRole === 'gestor' || metaRole === 'operador') return metaRole;

  // Fallback por domínio do e-mail
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

  // Agora o login do operador é feito via API serverless (/api/op-login),
  // que garante/ cria o usuário e devolve tokens para setarmos a sessão.
  async function signInOperador(pin4: string) {
    if (!/^\d{4}$/.test(pin4)) return { error: 'Informe um ID de 4 dígitos.' };

    const res = await fetch('/api/op-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin4 }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { error: j?.error || 'Falha no login' };
    }

    const { session } = await res.json();
    // Aplica a sessão no supabase-js do browser
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });

    return { error: error?.message };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value: AuthCtx = { user, role, loading, signInGestor, signInOperador, signOut };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
