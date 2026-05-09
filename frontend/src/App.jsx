import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TenantProvider, useTenant } from './context/TenantContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

const DashboardPage           = lazy(() => import('./pages/DashboardPage'))
const SolicitudesPage         = lazy(() => import('./pages/SolicitudesPage'))
const MarketplacePage         = lazy(() => import('./pages/MarketplacePage'))
const WorkflowListPage        = lazy(() => import('./pages/WorkflowListPage'))
const WorkflowBuilderPage     = lazy(() => import('./pages/WorkflowBuilderPage'))
const AIPage                  = lazy(() => import('./pages/AIPage'))
const SupplierAIPage          = lazy(() => import('./pages/SupplierAIPage'))
const AdminPage               = lazy(() => import('./pages/AdminPage'))
const SuppliersPage           = lazy(() => import('./pages/SuppliersPage'))
const BuyersPage              = lazy(() => import('./pages/BuyersPage'))
const NegotiationsPage        = lazy(() => import('./pages/NegotiationsPage'))
const NegotiationDetailPage   = lazy(() => import('./pages/NegotiationDetailPage'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-40">
      <span className="text-sm text-slate-400 animate-pulse">Cargando…</span>
    </div>
  )
}

function NoTenant() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center text-slate-500">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">ProcureHub</h1>
        <p className="text-base">Accede desde el subdominio de tu empresa.</p>
        <p className="text-sm text-slate-400 mt-2">
          Ejemplo: <code className="font-mono">mi-empresa.localhost:5173</code>
        </p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  const { subdomain } = useTenant()

  if (!subdomain) return <NoTenant />

  return (
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Navigate to={user?.role === 'supplier' ? '/solicitudes' : '/dashboard'} replace />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute roles={['admin', 'buyer']}>
            <Layout><DashboardPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/solicitudes" element={
          <ProtectedRoute>
            <Layout><SolicitudesPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/solicitudes/workflow/:workflowId" element={
          <ProtectedRoute>
            <Layout><SolicitudesPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/marketplace" element={
          <ProtectedRoute roles={['supplier']}>
            <Layout><MarketplacePage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/workflows" element={
          <ProtectedRoute roles={['admin', 'buyer']}>
            <Layout><WorkflowListPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/workflows/:id" element={
          <ProtectedRoute roles={['admin', 'buyer']}>
            <Layout><WorkflowBuilderPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/ai" element={
          <ProtectedRoute roles={['admin', 'buyer']}>
            <Layout><AIPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/supplier-ai" element={
          <ProtectedRoute roles={['supplier']}>
            <Layout><SupplierAIPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/admin-panel" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><AdminPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/suppliers" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><SuppliersPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/buyers" element={
          <ProtectedRoute roles={['admin']}>
            <Layout><BuyersPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/negotiations" element={
          <ProtectedRoute roles={['admin', 'buyer', 'supplier']}>
            <Layout><NegotiationsPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="/negotiations/:id" element={
          <ProtectedRoute roles={['admin', 'buyer', 'supplier']}>
            <Layout><NegotiationDetailPage /></Layout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TenantProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </TenantProvider>
    </BrowserRouter>
  )
}
