import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTenant } from '../context/TenantContext'
import { workflowDefAPI } from '../services/api'
import {
  Store, GitBranch, Sparkles, Bot, ShieldCheck, Box, X, LayoutDashboard,
  FileText, LogOut, User, Settings, ChevronUp, ChevronDown, ClipboardList,
  Truck, Users, Handshake,
} from 'lucide-react'

// ── Static nav structure (used by Layout for tab management) ─────────────────

export const NAV_ITEMS = [
  { id: 'dashboard',    title: 'Dashboard',     path: '/dashboard',    icon: LayoutDashboard, roles: ['admin', 'buyer'] },
  { id: 'solicitudes',  title: 'Solicitudes',   path: '/solicitudes',  icon: FileText,        roles: ['admin', 'buyer', 'supplier'] },
  { id: 'negotiations', title: 'Negociaciones', path: '/negotiations', icon: Handshake,       roles: ['admin', 'buyer', 'supplier'] },
  { id: 'marketplace',  title: 'Marketplace',   path: '/marketplace',  icon: Store,           roles: ['supplier'] },
  { id: 'suppliers',    title: 'Proveedores',   path: '/suppliers',    icon: Truck,           roles: ['admin'] },
  { id: 'buyers',       title: 'Compradores',   path: '/buyers',       icon: Users,           roles: ['admin'] },
  { id: 'workflows',    title: 'Workflows',     path: '/workflows',    icon: GitBranch,       roles: ['admin', 'buyer'] },
  { id: 'ai',           title: 'AI Assistant',  path: '/ai',           icon: Sparkles,        roles: ['admin', 'buyer'] },
  { id: 'supplier-ai',  title: 'AI Advisor',    path: '/supplier-ai',  icon: Bot,             roles: ['supplier'] },
  { id: 'admin-panel',  title: 'Admin',         path: '/admin-panel',  icon: ShieldCheck,     roles: ['admin'] },
]

const ROLE_COLORS = {
  admin:    'bg-purple-600',
  buyer:    'bg-blue-600',
  supplier: 'bg-emerald-600',
}
const ROLE_LABELS = {
  admin:    'Administrador',
  buyer:    'Comprador',
  supplier: 'Proveedor',
}

// ── NavButton ─────────────────────────────────────────────────────────────────

