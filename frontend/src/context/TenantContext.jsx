import { createContext, useContext } from 'react'
import { getSubdomain } from '../utils/tenant'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const subdomain = getSubdomain()

  const companyName = subdomain
    ? subdomain.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : null

  return (
    <TenantContext.Provider value={{ subdomain, companyName }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)
