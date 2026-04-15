import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { BacklogPage } from './pages/BacklogPage';
import { ClientesPage } from './pages/ClientesPage';
import { ClienteDetallePage } from './pages/ClienteDetallePage';
import { VozDeMarcaPage } from './pages/VozDeMarcaPage';
import { ContentPage } from './pages/ContentPage';
import { TicketDetallePage } from './pages/TicketDetallePage';
import { PerformancePage } from './pages/PerformancePage';
import { PublicationDetailPage } from './pages/PublicationDetailPage';
import { Layout } from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-[#000033]/60">Cargando...</div>
      </div>
    );
  }

  return user ? <Layout>{children}</Layout> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/" element={<Navigate to="/backlog" replace />} />
      <Route
        path="/backlog"
        element={
          <PrivateRoute>
            <BacklogPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <PrivateRoute>
            <ClientesPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/content/:ticketId"
        element={
          <PrivateRoute>
            <ContentPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/clientes/:clientId"
        element={
          <PrivateRoute>
            <ClienteDetallePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/clientes/:clientId/voz-de-marca"
        element={
          <PrivateRoute>
            <VozDeMarcaPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/piezas/:ticketId"
        element={
          <PrivateRoute>
            <TicketDetallePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/performance"
        element={
          <PrivateRoute>
            <PerformancePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/performance/:publicationId"
        element={
          <PrivateRoute>
            <PublicationDetailPage />
          </PrivateRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
