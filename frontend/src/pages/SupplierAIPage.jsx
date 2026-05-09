import { useState, useRef, useEffect } from 'react'
import { aiAPI, procurementAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { Send, Bot, Lightbulb, Copy, Check } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'

const QUICK_ACTIONS = [
  { label: 'Explicar solicitud', prompt: 'Explain this request' },
  { label: 'Sugerir precio', prompt: 'Suggest a price for this request' },
  { label: 'Redactar propuesta', prompt: 'Generate a proposal draft for this request' },
]

const CONFIDENCE_COLORS = {
  high:   'bg-emerald-500',
  medium: 'bg-amber-500',
  low:    'bg-red-500',
}

export default function SupplierAIPage() {
  const { data: requests, loading: reqLoading } = useApi(() => procurementAPI.listRequests(), [])
  const [selectedRequestId, setSelectedRequestId] = useState(null)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: { type: 'message', content: "¡Hola! Soy tu asesor de propuestas con IA. Selecciona una solicitud y pídeme que la explique, sugiera un precio o redacte una propuesta." },
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [suggestions, setSuggestions] = useState(null)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleRequestChange = (e) => {
    const id = e.target.value ? Number(e.target.value) : null
    setSelectedRequestId(id)
    setSuggestions(null)
    setShowSuggestions(false)
    setConversationId(null)
  }

  const loadSuggestions = async () => {
    if (!selectedRequestId) return
    setSuggestionsLoading(true)
    setShowSuggestions(true)
    try {
      const { data } = await aiAPI.supplierSuggestions(selectedRequestId)
      setSuggestions(data)
    } catch {
      setSuggestions(null)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const { data } = await aiAPI.supplierChat(msg, selectedRequestId, conversationId)
      if (data.conversation_id) setConversationId(data.conversation_id)
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: { type: 'message', content: 'Algo salió mal. Por favor intenta de nuevo.' },
      }])
    } finally {
      setLoading(false)
    }
  }

  const selectedRequest = requests?.find(r => r.id === selectedRequestId)

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 164px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white leading-none">
              AI Proposal Advisor
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Insights con IA para redactar propuestas ganadoras
            </p>
          </div>
        </div>
        {selectedRequestId && (
          <Button
            onClick={loadSuggestions}
            disabled={suggestionsLoading}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Lightbulb size={15} />
            {suggestionsLoading ? 'Cargando…' : showSuggestions ? 'Actualizar' : 'Obtener sugerencias'}
          </Button>
        )}
      </div>

      {/* Request selector */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
          Solicitud activa:
        </label>
        {reqLoading ? (
          <div className="h-9 flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        ) : (
          <Select
            value={selectedRequestId ?? ''}
            onChange={handleRequestChange}
            className="flex-1"
          >
            <option value="">— Sin selección (chat general) —</option>
            {requests?.map(r => (
              <option key={r.id} value={r.id}>
                {r.title} · ${Number(r.budget).toLocaleString()} · {r.category}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Body */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          {/* Messages */}
          <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-y-auto p-5 flex flex-col gap-3 transition-colors">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl rounded-tl-sm px-4 py-3 text-sm italic">
                  Pensando…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick actions */}
          <div className="flex-shrink-0 flex gap-2 flex-wrap">
            {QUICK_ACTIONS.map(a => (
              <button
                key={a.label}
                onClick={() => sendMessage(a.prompt)}
                disabled={loading}
                className="px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800 rounded-full text-xs font-semibold hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="flex-shrink-0 flex gap-3">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={selectedRequest ? `Pregunta sobre "${selectedRequest.title}"…` : 'Pregunta sobre propuestas…'}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-xl focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-500"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700"
            >
              <Send size={16} /> Enviar
            </Button>
          </form>
        </div>

        {/* Suggestions panel */}
        {showSuggestions && (
          <div className="w-72 flex-shrink-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-4 overflow-y-auto transition-colors">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <Lightbulb size={15} className="text-indigo-500" /> Sugerencias IA
            </h3>
            {suggestionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : suggestions ? (
              <SuggestionsPanel suggestions={suggestions} />
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500">No se pudieron cargar las sugerencias.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const content = message.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[76%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-indigo-600 text-white rounded-tr-sm'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
      }`}>
        {typeof content === 'string' ? (
          <p className="m-0">{content}</p>
        ) : content.type === 'message' ? (
          <p className="m-0" dangerouslySetInnerHTML={{
            __html: content.content
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br/>')
          }} />
        ) : content.type === 'explanation' ? (
          <ExplanationCard data={content} />
        ) : content.type === 'price_suggestion' ? (
          <PriceCard data={content} />
        ) : content.type === 'proposal_draft' ? (
          <DraftCard data={content} />
        ) : (
          <pre className="text-xs whitespace-pre-wrap m-0">{JSON.stringify(content, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}

function ExplanationCard({ data }) {
  return (
    <div>
      <p className="m-0 mb-2">{data.content}</p>
      {data.key_requirements?.length > 0 && (
        <div className="bg-white dark:bg-slate-700 rounded-lg p-2.5 mt-2 border-l-2 border-indigo-500">
          <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Requisitos clave</p>
          <ul className="m-0 pl-4 text-xs leading-relaxed">
            {data.key_requirements.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
      {data.risks?.length > 0 && (
        <div className="bg-white dark:bg-slate-700 rounded-lg p-2.5 mt-2 border-l-2 border-amber-500">
          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Riesgos</p>
          <ul className="m-0 pl-4 text-xs leading-relaxed">
            {data.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function PriceCard({ data }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
          ${Number(data.suggested_price).toLocaleString()}
        </span>
        <span className={`text-[11px] font-bold text-white px-2 py-0.5 rounded-full ${CONFIDENCE_COLORS[data.confidence] ?? 'bg-slate-500'}`}>
          {data.confidence}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
        Rango: ${Number(data.range?.min).toLocaleString()} – ${Number(data.range?.max).toLocaleString()}
      </p>
      <p className="text-xs mt-2 m-0">{data.reasoning}</p>
    </div>
  )
}

function DraftCard({ data }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(data.message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div>
      <div className="flex gap-4 text-xs mb-2 text-slate-600 dark:text-slate-300">
        <span>Precio: <strong>${Number(data.price).toLocaleString()}</strong></span>
        <span>Entrega: <strong>{data.delivery_time} días</strong></span>
      </div>
      <pre className="text-xs bg-white dark:bg-slate-700 p-2.5 rounded-lg whitespace-pre-wrap m-0 border border-slate-200 dark:border-slate-600 max-h-40 overflow-y-auto">
        {data.message}
      </pre>
      <button
        onClick={copy}
        className="flex items-center gap-1.5 mt-2 px-3 py-1 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded text-xs font-semibold transition-colors"
      >
        {copied ? <><Check size={12} /> ¡Copiado!</> : <><Copy size={12} /> Copiar</>}
      </button>
    </div>
  )
}

function SuggestionsPanel({ suggestions }) {
  const ps = suggestions.price_suggestion
  const ds = suggestions.delivery_suggestion
  const pt = suggestions.proposal_template
  const ci = suggestions.competitive_insights

  return (
    <div className="flex flex-col gap-3">
      {ps && (
        <SuggestCard title="Precio">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              ${Number(ps.suggested).toLocaleString()}
            </span>
            <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full ${CONFIDENCE_COLORS[ps.confidence] ?? 'bg-slate-500'}`}>
              {ps.confidence}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            ${Number(ps.range?.min).toLocaleString()} – ${Number(ps.range?.max).toLocaleString()}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ps.reasoning}</p>
        </SuggestCard>
      )}
      {ds && (
        <SuggestCard title="Entrega">
          <p className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mb-1">{ds.days} días</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ds.reasoning}</p>
        </SuggestCard>
      )}
      {ci && (
        <SuggestCard title="Competencia">
          <p className="text-sm text-slate-800 dark:text-slate-200 mb-1">
            <strong>{ci.competing_proposals}</strong> propuesta{ci.competing_proposals !== 1 ? 's' : ''} competidora{ci.competing_proposals !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{ci.tip}</p>
        </SuggestCard>
      )}
      {pt && (
        <SuggestCard title="Plantilla">
          <div className="flex gap-3 text-xs text-slate-600 dark:text-slate-300 mb-2">
            <span>Precio: <strong>${Number(pt.price).toLocaleString()}</strong></span>
            <span>Entrega: <strong>{pt.delivery_time} días</strong></span>
          </div>
          <pre className="text-xs bg-white dark:bg-slate-700 p-2 rounded border border-slate-200 dark:border-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {pt.message}
          </pre>
        </SuggestCard>
      )}
    </div>
  )
}

function SuggestCard({ title, children }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
      <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}
