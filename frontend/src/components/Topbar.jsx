import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search, Sun, Moon, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import useDarkMode from '../hooks/useDarkMode'

export function Topbar({ onMenuClick }) {
  const [isDark, toggleDark] = useDarkMode()
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Placeholder — ready to connect to a notifications API
  const notifications = []
  const unreadCount = notifications.filter(n => n.unread).length

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-6 z-10 sticky top-0 flex-shrink-0 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>

        <div className="relative hidden md:flex items-center flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar en el sistema..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          title="Alternar tema"
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(v => !v)}
            className={`relative p-2 rounded-full transition-colors ${
              showNotifications
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-800 dark:text-white">Notificaciones</h3>
                {unreadCount > 0 && (
                  <button className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors">
                    <Check size={14} /> Marcar leídas
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
                    No hay notificaciones
                  </p>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-pointer transition-colors ${
                        n.unread ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className={`text-sm font-medium ${n.unread ? 'text-slate-800 dark:text-slate-200' : 'text-slate-600 dark:text-slate-400'}`}>
                          {n.title}
                        </p>
                        {n.unread && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{n.desc}</p>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{n.time}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
