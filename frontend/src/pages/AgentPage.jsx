import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { aiAPI } from '../services/api'
import { extractError } from '../utils/errors'
import { Send, Bot, CheckCircle2, X, AlertCircle } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'

let _msgId = 1
const nextId = () => _msgId++

const ROLE_HINTS = {
  admin:    'Ej: "Lista proveedores pendientes" · "Aprueba al proveedor ID 5"',
  buyer:    'Ej: "Busca proveedores de tecnología" · "Muestra el proveedor 3"',
  supplier: 'Ej: "Muestra mi perfil" · "Actualiza mi teléfono"',
}

export default function AgentPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([{
    id: nextId(),
    role: 'assistant',
    content: {
      type: 'message',
      content: '¡Hola! Soy el agente de gestión de proveedores. Puedo ayudarte a consultar, aprobar o actualizar el directorio de proveedores.',
    },
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const pushAssistant = (content) =>
    setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content }])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const { data } = await aiAPI.agentChat(userMsg, conversationId)
      if (data.conversation_id) setConversationId(data.conversation_id)
      const res = data.response
      pushAssistant(res)
      if (res.type === 'pending_action') setPendingAction(res)
    } catch (err) {
      pushAssistant({ type: 'message', content: extractError(err) || 'Error al conectar con el agente.' })
    } finally {
      setLoading(false)
    }
  }

  const confirmAction = async () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    setLoading(true)
    try {
      const { data } = await aiAPI.agentConfirm(action.tool, action.args, conversationId)
      if (data.conversation_id) setConversationId(data.conversation_id)
      pushAssistant(data.response)
    } catch (err) {
      toast.error(extractError(err) || 'No se pudo ejecutar la acción.')
    } finally {
      setLoading(false)
    }
  }

  const cancelAction = () => {
    setPendingAction(null)
    pushAssistant({ type: 'message', content: 'Acción cancelada.' })
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto h-[calc(100vh-164px)]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center flex-shrink-0">
          <Bot size={18} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white leading-none">
            Agente de Proveedores
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Consulta y gestión conversacional con inteligencia artificial
          </p>
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {messages.map(msg => (
            <AgentBubble key={msg.id} message={msg} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm italic">
                Procesando…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Pending write confirmation */}
      {pendingAction && (
        <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Confirmar acción antes de ejecutar
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                {pendingAction.preview}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmAction} disabled={loading}>
              <CheckCircle2 size={14} /> Confirmar
            </Button>
            <Button variant="secondary" size="sm" onClick={cancelAction} disabled={loading}>
              <X size={14} /> Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-3 flex-shrink-0">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={ROLE_HINTS[user?.role] ?? 'Escribe tu consulta…'}
          disabled={loading || !!pendingAction}
          className="flex-1 px-4 py-3 rounded-xl"
        />
        <Button
          type="submit"
          disabled={loading || !input.trim() || !!pendingAction}
          className="px-5 py-3 rounded-xl"
        >
          <Send size={16} /> Enviar
        </Button>
      </form>
    </div>
  )
}

// ── Bubble components ─────────────────────────────────────────────────────────

function AgentBubble({ message }) {
  const isUser = message.role === 'user'
  const content = message.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-violet-600 text-white rounded-tr-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
      }`}>
        {typeof content === 'string' ? (
          <p className="m-0">{content}</p>
        ) : content.type === 'message' ? (
          <p className="m-0 whitespace-pre-wrap">{content.content}</p>
        ) : content.type === 'pending_action' ? (
          <p className="m-0 italic text-slate-500 dark:text-slate-400">
            ↑ Acción propuesta — revisa el panel de confirmación.
          </p>
        ) : content.type === 'action_confirmed' ? (
          <ConfirmedResult result={content} />
        ) : content.type === 'error' ? (
          <p className="m-0 text-red-600 dark:text-red-400">{content.content}</p>
        ) : (
          <pre className="text-xs whitespace-pre-wrap m-0">{JSON.stringify(content, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}

function ConfirmedResult({ result }) {
  if (!result.success) {
    return (
      <p className="m-0 text-red-600 dark:text-red-400">
        ✗ {result.error || 'La acción falló.'}
      </p>
    )
  }
  const supplier = result.supplier ?? null
  return (
    <div>
      <p className="m-0 font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
        ✓ Acción completada
      </p>
      {supplier && (
        <div className="text-xs bg-white dark:bg-slate-700 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600">
          <span className="font-semibold">{supplier.company_name || supplier.email}</span>
          <span className="text-slate-500 dark:text-slate-400 ml-1">({supplier.email})</span>
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            supplier.is_approved
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
          }`}>
            {supplier.is_approved ? 'Aprobado' : 'Rechazado'}
          </span>
        </div>
      )}
    </div>
  )
}
