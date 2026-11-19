import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient, loadSession, saveSession, clearSession, ApiError } from './api'
import { Avatar, Icon, Logo, RoleBadge, setTimeZone } from './ui'
import Login, { ChangePassword } from './Login'
import Home from './pages/Home'
import Production from './pages/Production'
import Projects from './pages/Projects'
import Bugs from './pages/Bugs'
import Enquiries from './pages/Enquiries'
import Attendance from './pages/Attendance'
import Leave from './pages/Leave'
import Calendar from './pages/Calendar'
import People from './pages/People'
import Settings from './pages/Settings'

function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('nx-admin-theme', next) } catch { /* ignore */ }
    setTheme(next)
  }
  return [theme, toggle]
}

// The page lives in the address (#/production?id=…) so a reload or a shared link opens the same thing.
const SECTIONS = ['home', 'projects', 'production', 'bugs', 'enquiries', 'attendance', 'leave', 'calendar', 'people', 'settings']
function readHash() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  return { view: SECTIONS.includes(path) ? path : 'home', params: Object.fromEntries(new URLSearchParams(query)) }
}
function writeHash(view, params = {}) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false)).toString()
  const next = `#/${view}${q ? `?${q}` : ''}`
  if (window.location.hash !== next) window.history.pushState(null, '', next)
}

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [theme, toggleTheme] = useTheme()
  const [route, setRoute] = useState(readHash)
  const [toast, setToast] = useState(null)
  const [badges, setBadges] = useState(null)
  const [version, setVersion] = useState(0)

  // Only a new server or a new sign-in makes a new client. (Refreshing the person's details must not,
  // or every refresh would trigger another one.)
  const hub = session?.hub
  const token = session?.token
  const client = useMemo(() => (hub && token ? createClient({ hub, token }) : null), [hub, token])
  const perms = useMemo(() => new Set(session?.permissions || []), [session])
  const can = useCallback((p) => perms.has(p), [perms])

  const signOut = useCallback((message) => {
    if (client) client.post('/auth/logout').catch(() => {})
    clearSession()
    setSession(null)
    setBadges(null)
    if (message) setToast({ text: message, tone: 'bad' })
  }, [client])

  const onError = useCallback((err) => {
    if (err instanceof ApiError && err.status === 401) return signOut('You were signed out. Please sign in again.')
    if (err instanceof ApiError && err.data?.mustChangePassword) {
      setSession((s) => ({ ...s, user: { ...s.user, mustChangePassword: true } }))
      return undefined
    }
    setToast({ text: err.message, tone: 'bad' })
    return undefined
  }, [signOut])
  const notify = useCallback((text, tone = 'good') => setToast({ text, tone }), [])

  const refreshBadges = useCallback(() => {
    if (!client || session?.user?.mustChangePassword) return
    client.get('/home').then(setBadges, () => {})
  }, [client, session])
  useEffect(() => { refreshBadges() }, [refreshBadges, version])
  useEffect(() => {
    if (!client) return undefined
    const t = setInterval(() => { if (!document.hidden) refreshBadges() }, 60000)
    return () => clearInterval(t)
  }, [client, refreshBadges])

  // Keep the person and their permissions fresh (a role change applies on the next load).
  useEffect(() => {
    if (!client) return
    client.get('/auth/me').then((me) => {
      if (setTimeZone(me.tz)) setVersion((v) => v + 1)
      setSession((s) => { const n = { ...s, user: me.user, permissions: me.permissions }; saveSession(n); return n })
    }, onError)
  }, [client]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const onHash = () => setRoute(readHash())
    window.addEventListener('popstate', onHash)
    window.addEventListener('hashchange', onHash)
    return () => { window.removeEventListener('popstate', onHash); window.removeEventListener('hashchange', onHash) }
  }, [])

  const go = useCallback((view, params = {}) => {
    writeHash(view, params)
    setRoute({ view, params })
  }, [])
  // Same page, new parameters, without adding a history step for every keystroke.
  const setParams = useCallback((view, params) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null && v !== false)).toString()
    window.history.replaceState(null, '', `#/${view}${q ? `?${q}` : ''}`)
    setRoute({ view, params })
  }, [])

  if (!session) {
    return <Login theme={theme} toggleTheme={toggleTheme} notice={toast} onSignedIn={(s) => { saveSession(s); setSession(s); go('home') }} />
  }
  if (session.user?.mustChangePassword) {
    return <ChangePassword client={client} user={session.user} theme={theme} toggleTheme={toggleTheme} onSignOut={() => signOut()}
      onDone={(me) => { const n = { ...session, user: me.user, permissions: me.permissions }; saveSession(n); setSession(n); notify('Password changed. Welcome!') }} />
  }

  const user = session.user
  const b = badges || {}
  const openBugs = b.bugs ? Object.values(b.bugs).reduce((n, a) => n + a.open, 0) : 0
  const nav = [
    { group: null, items: [{ key: 'home', label: 'Home', icon: <Icon.home /> }] },
    { group: 'Work', items: [
      can('projects.view') && { key: 'projects', label: 'Projects', icon: <Icon.folder />, count: b.projects?.openIssues || null },
      can('production.view') && { key: 'production', label: 'Production', icon: <Icon.robot /> },
      can('bugs.view') && { key: 'bugs', label: 'Bug reports', icon: <Icon.bug />, count: openBugs || null },
      can('enquiries.view') && { key: 'enquiries', label: 'Website enquiries', icon: <Icon.inbox />, count: b.enquiries?.unread || null, hot: true },
    ].filter(Boolean) },
    { group: 'People', items: [
      { key: 'attendance', label: 'Attendance', icon: <Icon.clock /> },
      { key: 'leave', label: 'Leave', icon: <Icon.leave />, count: b.approvals || null, hot: true },
      { key: 'calendar', label: 'Calendar', icon: <Icon.calendar /> },
      { key: 'people', label: can('users.manage') ? 'People' : 'Directory', icon: <Icon.users /> },
    ] },
  ].filter((g) => g.items.length)

  const pageProps = { client, user, can, go, params: route.params, setParams: (p) => setParams(route.view, p), onError, notify, version, refreshBadges, badges }
  const pages = { home: Home, projects: Projects, production: Production, bugs: Bugs, enquiries: Enquiries, attendance: Attendance, leave: Leave, calendar: Calendar, people: People, settings: Settings }
  const allowed = { projects: can('projects.view'), production: can('production.view'), bugs: can('bugs.view'), enquiries: can('enquiries.view') }
  const view = allowed[route.view] === false ? 'home' : route.view
  const Page = pages[view] || Home

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Logo /><div><b>Nextup</b><span className="mono">Company hub</span></div></div>
        <nav>
          {nav.map((g) => (
            <div key={g.group || 'top'} className="nav-group">
              {g.group && <div className="nav-label mono">{g.group}</div>}
              {g.items.map((n) => (
                <button key={n.key} className={view === n.key ? 'on' : ''} onClick={() => go(n.key)}>
                  {n.icon}<span>{n.label}</span>{n.count ? <em className={n.hot ? 'hot' : ''}>{n.count}</em> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <button className={`me${view === 'settings' ? ' on' : ''}`} onClick={() => go('settings')} title="Your account">
            <Avatar name={user.name} size={32} />
            <span><b>{user.name}</b><RoleBadge role={user.role} /></span>
          </button>
          <div className="side-actions">
            <button onClick={toggleTheme} aria-label="Switch light or dark" title="Light / dark">{theme === 'dark' ? <Icon.sun /> : <Icon.moon />}</button>
            <button onClick={() => { setVersion((v) => v + 1) }} aria-label="Refresh" title="Refresh"><Icon.refresh /></button>
            <button onClick={() => signOut()} aria-label="Sign out" title="Sign out"><Icon.out /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Page key={view} {...pageProps} />
      </main>

      {toast && <div className={`toast tone-${toast.tone}`} role="status">{toast.text}</div>}
    </div>
  )
}
