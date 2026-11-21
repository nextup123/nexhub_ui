// The Android app (folder android/) shows this same dashboard. It is built with `npm run android`,
// which builds in "mobile" mode: the hub address is fixed at build time (VITE_HUB_URL in .env.mobile)
// and never shown or editable on screen.
//
// Inside the app, window.NextupApp is a small bridge to Android: saving files to Downloads,
// phone notifications and the status-bar colour. In a normal browser none of this runs.

export const MOBILE = import.meta.env.MODE === 'mobile'
const bridge = typeof window !== 'undefined' ? window.NextupApp : undefined
export const IN_APP = !!bridge

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** Save a file: Downloads on the phone, a normal download in a browser. */
export async function saveFile(name, blob) {
  if (bridge) {
    bridge.saveFile(name, blob.type || 'application/octet-stream', await blobToBase64(blob))
    return
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * In the app: phone notifications behind the browser's Notification API, and "hidden" while the app is
 * in the background, so App.jsx and Settings work unchanged. Called once, before the first render.
 */
export function installAppBridge() {
  if (!bridge) return
  document.documentElement.classList.add('in-app')

  let background = false
  try {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => background })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (background ? 'hidden' : 'visible') })
    document.hasFocus = () => !background
  } catch { /* keep the WebView's own values */ }
  window.__nxSetBackground = (on) => {
    if (background === !!on) return
    background = !!on
    document.dispatchEvent(new Event('visibilitychange'))
  }

  let seq = 0
  const shown = new Map()
  const waiting = []
  class AppNotification {
    constructor(title, opts = {}) {
      this.id = ++seq
      this.onclick = null
      shown.set(this.id, this)
      if (shown.size > 20) shown.delete(shown.keys().next().value)
      bridge.notify(this.id, String(title || 'Nextup'), String(opts.body || ''))
    }
    close() { shown.delete(this.id); bridge.cancel(this.id) }
    static get permission() { return bridge.notificationPermission() }
    static requestPermission() {
      return new Promise((resolve) => { waiting.push(resolve); bridge.requestNotificationPermission() })
    }
  }
  window.Notification = AppNotification
  window.__nxPermission = (p) => { waiting.splice(0).forEach((r) => r(p)) }
  window.__nxNotificationClick = (id) => { const n = shown.get(Number(id)); if (n && n.onclick) n.onclick() }

  // Status and navigation bars follow the light / dark theme.
  const bars = () => {
    const dark = document.documentElement.dataset.theme === 'dark'
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || (dark ? '#12161e' : '#f3f5f8')
    try { bridge.setBars(bg, !dark) } catch { /* older app */ }
  }
  new MutationObserver(bars).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bars)
  else bars()
}
