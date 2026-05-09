import { useRef, useEffect } from 'react'
import { X } from 'lucide-react'

export function TabBar({ openTabs, activeTabId, onTabClick, onTabClose }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [activeTabId, openTabs.length])

  if (openTabs.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-2 relative h-12 flex-shrink-0 transition-colors">
      <div
        ref={scrollRef}
        className="flex items-end h-full overflow-x-auto w-full [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex gap-1 h-full pt-2 px-2">
          {openTabs.map((tab) => {
            const isActive = tab.id === activeTabId
            const Icon = tab.icon
            return (
              <div
                key={tab.id}
                data-active={isActive}
                onClick={() => onTabClick(tab.id)}
                className={`
                  group flex items-center gap-2 px-3 py-1.5 min-w-[120px] max-w-[200px] h-full
                  rounded-t-lg border-t border-x border-b-0 cursor-pointer transition-all shrink-0
                  ${isActive
                    ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 shadow-[0_2px_0_0_#f8fafc_inset] dark:shadow-[0_2px_0_0_#020617_inset] z-10'
                    : 'bg-white dark:bg-slate-900 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'}
                `}
                style={isActive ? { marginBottom: '-1px', paddingBottom: 'calc(0.375rem + 1px)' } : {}}
              >
                <Icon size={14} className={isActive ? 'text-blue-500 dark:text-blue-400 flex-shrink-0' : 'text-slate-400 dark:text-slate-500 flex-shrink-0'} />
                <span className="text-sm font-medium truncate flex-1 select-none">{tab.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                  className={`
                    p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity
                    ${isActive
                      ? 'opacity-100 text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300'}
                  `}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
