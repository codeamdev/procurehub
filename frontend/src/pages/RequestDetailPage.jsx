import { useParams } from 'react-router-dom'
import { procurementAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { extractError } from '../utils/errors'
import RequestDetailView from '../views/RequestDetailView'

export default function RequestDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: request, loading, error, refetch } = useApi(
    () => procurementAPI.getRequest(id),
    [id]
  )

  const isAdminOrBuyer = ['admin', 'buyer'].includes(user?.role)
  const isSupplier = user?.role === 'supplier'
  const myProposal = isSupplier
    ? request?.proposals?.find(p => p.supplier_email === user.email)
    : null

  const handleAward = async (proposalId) => {
    try { await procurementAPI.awardRequest(id, proposalId); refetch() }
    catch (err) { alert(extractError(err)) }
  }

  const handleClose = async () => {
    try { await procurementAPI.closeRequest(id); refetch() }
    catch (err) { alert(extractError(err)) }
  }

  return (
    <RequestDetailView
      request={request}
      loading={loading}
      error={error ? extractError(error) : null}
      isAdminOrBuyer={isAdminOrBuyer}
      isSupplier={isSupplier}
      myProposal={myProposal}
      backPath={isSupplier ? '/marketplace' : '/requests'}
      backLabel={isSupplier ? 'Marketplace' : 'Solicitudes'}
      onAward={handleAward}
      onClose={handleClose}
      onProposalSubmitted={refetch}
      requestId={id}
    />
  )
}
