import { useState } from 'react'

/**
 * Lightweight form state hook.
 * Works with standard HTML inputs (name attribute required).
 *
 * Usage:
 *   const { values, handleChange, reset, setValues } = useForm({ title: '', budget: '' })
 *   <input name="title" value={values.title} onChange={handleChange} />
 */
export default function useForm(initialValues) {
  const [values, setValues] = useState(initialValues)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const reset = () => setValues(initialValues)

  return { values, setValues, handleChange, reset }
}
