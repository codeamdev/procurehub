import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Box } from 'lucide-react'

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const { companyName } = useTenant()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      navigate(user.role === 'supplier' ? '/solicitudes' : '/dashboard')
    } catch {
      setError('Email o contraseña incorrectos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-10 w-full max-w-sm transition-colors">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Box size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{companyName}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Inicia sesión en tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input
              type="email"
              placeholder="tu@email.com"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1.5">Contraseña</Label>
            <Input
              type="password"
              placeholder="••••••••"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
          <Button type="submit" loading={loading} className="w-full mt-1">
            Iniciar sesión
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500 dark:text-slate-400">
          ¿Sin cuenta?{' '}
          <Link to="/register" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  )
}
