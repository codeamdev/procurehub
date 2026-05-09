export default function Spinner({ size = 28, center = true }) {
  const spinner = (
    <>
      <div style={{
        width: size, height: size,
        border: '3px solid #e2e8f0',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.65s linear infinite',
        flexShrink: 0,
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
  if (!center) return spinner
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem' }}>
      {spinner}
    </div>
  )
}
