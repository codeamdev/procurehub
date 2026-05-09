import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
            <AlertTriangle size={28} className="text-red-500 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
            Algo salió mal
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1 max-w-md">
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <pre className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2 max-w-lg overflow-auto text-left mt-2 mb-6">
            {this.state.error?.stack?.split('\n').slice(0, 6).join('\n')}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
          >
            <RefreshCw size={14} /> Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
