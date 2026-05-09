import { useState, useEffect, useCallback } from 'react'

/**
 * Generic data-fetching hook.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi(
 *     () => procurementAPI.listRequests(),
 *     []  // dependency array — refetches when these change
 *   )
 *
 * apiFn must be stable or wrapped in useCallback; deps drives re-execution.
 */
export default function useApi(apiFn, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFn()
      setData(res.data?.results ?? res.data)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, deps) // deps intentionally spread here

  useEffect(() => { refetch() }, [refetch])

  return { data, loading, error, refetch }
}
