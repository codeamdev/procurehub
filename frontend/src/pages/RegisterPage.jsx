import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useForm from '../hooks/useForm'
import Alert from '../components/ui/Alert'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { extractError } from '../utils/errors'
import { Box } from 'lucide-react'

const INITIAL = { email: '', password: '', role: 'buyer' }

export default function RegisterPage() {
  const { values, handleChange } = useForm(INITIAL)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await register(values)
      navigate(user.role === 'supplier' ? '/solicitudes' : '/dashboard')
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-10 w-full max-w-sm transition-colors">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Box size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Crear Cuenta</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Únete a ProcureHub</p>
        </div>

        <Alert message={error} onDismiss={() => setError(null)} />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5">Email <span className="text-red-500">*</span></Label>
            <Input
              name="email"
              type="email"
              required
              placeholder="tu@empresa.com"
              value={values.email}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label className="mb-1.5">Contraseña <span className="text-red-500">*</span></Label>
            <Input
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              value={values.password}
              onChange={handleChange}
            />
          </div>
          <div>
            <Label className="mb-1.5">Rol <span className="text-red-500">*</span></Label>
            <Select name="role" value={values.role} onChange={handleChange}>
              <option value="buyer">Comprador — Realizo compras para mi empresa</option>
              <option value="supplier">Proveedor — Envío propuestas a solicitudes</option>
            </Select>
            {values.role === 'supplier' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Las cuentas de proveedor requieren aprobación del admin antes de acceder al marketplace.
              </p>
            )}
          </div>
          <Button type="submit" loading={loading} className="w-full mt-1">
            Crear Cuenta
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
