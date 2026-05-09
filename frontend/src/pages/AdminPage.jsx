import { useState } from 'react'
import { supplierAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { extractError } from '../utils/errors'
import AdminView from '../views/AdminView'

export default function AdminPage() {
  const { data: suppliers, loading, error, refetch } = useApi(() => supplierAPI.list(), [])
  const [actionError, setActionError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const handleAction = async (id, action) => {
    setActionError(null)
    setActingId(id)
    try {
      await (action === 'approve' ? supplierAPI.approve(id) : supplierAPI.reject(id))
      refetch()
    } catch (err) {
      setActionError(extractError(err))
    } finally {
      setActingId(null)
    }
  }

  const allSuppliers = suppliers ?? []
  const filtered = allSuppliers.filter(s =>
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AdminView
      suppliers={filtered}
      loading={loading}
      error={error ? extractError(error) : null}
      actionError={actionError}
      actingId={actingId}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onApprove={(id) => handleAction(id, 'approve')}
      onReject={(id) => handleAction(id, 'reject')}
      onRefresh={refetch}
      onDismissError={() => setActionError(null)}
      totalCount={allSuppliers.length}
      pendingCount={allSuppliers.filter(s => !s.is_approved).length}
      approvedCount={allSuppliers.filter(s => s.is_approved).length}
    />
  )
}
