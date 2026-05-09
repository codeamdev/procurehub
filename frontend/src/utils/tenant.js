export function getSubdomain() {
  const hostname = window.location.hostname
  const parts = hostname.split('.')
  if (parts.length < 2) return null
  const sub = parts[0]
  if (sub === 'localhost' || sub === '127') return null
  return sub
}

export function isPublicDomain() {
  return getSubdomain() === null
}
