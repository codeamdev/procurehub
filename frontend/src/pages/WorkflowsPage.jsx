import { useState } from 'react'
import { ArrowLeft, Workflow } from 'lucide-react'
import { workflowAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { extractError } from '../utils/errors'
import WorkflowWizard from '../components/WorkflowWizard'
import WorkflowsView from '../views/WorkflowsView'

export default function WorkflowsPage() {
  const { data: workflows, loading, error } = useApi(() => workflowAPI.list(), [])
  const [activeRequestId, setActiveRequestId] = useState(null)
  const [starting, setStarting] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const startWorkflow = async (workflowDefinitionId) => {
    setStarting(workflowDefinitionId)
    try {
      const { data } = await workflowAPI.createRequest({
        workflow_definition_id: workflowDefinitionId,
      })
      setActiveRequestId(data.id)
    } catch (err) {
      alert(extractError(err))
    } finally {
      setStarting(null)
    }
  }

  const handleDone = () => {
    // Keep the wizard visible to show terminal state
  }

  if (activeRequestId) {
    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => setActiveRequestId(null)}
          className="flex items-center gap-2 mb-4 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={16} /> Volver a Workflows
        </button>
        <WorkflowWizard
          requestId={activeRequestId}
          onDone={handleDone}
        />
      </div>
    )
  }

  const allWorkflows = workflows ?? []
  const filtered = searchQuery
    ? allWorkflows.filter(wf =>
        wf.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wf.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allWorkflows

  return (
    <WorkflowsView
      workflows={filtered}
      loading={loading}
      error={error ? extractError(error) : null}
      starting={starting}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onStart={startWorkflow}
      totalCount={allWorkflows.length}
    />
  )
}
