import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import AppLayout from './components/AppLayout'

import Login from './pages/Login'

import DesenhosList from './pages/Gestor/DesenhosList';
import DesenhoNew from './pages/Gestor/DesenhoNew';
import DesenhoDetail from './pages/Gestor/DesenhoDetail';
import OpsList from './pages/Gestor/OpsList';
import OpNew from './pages/Gestor/OpNew';
import OpDetail from './pages/Gestor/OpDetail';

import OperadorHome from './pages/Operador/OperadorHome'
import OperadorMedir from './pages/Operador/OperadorMedir'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/operador" replace />} />

        {/* Gestor */}
        <Route path="gestor/ops" element={<OpsList/>} />
        <Route path="gestor/ops/new" element={<OpNew/>} />
        <Route path="gestor/ops/:id" element={<OpDetail/>} />

        <Route path="gestor/desenhos" element={<DesenhosList/>} />
        <Route path="gestor/desenhos/new" element={<DesenhoNew/>} />
        <Route path="gestor/desenhos/:id" element={<DesenhoDetail/>} />

        {/* Operador */}
        <Route path="operador" element={<OperadorHome/>} />
        <Route path="operador/medir/:id" element={<OperadorMedir/>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