function NavButton({ icon: Icon, label, isActive, onClick, indent = false }) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 rounded-lg transition-colors text-sm font-medium
        ${indent ? 'px-3 py-2 pl-9' : 'px-3 py-2.5'}
        ${isActive
          ? 'bg-blue-600/10 text-blue-400'
          : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
      `}
    >
      <Icon
        size={indent ? 15 : 18}
        className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}

// ── AccordionSection ──────────────────────────────────────────────────────────

function AccordionSection({ icon: Icon, label, isOpen, onToggle, hasActiveChild, children }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
          ${hasActiveChild
            ? 'bg-blue-600/10 text-blue-400'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
        `}
      >
        <Icon
          size={18}
          className={`flex-shrink-0 ${hasActiveChild ? 'text-blue-400' : 'text-slate-400'}`}
        />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
            hasActiveChild ? 'text-blue-400' : 'text-slate-500'
          }`}
        />
      </button>

      {isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ isOpen, onClose }) {
  const setIsOpen = onClose   // alias for internal use
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuth()
  const { companyName }  = useTenant()

  const [profileOpen, setProfileOpen]       = useState(false)
  const [menuWorkflows, setMenuWorkflows]    = useState([])
  const [solOpen, setSolOpen]               = useState(false)
  const [provOpen, setProvOpen]             = useState(false)

  useEffect(() => {
    if (!user || user.role === 'supplier') return
    workflowDefAPI.list({ show_in_menu: true, status: 'active' })
      .then(({ data }) => setMenuWorkflows(Array.isArray(data) ? data : (data?.results ?? [])))
      .catch(() => {})
  }, [user])

  // Auto-expand sections based on current path
  useEffect(() => {
    if (location.pathname.startsWith('/solicitudes')) setSolOpen(true)
    if (location.pathname.startsWith('/suppliers') || location.pathname.startsWith('/buyers')) setProvOpen(true)
  }, [location.pathname])

  const handleNav = (path) => {
    navigate(path)
    // On small screens close the sidebar after navigation
    if (window.innerWidth < 1024) onClose()
  }

  const isExact   = (path) => location.pathname === path
  const isPrefix  = (prefix) => location.pathname === prefix || location.pathname.startsWith(prefix + '/')

  // "Solicitudes" section active if any sub-path is active
  const solActive = isPrefix('/solicitudes')
  // "Proveedores" section active if /suppliers or /buyers
  const provActive = isPrefix('/suppliers') || isPrefix('/buyers')

  const handleLogout = async () => { await logout(); navigate('/login') }

  const roleColor = ROLE_COLORS[user?.role] ?? 'bg-slate-600'
  const roleLabel = ROLE_LABELS[user?.role] ?? user?.role

  const isAdmin    = user?.role === 'admin'
  const isBuyer    = user?.role === 'buyer'
  const isSupplier = user?.role === 'supplier'

  return (
    <>
      {/* Backdrop: only on small screens */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-800/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-30 flex-shrink-0
        w-64 bg-slate-900 text-slate-300
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 text-white min-w-0">
            <div className="p-1.5 bg-blue-600 rounded-lg flex-shrink-0">
              <Box size={20} />
            </div>
            <span className="font-bold text-lg tracking-wide truncate">
              {companyName || 'ProcureHub'}
            </span>
          </div>
          <button
            className="text-slate-400 hover:text-white transition-colors flex-shrink-0 ml-2"
            onClick={onClose}
            title="Ocultar sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <div className="p-3 flex-1 overflow-y-auto space-y-0.5">

          {/* Dashboard */}
          {(isAdmin || isBuyer) && (
            <NavButton
              icon={LayoutDashboard}
              label="Dashboard"
              isActive={isExact('/dashboard')}
              onClick={() => handleNav('/dashboard')}
            />
          )}

          {/* ── Solicitudes (accordion) ──────────────────────────────────── */}
          {(isAdmin || isBuyer || isSupplier) && (
            <AccordionSection
              icon={FileText}
              label="Solicitudes"
              isOpen={solOpen}
              onToggle={() => setSolOpen(v => !v)}
              hasActiveChild={solActive}
            >
              {/* "Todas" sub-item */}
              <NavButton
                icon={ClipboardList}
                label="Todas las solicitudes"
                isActive={isExact('/solicitudes')}
                onClick={() => handleNav('/solicitudes')}
                indent
              />
              {/* Dynamic workflow sub-items */}
              {menuWorkflows.map(wf => (
                <NavButton
                  key={wf.id}
                  icon={ClipboardList}
                  label={wf.name}
                  isActive={isExact(`/solicitudes/workflow/${wf.id}`)}
                  onClick={() => handleNav(`/solicitudes/workflow/${wf.id}`)}
                  indent
                />
              ))}
            </AccordionSection>
          )}

          {/* Negociaciones */}
          {(isAdmin || isBuyer || isSupplier) && (
            <NavButton
              icon={Handshake}
              label="Negociaciones"
              isActive={isPrefix('/negotiations')}
              onClick={() => handleNav('/negotiations')}
            />
          )}

          {/* Marketplace (supplier only) */}
          {isSupplier && (
            <NavButton
              icon={Store}
              label="Marketplace"
              isActive={isExact('/marketplace')}
              onClick={() => handleNav('/marketplace')}
            />
          )}

          {/* ── Proveedores (accordion, admin only) ──────────────────────── */}
          {isAdmin && (
            <AccordionSection
              icon={Truck}
              label="Proveedores"
              isOpen={provOpen}
              onToggle={() => setProvOpen(v => !v)}
              hasActiveChild={provActive}
            >
              <NavButton
                icon={Truck}
                label="Proveedores"
                isActive={isExact('/suppliers')}
                onClick={() => handleNav('/suppliers')}
                indent
              />
              <NavButton
                icon={Users}
                label="Compradores"
                isActive={isExact('/buyers')}
                onClick={() => handleNav('/buyers')}
                indent
              />
            </AccordionSection>
          )}

          {/* Divider */}
          {(isAdmin || isBuyer) && (
            <div className="pt-2 mt-2 border-t border-slate-800">
              <p className="px-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Configuración
              </p>
            </div>
          )}

          {/* Workflows builder */}
          {(isAdmin || isBuyer) && (
            <NavButton
              icon={GitBranch}
              label="Workflows"
              isActive={isPrefix('/workflows')}
              onClick={() => handleNav('/workflows')}
            />
          )}

          {/* AI Assistant */}
          {(isAdmin || isBuyer) && (
            <NavButton
              icon={Sparkles}
              label="AI Assistant"
              isActive={isExact('/ai')}
              onClick={() => handleNav('/ai')}
            />
          )}

          {/* AI Advisor (supplier) */}
          {isSupplier && (
            <NavButton
              icon={Bot}
              label="AI Advisor"
              isActive={isExact('/supplier-ai')}
              onClick={() => handleNav('/supplier-ai')}
            />
          )}

          {/* Admin panel */}
          {isAdmin && (
            <NavButton
              icon={ShieldCheck}
              label="Admin"
              isActive={isExact('/admin-panel')}
              onClick={() => handleNav('/admin-panel')}
            />
          )}
        </div>

        {/* User profile section */}
        <div className="border-t border-slate-800 flex-shrink-0">
          {profileOpen && (
            <div className="px-3 py-2 space-y-0.5 border-b border-slate-800">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                <User size={16} className="text-slate-400 flex-shrink-0" />
                Mi Perfil
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                <Settings size={16} className="text-slate-400 flex-shrink-0" />
                Configuración
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-lg transition-colors"
              >
                <LogOut size={16} className="flex-shrink-0" />
                Cerrar Sesión
              </button>
            </div>
          )}

          <button
            onClick={() => setProfileOpen(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors group"
          >
            <div className={`w-8 h-8 rounded-full ${roleColor} flex items-center justify-center font-bold text-white text-sm flex-shrink-0`}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 overflow-hidden text-left min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-slate-500 capitalize">{roleLabel}</p>
            </div>
            {profileOpen
              ? <ChevronDown size={15} className="text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0" />
              : <ChevronUp size={15} className="text-slate-500 group-hover:text-slate-300 transition-colors flex-shrink-0" />
            }
          </button>
        </div>
      </aside>
    </>
  )
}
