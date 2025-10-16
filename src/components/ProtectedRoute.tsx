import { Navigate } from 'react-router-dom';
import { useAuth } from '../app/AuthProvider';
import { Center, Loader } from '@mantine/core';

export default function ProtectedRoute({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: 'gestor' | 'operador';
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (allow && role !== allow) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
