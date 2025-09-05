import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div style={{padding:24}}>Carregando…</div>;  // 👈 espera restaurar sessão
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
