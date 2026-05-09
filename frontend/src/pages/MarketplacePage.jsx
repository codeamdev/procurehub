import { procurementAPI } from '../services/api'
import useApi from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { extractError } from '../utils/errors'
import { PendingApprovalState, MarketplaceView } from '../views/MarketplaceView'

export default function MarketplacePage() {
  const { user } = useAuth()

  if (!user?.is_approved) {
    return <PendingApprovalState email={user?.email} />
  }

  return <ApprovedMarketplace />
}

function ApprovedMarketplace() {
  const { data: requests, loading, error } = useApi(() => procurementAPI.listRequests(), [])

  return (
    <MarketplaceView
      requests={requests}
      loading={loading}
      error={error ? extractError(error) : null}
    />
  )
}
