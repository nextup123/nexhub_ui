import { useEffect, useState } from 'react'

export const STATUS = {
  new: { label: 'New', tone: 'new' },
  in_progress: { label: 'In progress', tone: 'progress' },
  replied: { label: 'Replied', tone: 'good' },
  closed: { label: 'Closed', tone: 'muted' },
  spam: { label: 'Spam', tone: 'bad' },
}
export const STATUS_ORDER = ['new', 'in_progress', 'replied', 'closed', 'spam']

export function StatusPill({ status }) {
  const s = STATUS[status] || { label: status, tone: 'muted' }
  return <span className={`pill tone-${s.tone}`}><i />{s.label}</span>
}

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null
export function timeAgo(d) {
  const sec = (new Date(d).getTime() - Date.now()) / 1000
  const abs = Math.abs(sec)
  if (abs < 45) return 'just now'
  const units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800]]
  if (abs > 30 * 86400) return fmtDate(d)
  let [u, n] = units[0]
  for (const [uu, nn] of units) if (abs >= nn) { u = uu; n = nn }
  return rtf ? rtf.format(Math.round(sec / n), u) : fmtDate(d)
}
export const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
export const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

/** Re-render every minute so "5 minutes ago" stays right. */
export function useTick(ms = 60000) {
  const [, set] = useState(0)
  useEffect(() => { const t = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(t) }, [ms])
}

export function Avatar({ name, size = 36 }) {
  // A stable, quiet tint per person (from the name), never a status colour.
  let h = 0
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) % 360
  return <span className="avatar" style={{ width: size, height: size, '--h': h }} aria-hidden="true">{initials(name)}</span>
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
export const Icon = {
  grid: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  inbox: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></svg>,
  star: ({ on } = {}) => <svg width="18" height="18" viewBox="0 0 24 24" {...P} fill={on ? 'currentColor' : 'none'}><path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" /></svg>,
  search: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>,
  download: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  refresh: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>,
  sun: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>,
  moon: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>,
  out: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10" /></svg>,
  mail: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></svg>,
  phone: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></svg>,
  chat: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z" /></svg>,
  building: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18M8 8h3M8 12h3M8 16h3" /></svg>,
  robot: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M5 21h8M9 21v-4l-3-5 6-6 4 3M16 9l3 1.5" /><circle cx="12" cy="6" r="1.6" /></svg>,
  factory: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M3 21V10l5 3V10l5 3V10l5 3V4h3v17z" /></svg>,
  trash: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  close: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  back: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M15 5l-7 7 7 7" /></svg>,
  shield: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /></svg>,
  arrow: () => <svg width="14" height="14" viewBox="0 0 24 24" {...P}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  home: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></svg>,
  calendar: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  clock: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  leave: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M5 19c8 0 14-6 14-14C11 5 5 11 5 19zM5 19l7-7" /></svg>,
  users: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>,
  bug: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><rect x="7" y="7" width="10" height="13" rx="5" /><path d="M12 11v9M7 12H3M21 12h-4M7 17l-3 2M17 17l3 2M7 8L4.5 5.5M17 8l2.5-2.5M9 7a3 3 0 0 1 6 0" /></svg>,
  settings: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></svg>,
  check: () => <svg width="14" height="14" viewBox="0 0 24 24" {...P} strokeWidth="2.4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  plus: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  left: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M15 5l-7 7 7 7" /></svg>,
  right: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M9 5l7 7-7 7" /></svg>,
  board: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></svg>,
  list: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  alert: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5M12 17.5h.01" /></svg>,
  pause: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M9 5v14M15 5v14" /></svg>,
  truck: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>,
  key: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3M14 9l2 2" /></svg>,
  folder: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /></svg>,
  pin: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  wrench: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>,
  note: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4M8.5 12h7M8.5 16h5" /></svg>,
  edit: () => <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="M14.5 7.5l2 2" /></svg>,
}

export const ROLE_LABEL = { founder: 'Founder', hr: 'HR', lead: 'Lead', employee: 'Employee' }
// The super user is not in ROLE_LABEL on purpose: it must never appear in role pickers or counts.
export const isTop = (u) => !!u && (u.role === 'founder' || u.role === 'superuser')
export function RoleBadge({ role }) {
  return <span className={`role role-${role}`}>{ROLE_LABEL[role] || (role === 'superuser' ? 'Super user' : role)}</span>
}

/** A dialog drawn in the page (never window.confirm/alert). */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.close /></button></header>
        {children}
      </div>
    </div>
  )
}

// Times are shown in the company's time zone (from the hub), not the browser's,
// so a check-in at 9:30 in Pune reads 9:30 wherever the dashboard is opened.
let TZ
try { TZ = localStorage.getItem('nx-tz') || undefined } catch { TZ = undefined }
export const setTimeZone = (tz) => {
  if (!tz) return false
  try { new Intl.DateTimeFormat('en-IN', { timeZone: tz }) } catch { return false }
  const changed = tz !== TZ
  TZ = tz
  try { localStorage.setItem('nx-tz', tz) } catch { /* private mode */ }
  return changed
}
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const addDaysStr = (s, n) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export const fmtDay = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(`${s}T00:00:00`).toLocaleDateString('en-IN', opts)
export const fmtHour = (d) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(new Date(d))
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: TZ }) : '')
export const fmtRange = (a, b) => (a === b || !b ? fmtDay(a) : `${fmtDay(a, { day: 'numeric', month: 'short' })} to ${fmtDay(b)}`)
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function Logo() {
  return <img src="./mark.svg" alt="" width="30" height="30" className="logo" />
}
