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
        // Paleta baseada no #1d286a (0 = mais claro, 9 = mais escuro)
        colors: {
          brand: [
            '#eef1f7', // 0
            '#e1e6f5', // 1
            '#c6d0ee', // 2
            '#a6b5e1', // 3
            '#889ad3', // 4
            '#6d82c5', // 5
            '#4f64ad', // 6
            '#1d286a', // 7  <- tom principal (seu azul)
            '#162055', // 8
            '#0f183f', // 9
          ],
        },
        primaryColor: 'brand',
        primaryShade: 7,
        defaultRadius: 'md',
        components: {
          Button: {
            defaultProps: { color: 'brand' },
          },
          SegmentedControl: {
            defaultProps: { color: 'brand' },
          },
          Badge: {
            defaultProps: { color: 'brand' },
          },
        },
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/gestor"
              element={
                <ProtectedRoute allow="gestor">
                  <GestorLayout />
                </ProtectedRoute>
              }
            >
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
