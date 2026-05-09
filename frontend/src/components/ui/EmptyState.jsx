export default function EmptyState({ icon = '📋', title, description, action }) {
  return (
    <div className="flex flex-col items-center py-16 px-4 text-center">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <h3 className="text-sm font-semibold text-slate-600 mb-1.5">{title}</h3>
      {description && (
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-5">{description}</p>
      )}
      {action}
    </div>
  )
}
