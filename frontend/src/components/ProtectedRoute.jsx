import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './ui/Spinner'

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="text-xl font-semibold text-red-500 mb-2">Acceso denegado</h2>
        <p className="text-slate-500 dark:text-slate-400">No tienes permiso para ver esta página.</p>
      </div>
    )
  }
  return children
}
