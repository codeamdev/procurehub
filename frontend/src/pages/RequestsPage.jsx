import { useState } from 'react'
import { procurementAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { extractError } from '../utils/errors'
import RequestsView from '../views/RequestsView'

export default function RequestsPage() {
  const { user } = useAuth()
  const { data: requests, loading, error, refetch } = useApi(() => procurementAPI.listRequests(), [])
  const [showForm, setShowForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const isAdminOrBuyer = ['admin', 'buyer'].includes(user?.role)
  const allRequests = requests ?? []

  const filtered = allRequests.filter(r => {
    const matchesSearch = !searchQuery ||
      r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus
    return matchesSearch && matchesStatus
  })

  return (
    <RequestsView
      requests={filtered}
      loading={loading}
      error={error ? extractError(error) : null}
      isAdminOrBuyer={isAdminOrBuyer}
      showForm={showForm}
      onToggleForm={() => setShowForm(v => !v)}
      onFormCreated={() => { refetch(); setShowForm(false) }}
      onFormCancel={() => setShowForm(false)}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      filterStatus={filterStatus}
      onFilterChange={setFilterStatus}
      totalCount={allRequests.length}
      openCount={allRequests.filter(r => r.status === 'open').length}
      awardedCount={allRequests.filter(r => r.status === 'awarded').length}
    />
  )
}
