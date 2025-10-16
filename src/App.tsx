import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import '@fontsource-variable/inter';
import Login from './pages/Login';
import { AuthProvider } from './app/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import GestorLayout from './layouts/GestorLayout';
import OperadorLayout from './layouts/OperadorLayout';
import GestorHome from './pages/gestor/Home';
import DesenhosList from './pages/gestor/desenhos/List';
import DesenhosNew from './pages/gestor/desenhos/New';
import DesenhosEdit from './pages/gestor/desenhos/Edit';
import OPsList from './pages/gestor/ops/List';
import OPsNew from './pages/gestor/ops/New';
import OPsView from './pages/gestor/ops/View';
import OperadorList from './pages/operador/List';
import OperadorOP from './pages/operador/OP';

export default function App() {
  return (
    <MantineProvider
      theme={{
        fontFamily: 'Inter Variable, Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        primaryColor: 'indigo',
        defaultRadius: 'md',
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/gestor" element={
              <ProtectedRoute allow="gestor"><GestorLayout /></ProtectedRoute>
            }>
              <Route index element={<GestorHome />} />
              <Route path="desenhos" element={<DesenhosList />} />
              <Route path="desenhos/novo" element={<DesenhosNew />} />
              <Route path="desenhos/:id" element={<DesenhosEdit />} />

              <Route path="ops" element={<OPsList />} />
              <Route path="ops/nova" element={<OPsNew />} />
              <Route path="ops/:opId" element={<OPsView />} />
            </Route>

            <Route
              path="/operador"
              element={
                <ProtectedRoute allow="operador">
                  <OperadorLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<OperadorList />} />
              <Route path="op/:opId" element={<OperadorOP />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </MantineProvider>
  );
}
