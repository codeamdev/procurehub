/**
 * FieldManager — CRUD for workflow fields.
 * Props:
 *   workflowId   — UUID
 *   fields       — [{id, key, label, field_type, options, order}]
 *   readOnly     — bool
 *   onRefresh    — () => void
 */
import { useState } from 'react'
import { Plus, Pencil, Trash2, Hash, Type, Calendar, List, ToggleLeft, File, Mail, Phone, DollarSign } from 'lucide-react'
import { workflowDefAPI } from '../../services/api'
import { extractError } from '../../utils/errors'

const FIELD_TYPES = [
  { value: 'text',        label: 'Texto',          icon: Type },
  { value: 'textarea',    label: 'Área de texto',  icon: Type },
  { value: 'number',      label: 'Número',         icon: Hash },
  { value: 'currency',    label: 'Moneda',         icon: DollarSign },
  { value: 'date',        label: 'Fecha',          icon: Calendar },
  { value: 'datetime',    label: 'Fecha y hora',   icon: Calendar },
  { value: 'boolean',     label: 'Sí / No',        icon: ToggleLeft },
  { value: 'select',      label: 'Selección única',icon: List },
  { value: 'multiselect', label: 'Selección múlt.',icon: List },
  { value: 'file',        label: 'Archivo',        icon: File },
  { value: 'email',       label: 'Email',          icon: Mail },
  { value: 'phone',       label: 'Teléfono',       icon: Phone },
]

const TYPE_MAP = Object.fromEntries(FIELD_TYPES.map(t => [t.value, t]))

function FieldTypeIcon({ type, size = 14 }) {
  const entry = TYPE_MAP[type]
  const Icon = entry?.icon ?? Type
  return <Icon size={size} className="text-slate-400" />
}

function FieldForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial ?? {
    key: '', label: '', field_type: 'text', options: [], order: 0,
  })
  const [optionInput, setOptionInput] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isSelect = form.field_type === 'select' || form.field_type === 'multiselect'

  const addOption = () => {
    const trimmed = optionInput.trim()
    if (!trimmed) return
    set('options', [...(form.options || []), trimmed])
    setOptionInput('')
  }

  const removeOption = (idx) => set('options', form.options.filter((_, i) => i !== idx))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Clave programática * <span className="text-slate-400 font-normal">(ej: vendor_name)</span>
          </label>
          <input
            value={form.key}
            onChange={e => set('key', e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
            placeholder="nombre_campo"
            className="w-full text-sm font-mono border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Etiqueta visible *
          </label>
          <input
            value={form.label}
            onChange={e => set('label', e.target.value)}
            placeholder="Nombre del Proveedor"
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
            Tipo de campo
          </label>
          <select
            value={form.field_type}
            onChange={e => set('field_type', e.target.value)}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">Orden</label>
          <input
            type="number"
            value={form.order}
            onChange={e => set('order', parseInt(e.target.value, 10))}
            className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {isSelect && (
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-2">
            Opciones de selección
          </label>
          <div className="flex gap-2 mb-2">
            <input
              value={optionInput}
              onChange={e => setOptionInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addOption()}
              placeholder="Nueva opción…"
              className="flex-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              onClick={addOption}
              className="px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(form.options || []).map((opt, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2.5 py-1 rounded-full"
              >
                {opt}
                <button
                  onClick={() => removeOption(idx)}
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSubmit(form)}
          disabled={loading || !form.key.trim() || !form.label.trim()}
          className="px-4 py-2 text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar campo'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function FieldManager({ workflowId, fields = [], readOnly, onRefresh }) {
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async (form) => {
    setLoading(true)
    setError(null)
    try {
      if (editing === 'new') {
        await workflowDefAPI.createField(workflowId, form)
      } else {
        await workflowDefAPI.updateField(workflowId, editing.id, form)
      }
      setEditing(null)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (field) => {
    if (!confirm(`¿Eliminar campo "${field.label}"?`)) return
    setError(null)
    try {
      await workflowDefAPI.deleteField(workflowId, field.id)
      onRefresh()
    } catch (err) {
      setError(extractError(err))
    }
  }

  const sorted = [...fields].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {sorted.map(field => (
          <div key={field.id}>
            {editing?.id === field.id ? (
              <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
                <FieldForm
                  initial={field}
                  onSubmit={handleSave}
                  onCancel={() => setEditing(null)}
                  loading={loading}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group">
                <FieldTypeIcon type={field.field_type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{field.label}</span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">({field.key})</span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                    {TYPE_MAP[field.field_type]?.label ?? field.field_type}
                    {field.options?.length > 0 && ` · ${field.options.length} opciones`}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditing(field)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 rounded transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(field)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {sorted.length === 0 && (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
            No hay campos configurados.
          </div>
        )}
      </div>

      {!readOnly && editing !== 'new' && (
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 border border-dashed border-violet-300 dark:border-violet-700 rounded-xl px-4 py-3 w-full justify-center transition-colors"
        >
          <Plus size={16} /> Agregar campo
        </button>
      )}

      {editing === 'new' && (
        <div className="border border-violet-200 dark:border-violet-800 rounded-xl p-4 bg-violet-50/30 dark:bg-violet-900/10">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Nuevo campo</p>
          <FieldForm
            initial={{ key: '', label: '', field_type: 'text', options: [], order: sorted.length }}
            onSubmit={handleSave}
            onCancel={() => setEditing(null)}
            loading={loading}
          />
        </div>
      )}
    </div>
  )
}
