import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Profile = { id: string; full_name: string | null; role: 'gestor' | 'operador' | null };

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    // 1) restaura sessão do localStorage
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2) escuta mudanças de auth (login/logout/refresh)
    const { data } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
    });
    unsub = () => data.subscription.unsubscribe();

    return () => { unsub?.(); };
  }, []);

  // 3) carrega profile quando tiver user
  useEffect(() => {
    let alive = true;
    async function fetchProfile(uid: string) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', uid)
        .maybeSingle();
      if (!alive) return;
      setProfile(error ? null : (data as Profile | null));
    }
    if (user?.id) fetchProfile(user.id);
    else setProfile(null);
    return () => { alive = false; };
  }, [user?.id]);

  async function signInEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider value={{ session, user, profile, loading, signInEmail, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
