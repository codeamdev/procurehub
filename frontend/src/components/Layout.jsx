import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Sidebar, NAV_ITEMS } from './Sidebar'
import { Topbar } from './Topbar'
import { TabBar } from './TabBar'
import ErrorBoundary from './ErrorBoundary'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [openTabs, setOpenTabs] = useState([])

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role)),
    [user?.role]
  )

  const getTabByPath = useCallback(
    (pathname) =>
      [...visibleItems]
        .sort((a, b) => b.path.length - a.path.length)
        .find(item => pathname === item.path || pathname.startsWith(item.path + '/')),
    [visibleItems]
  )

  useEffect(() => {
    const tab = getTabByPath(location.pathname)
    if (!tab) return
    setOpenTabs(prev => {
      if (prev.some(t => t.id === tab.id)) return prev
      return [...prev, tab]
    })
  }, [location.pathname, getTabByPath])

  const activeTab = getTabByPath(location.pathname)
  const activeTabId = activeTab?.id ?? ''

  const handleTabClick = (id) => {
    const tab = NAV_ITEMS.find(item => item.id === id)
    if (tab) navigate(tab.path)
  }

  const handleTabClose = (id) => {
    const newTabs = openTabs.filter(t => t.id !== id)
    setOpenTabs(newTabs)

    if (activeTabId === id) {
      if (newTabs.length > 0) {
        navigate(newTabs[newTabs.length - 1].path)
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-['Inter',sans-serif] overflow-hidden text-slate-800 dark:text-slate-200 transition-colors">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        <TabBar
          openTabs={openTabs}
          activeTabId={activeTabId}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          <div className="p-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}
