import { useAuth } from './AuthProvider';

export function useProfile() {
  const { profile, loading } = useAuth();
  return { role: profile?.role, profile, loading };
}