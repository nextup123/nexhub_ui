// Talks to the release hub. After sign-in the session (server address, token, the person and
// what their role allows) is kept for this browser tab, or on this computer with "Remember me".

const STORE = 'nx-hub-session'

// Where the hub (the API on Render) is. The dashboard runs on your own computer, so the address
// comes from VITE_HUB_URL in .env.local, or the one last used on the sign-in screen.
const HUB_KEY = 'nx-hub-url'
export function defaultHubUrl() {
  try { const saved = localStorage.getItem(HUB_KEY); if (saved) return saved } catch { /* private mode */ }
  const fromBuild = (import.meta.env.VITE_HUB_URL || '').trim().replace(/\/$/, '')
  return fromBuild || 'https://nexhub-x2s6.onrender.com/'
}
export function rememberHubUrl(url) {
  try { localStorage.setItem(HUB_KEY, url) } catch { /* private mode */ }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORE) || localStorage.getItem(STORE)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
export function saveSession(s) {
  try {
    const raw = JSON.stringify(s)
    sessionStorage.setItem(STORE, raw)
    if (s.remember) localStorage.setItem(STORE, raw)
    else localStorage.removeItem(STORE)
  } catch { /* private mode: lives in memory only */ }
}
export function clearSession() {
  try { sessionStorage.removeItem(STORE); localStorage.removeItem(STORE) } catch { /* ignore */ }
}

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data }
}

const qs = (o = {}) => {
  const p = new URLSearchParams()
  Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== false) p.set(k, v) })
  const s = p.toString()
  return s ? `?${s}` : ''
}

/** Calls without a session (sign-in, first setup). */
export async function publicCall(hub, method, path, body) {
  let res
  try {
    res = await fetch(`${hub.replace(/\/$/, '')}/api/v1${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new ApiError('Cannot reach the server. On the free Render plan it may be waking up: try again in a minute.', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `The server answered ${res.status}`, res.status, data)
  return data
}

export function createClient({ hub, token }) {
  const base = `${hub.replace(/\/$/, '')}/api/v1`
  async function call(method, path, body) {
    let res
    try {
      res = await fetch(base + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      })
    } catch {
      throw new ApiError('Cannot reach the server. On the free Render plan it may be waking up: try again in a minute.', 0)
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new ApiError(data.error || `The server answered ${res.status}`, res.status, data)
    return data
  }
  const c = {
    get: (path, query) => call('GET', path + qs(query)),
    post: (path, body) => call('POST', path, body || {}),
    patch: (path, body) => call('PATCH', path, body),
    put: (path, body) => call('PUT', path, body),
    del: (path) => call('DELETE', path),
    async download(path, query, filename) {
      const res = await fetch(base + path + qs(query), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new ApiError('Download failed', res.status)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await res.blob())
      a.download = filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    },
  }
  // Website enquiries (used by Overview, Inbox and Detail).
  c.enquiries = {
    list: (filters) => c.get('/contact-submissions', filters),
    summary: (days = 30) => c.get('/contact-submissions/summary', { days, tzOffset: new Date().getTimezoneOffset() }),
    get: (id) => c.get(`/contact-submissions/${id}`),
    patch: (id, body) => c.patch(`/contact-submissions/${id}`, body),
    note: (id, text) => c.post(`/contact-submissions/${id}/notes`, { text }),
    remove: (id) => c.del(`/contact-submissions/${id}`),
    exportCsv: (filters) => c.download('/contact-submissions/export.csv', filters, `nextup-enquiries-${new Date().toISOString().slice(0, 10)}.csv`),
  }
  return c
}
