import { useState, useRef, useEffect } from 'react'
import { aiAPI } from '../services/api'
import { extractError } from '../utils/errors'
import { Send, Sparkles, CheckCircle2, X } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { toast } from 'sonner'

let _msgId = 1
const nextId = () => _msgId++

export default function AIPage() {
  const [messages, setMessages] = useState([
    {
      id: nextId(),
      role: 'assistant',
      content: { type: 'message', content: "¡Hola! Soy tu asistente de compras. Puedo crear solicitudes, recomendar proveedores o responder preguntas sobre tus pedidos." },
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { id: nextId(), role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const { data } = await aiAPI.chat(userMsg, {}, conversationId)
      if (data.conversation_id) setConversationId(data.conversation_id)
      const aiResponse = data.response
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: aiResponse }])
      if (aiResponse.type === 'create_request' && aiResponse.requires_confirmation) {
        setPendingRequest(aiResponse)
      }
    } catch {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        content: { type: 'message', content: 'Lo sentimos, algo salió mal. Por favor intenta de nuevo.' },
      }])
    } finally {
      setLoading(false)
    }
  }

  const confirmRequest = async () => {
    try {
      await aiAPI.confirmRequest(pendingRequest.preview, pendingRequest.workflow_id)
      setPendingRequest(null)
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        content: { type: 'message', content: '✅ ¡Solicitud creada exitosamente!' },
      }])
    } catch (err) {
      toast.error(extractError(err) || 'No se pudo crear la solicitud')
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto h-[calc(100vh-164px)]">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white leading-none">
            AI Procurement Assistant
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Crea solicitudes y obtén recomendaciones con inteligencia artificial
          </p>
        </div>
      </div>

      {/* Chat window */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden transition-colors">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm italic max-w-xs">
                Pensando…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Pending confirmation panel */}
      {pendingRequest && (
        <div className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <h4 className="font-semibold text-amber-800 dark:text-amber-400 mb-2 text-sm flex items-center gap-2">
            <CheckCircle2 size={15} /> Confirmar nueva solicitud:
          </h4>
          <pre className="text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 p-3 rounded-lg max-h-36 overflow-y-auto mb-3 border border-amber-100 dark:border-amber-900">
            {JSON.stringify(pendingRequest.preview, null, 2)}
          </pre>
          <div className="flex gap-2">
            <Button variant="emerald" size="sm" onClick={confirmRequest}>
              <CheckCircle2 size={14} /> Confirmar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPendingRequest(null)}>
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
          placeholder="Pregúntame algo… (ej. 'Crea una solicitud para 20 laptops')"
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl"
        />
        <Button type="submit" disabled={loading || !input.trim()} className="px-5 py-3 rounded-xl">
          <Send size={16} />
          Enviar
        </Button>
      </form>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const content = message.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
      }`}>
        {typeof content === 'string' ? (
          <p className="m-0">{content}</p>
        ) : content.type === 'message' ? (
          <p className="m-0">{content.content}</p>
        ) : content.type === 'recommend_suppliers' ? (
          <div>
            <p className="font-semibold mb-2">Proveedores recomendados:</p>
            {content.suppliers?.map(s => (
              <div key={s.id} className="bg-white dark:bg-slate-700 px-3 py-2 rounded-lg mt-1.5 border border-slate-200 dark:border-slate-600">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{s.company || s.email}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{s.email}</span>
              </div>
            ))}
            {content.reason && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">{content.reason}</p>
            )}
          </div>
        ) : content.type === 'create_request' ? (
          <p className="m-0">✨ Preparé una solicitud. Por favor confirma abajo.</p>
        ) : (
          <pre className="text-xs whitespace-pre-wrap m-0">{JSON.stringify(content, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
