const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export async function api(path, { method = 'GET', body } = {}) {
  const token = sessionStorage.getItem('token')
  const url = path.startsWith('http') ? path : `${API_URL}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 204) return null
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Request failed.')
    error.details = payload?.error?.details || []
    error.status = response.status
    throw error
  }
  return payload
}

export async function downloadCsv(path, filename) {
  const token = sessionStorage.getItem('token')
  const url = path.startsWith('http') ? path : `${API_URL}${path}`
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error?.message || 'Export failed.')
  }
  const blob = await response.blob()
  const url_obj = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url_obj
  link.download = filename
  link.click()
  URL.revokeObjectURL(url_obj)
}

export function roleLabel(name) {
  return String(name || '').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

export function peso(value) {
  const number = Number(value || 0)
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(number)
}

export function when(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

