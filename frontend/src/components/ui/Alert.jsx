const TYPES = {
  error:   'bg-red-50 text-red-700 border-red-200',
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info:    'bg-blue-50 text-blue-700 border-blue-200',
}

export default function Alert({ type = 'error', message, onDismiss }) {
  if (!message) return null
  const colorClass = TYPES[type] || TYPES.error
  return (
    <div className={`flex justify-between items-start px-4 py-3 rounded-lg text-sm mb-3 border ${colorClass}`}>
      <span className="leading-relaxed">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-3 flex-shrink-0 text-lg leading-none opacity-60 hover:opacity-100 transition-opacity bg-transparent border-none cursor-pointer"
        >
          ×
        </button>
      )}
    </div>
  )
}
