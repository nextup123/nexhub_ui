// Talks to the release hub. After sign-in the session (server address, token, the person and
// what their role allows) is kept for this browser tab, or on this computer with "Remember me".

import { MOBILE, saveFile } from './native'

const STORE = 'nx-hub-session'

// Where the hub (the API on Render) is. The dashboard runs on your own computer, so the address
// comes from VITE_HUB_URL in .env or .env.local, or the one last used on the sign-in screen.
// Changing VITE_HUB_URL (and restarting) wins over an address remembered from before.
const HUB_KEY = 'nx-hub-url'
const HUB_FROM_KEY = 'nx-hub-url-env'
// Forgiving about what is pasted: quotes, a trailing slash or /api/v1, or no https://.
export function cleanHubUrl(u) {
  const v = String(u || '').trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '').replace(/\/api\/v1$/, '').replace(/\/+$/, '')
  if (!v || /^https?:\/\//i.test(v)) return v
  return (/^(localhost|127\.|192\.168\.|10\.)/.test(v) ? 'http://' : 'https://') + v
}
const FROM_BUILD = cleanHubUrl(import.meta.env.VITE_HUB_URL)
export function defaultHubUrl() {
  // The phone app always uses the address it was built with; it is never typed or shown.
  if (MOBILE) return FROM_BUILD
  try {
    const saved = localStorage.getItem(HUB_KEY)
    if (saved && (localStorage.getItem(HUB_FROM_KEY) || '') === FROM_BUILD) return saved
  } catch { /* private mode */ }
  return FROM_BUILD || 'http://localhost:4060'
}
export function rememberHubUrl(url) {
  if (MOBILE) return
  try { localStorage.setItem(HUB_KEY, cleanHubUrl(url)); localStorage.setItem(HUB_FROM_KEY, FROM_BUILD) } catch { /* private mode */ }
}

export function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORE) || localStorage.getItem(STORE)
    const s = raw ? JSON.parse(raw) : null
    // A new app version may point at a new address: a session from another server is dropped.
    if (s && MOBILE && s.hub !== FROM_BUILD) return null
    return s
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
  // Answers are kept in memory, so opening a page you have seen shows it at once. An answer older
  // than FRESH_MS (or marked stale by a live "change" from the hub) is shown at once too, and fetched
  // again in the background; if it changed, onChange listeners hear about it and the page redraws.
  // Any change you make (post, patch, put, delete) empties the store, so you always see your own edits.
  const FRESH_MS = 60000
  const cache = new Map() // key -> { data, at, stale }
  const inflight = new Map() // key -> promise
  const listeners = new Set()
  let gen = 0
  const fetchInto = (key) => {
    if (inflight.has(key)) return inflight.get(key)
    const g = gen
    const p = call('GET', key).then((data) => {
      if (g === gen) {
        const before = cache.get(key)
        cache.set(key, { data, at: Date.now(), stale: false })
        if (before && JSON.stringify(before.data) !== JSON.stringify(data)) listeners.forEach((fn) => fn(key))
      }
      return data
    }).finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }
  const get = (path, query) => {
    const key = path + qs(query)
    const hit = cache.get(key)
    if (!hit) return fetchInto(key)
    if (hit.stale || Date.now() - hit.at > FRESH_MS) fetchInto(key).catch(() => {})
    return Promise.resolve(hit.data)
  }
  const write = (method) => (path, body) => { gen += 1; cache.clear(); return call(method, path, body) }
  const c = {
    get,
    post: (path, body) => write('POST')(path, body || {}),
    patch: write('PATCH'),
    put: write('PUT'),
    del: (path) => write('DELETE')(path),
    /** Load these into the store now (the start-up screen does this). */
    prefetch: (keys) => Promise.allSettled(keys.map((k) => (cache.has(k) ? Promise.resolve() : fetchInto(k)))),
    /** Something changed on the hub: what is shown stays, and is fetched again in the background. */
    markStale: () => { cache.forEach((v) => { v.stale = true }) },
    /** Forget everything (the Refresh button). */
    clear: () => { gen += 1; cache.clear() },
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    keys: () => [...cache.keys()],
    async download(path, query, filename) {
      const res = await fetch(base + path + qs(query), { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new ApiError('Download failed', res.status)
      await saveFile(filename, await res.blob())
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

/**
 * Live updates from the hub (GET /api/v1/stream, server-sent events). Read with fetch so the token
 * stays in the Authorization header. Reconnects by itself (Render may restart or wake the server).
 * onEvent(name, data): 'change' (something changed: reload), 'notify' (a new enquiry or bug report).
 * onState('live' | 'connecting' | 'signed-out'). Returns a function that stops it.
 */
export function openStream({ hub, token, onEvent, onState }) {
  let stopped = false
  let ctrl = null
  let wait = 1000
  async function run() {
    while (!stopped) {
      onState('connecting')
      ctrl = new AbortController()
      try {
        const res = await fetch(`${hub.replace(/\/$/, '')}/api/v1/stream`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, signal: ctrl.signal })
        if (res.status === 401) { onState('signed-out'); return }
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`)
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const block = buf.slice(0, i)
            buf = buf.slice(i + 2)
            const name = (block.match(/^event: (.*)$/m) || [])[1]
            const data = (block.match(/^data: (.*)$/m) || [])[1]
            if (!name) continue
            if (name === 'hello') { wait = 1000; onState('live'); continue }
            try { onEvent(name, data ? JSON.parse(data) : {}) } catch { /* a bad event is skipped */ }
          }
        }
      } catch { /* network gone, server asleep or restarting: try again below */ }
      if (stopped) return
      onState('connecting')
      await new Promise((r) => setTimeout(r, wait))
      wait = Math.min(wait * 2, 30000)
    }
  }
  run()
  return () => { stopped = true; if (ctrl) ctrl.abort() }
}
