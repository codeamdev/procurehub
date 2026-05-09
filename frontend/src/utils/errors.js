/**
 * Extracts a readable error message from an axios error response.
 * Backend sends: {error, code} | {errors, code} | {detail} | field map
 */
export function extractError(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data
  if (!data) return err?.message || fallback

  if (typeof data === 'string') return data
  if (data.error) return data.error
  if (data.detail) return String(data.detail)
  if (data.non_field_errors) return data.non_field_errors.join(', ')

  // Field-level errors: {field: ["msg"]} or {errors: {field: "msg"}}
  const fieldErrors = data.errors || data
  if (typeof fieldErrors === 'object') {
    const messages = Object.entries(fieldErrors)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    if (messages.length) return messages.join(' | ')
  }

  return fallback
}
