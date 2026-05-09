/**
 * ConditionBuilder — visual editor for JSON condition trees.
 *
 * A condition is one of:
 *   null                                      → always passes
 *   { type: "RULE", field, operator, value }  → leaf rule
 *   { type: "AND"|"OR", rules: [...] }        → composite
 *
 * Props:
 *   condition   — current condition value (JSON object or null)
 *   onChange    — (newCondition) => void
 *   fields      — [{key, label}] — available field keys for suggestions
 */
import { Plus, Trash2, ChevronDown } from 'lucide-react'

const OPERATORS = [
  { value: 'NOT_EMPTY',   label: 'tiene valor' },
  { value: 'IS_EMPTY',    label: 'está vacío' },
  { value: 'EQ',          label: '= igual a' },
  { value: 'NEQ',         label: '≠ distinto de' },
  { value: 'GT',          label: '> mayor que' },
  { value: 'LT',          label: '< menor que' },
  { value: 'GTE',         label: '≥ mayor o igual' },
  { value: 'LTE',         label: '≤ menor o igual' },
  { value: 'IN',          label: 'está en lista' },
  { value: 'CONTAINS',    label: 'contiene' },
  { value: 'STARTS_WITH', label: 'empieza con' },
  { value: 'REGEX',       label: 'coincide regex' },
]

const NO_VALUE_OPS = new Set(['NOT_EMPTY', 'IS_EMPTY'])

function emptyRule() {
  return { type: 'RULE', field: '', operator: 'NOT_EMPTY', value: '' }
}

function emptyGroup(type = 'AND') {
  return { type, rules: [emptyRule()] }
}

// ── Leaf rule ─────────────────────────────────────────────────────────────────
function RuleEditor({ rule, fields, onChange, onDelete }) {
  const showValue = !NO_VALUE_OPS.has(rule.operator)

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
      {/* Field selector */}
      <select
        value={rule.field}
        onChange={e => onChange({ ...rule, field: e.target.value })}
        className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        <option value="">— campo —</option>
        {fields.map(f => (
          <option key={f.key} value={f.key}>{f.label || f.key}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={rule.operator}
        onChange={e => onChange({ ...rule, operator: e.target.value })}
        className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
      >
        {OPERATORS.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>

      {/* Value input */}
      {showValue && (
        <input
          type="text"
          value={rule.value ?? ''}
          onChange={e => onChange({ ...rule, value: e.target.value })}
          placeholder="valor"
          className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-violet-500 w-28"
        />
      )}

      <button
        onClick={onDelete}
        className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
        title="Eliminar regla"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Composite group (AND / OR) ─────────────────────────────────────────────────
function GroupEditor({ group, fields, onChange, onDelete, depth = 0 }) {
  const bgClass = depth === 0
    ? 'bg-slate-50 dark:bg-slate-800/50'
    : 'bg-blue-50/40 dark:bg-blue-900/10'

  const updateRule = (idx, newRule) => {
    const rules = [...group.rules]
    rules[idx] = newRule
    onChange({ ...group, rules })
  }

  const deleteRule = (idx) => {
    const rules = group.rules.filter((_, i) => i !== idx)
    onChange({ ...group, rules })
  }

  const addRule = () => onChange({ ...group, rules: [...group.rules, emptyRule()] })
  const addGroup = () => onChange({ ...group, rules: [...group.rules, emptyGroup('AND')] })

  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700 p-3 ${bgClass}`}>
      {/* Group type toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
          {['AND', 'OR'].map(t => (
            <button
              key={t}
              onClick={() => onChange({ ...group, type: t })}
              className={`text-xs px-3 py-1 font-semibold transition-colors ${
                group.type === t
                  ? 'bg-violet-600 text-white'
                  : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {group.type === 'AND' ? 'Todas deben cumplirse' : 'Al menos una debe cumplirse'}
        </span>
        {onDelete && (
          <button
            onClick={onDelete}
            className="ml-auto text-slate-400 hover:text-red-500 transition-colors"
            title="Eliminar grupo"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Rules */}
      <div className="flex flex-col gap-2">
        {group.rules.map((rule, idx) => (
          rule.type === 'RULE'
            ? <RuleEditor
                key={idx}
                rule={rule}
                fields={fields}
                onChange={r => updateRule(idx, r)}
                onDelete={() => deleteRule(idx)}
              />
            : <GroupEditor
                key={idx}
                group={rule}
                fields={fields}
                onChange={r => updateRule(idx, r)}
                onDelete={() => deleteRule(idx)}
                depth={depth + 1}
              />
        ))}
      </div>

      {/* Add controls */}
      <div className="flex gap-2 mt-3">
        <button
          onClick={addRule}
          className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium"
        >
          <Plus size={12} /> Regla
        </button>
        {depth < 2 && (
          <button
            onClick={addGroup}
            className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
          >
            <Plus size={12} /> Grupo
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ConditionBuilder({ condition, onChange, fields = [] }) {
  const isEmpty = !condition

  const initCondition = () => onChange(emptyGroup('AND'))
  const clearCondition = () => onChange(null)

  return (
    <div>
      {isEmpty ? (
        <button
          onClick={initCondition}
          className="flex items-center gap-2 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-700 font-medium border border-dashed border-violet-300 dark:border-violet-700 rounded-lg px-3 py-2"
        >
          <Plus size={12} /> Agregar condición
        </button>
      ) : (
        <div className="space-y-2">
          <GroupEditor
            group={condition.type === 'RULE' ? { type: 'AND', rules: [condition] } : condition}
            fields={fields}
            onChange={onChange}
            depth={0}
          />
          <button
            onClick={clearCondition}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Quitar condición
          </button>
        </div>
      )}
    </div>
  )
}
