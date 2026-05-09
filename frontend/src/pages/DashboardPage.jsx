import { useMemo } from 'react'
import { workflowAPI } from '../services/api'
import useApi from '../hooks/useApi'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { FileText, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Card } from '../components/ui/card'

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul']

function buildMonthlyMock(values) {
  return MONTHS.map((mes, i) => ({ mes, valor: values[i] }))
}

const CHART_SOLICITUDES = buildMonthlyMock([3, 5, 4, 7, 6, 8, 9])
const CHART_COMPLETADAS = buildMonthlyMock([2, 3, 4, 5, 5, 7, 8])

export default function DashboardPage() {
  const { data: requests, loading } = useApi(() => workflowAPI.listRequests(), [])

  const stats = useMemo(() => {
    if (!requests) return { total: 0, active: 0, completed: 0, cancelled: 0 }
    return {
      total:     requests.length,
      active:    requests.filter(r => r.status === 'active').length,
      completed: requests.filter(r => r.status === 'completed').length,
      cancelled: requests.filter(r => r.status === 'cancelled').length,
    }
  }, [requests])

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-7">

      <div>
        <h1 className="text-[1.75rem] font-bold text-slate-900 dark:text-white leading-tight">
          Resumen General
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Métricas clave de solicitudes y flujos de trabajo.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          label="Solicitudes Totales"
          value={stats.total}
          icon={FileText}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
          iconColor="text-violet-500 dark:text-violet-400"
          change={5.2}
          loading={loading}
        />
        <StatCard
          label="En Progreso"
          value={stats.active}
          icon={Clock}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="text-blue-500 dark:text-blue-400"
          change={8.4}
          loading={loading}
        />
        <StatCard
          label="Completadas"
          value={stats.completed}
          icon={CheckCircle2}
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconColor="text-emerald-500 dark:text-emerald-400"
          change={12.8}
          loading={loading}
        />
        <StatCard
          label="Canceladas"
          value={stats.cancelled}
          icon={XCircle}
          iconBg="bg-rose-50 dark:bg-rose-900/20"
          iconColor="text-rose-500 dark:text-rose-400"
          change={-2.1}
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-5">
        <ChartCard title="Solicitudes por Mes">
          <ResponsiveContainer width="100%" height={290}>
            <AreaChart data={CHART_SOLICITUDES} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#7c3aed" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
                formatter={(v) => [v, 'Solicitudes']}
                labelStyle={{ color: '#475569', fontWeight: 600 }}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="#7c3aed"
                strokeWidth={2.5}
                fill="url(#gradSol)"
                dot={{ r: 4, fill: '#fff', stroke: '#7c3aed', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#7c3aed', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Completadas por Mes">
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={CHART_COMPLETADAS} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
                formatter={(v) => [v, 'Completadas']}
                labelStyle={{ color: '#475569', fontWeight: 600 }}
              />
              <Bar
                dataKey="valor"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

    </div>
  )
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, change, loading }) {
  const isPositive = change > 0
  const isNegative = change < 0

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
          {loading ? (
            <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse mt-1" />
          ) : (
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">{value}</h3>
          )}
        </div>
        <div className={`p-3 ${iconBg} ${iconColor} rounded-lg flex-shrink-0`}>
          <Icon size={20} />
        </div>
      </div>
      <div className={`flex items-center text-sm ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
        <span className="font-medium mr-2">{isPositive ? `+${change}%` : `${change}%`}</span>
        <span className="text-slate-400 dark:text-slate-500">vs mes anterior</span>
      </div>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-6 transition-colors">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{title}</h3>
      {children}
    </div>
  )
}
