import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, loadSession, saveSession, clearSession, openStream, ApiError } from './api'
import { Avatar, Icon, Logo, RoleBadge, setTimeZone } from './ui'
import Login, { ChangePassword } from './Login'
import Home from './pages/Home'
import Production from './pages/Production'
import Projects from './pages/Projects'
import Assets from './pages/Assets'
import { AIcon } from './assets'
import Clients from './pages/Clients'
import Import from './pages/Import'
import Bugs from './pages/Bugs'
import Enquiries from './pages/Enquiries'
import Attendance from './pages/Attendance'
import Leave from './pages/Leave'
import Calendar from './pages/Calendar'
import People from './pages/People'
import Settings from './pages/Settings'
import { Boot, Drawer, TabBar, TopBar, tabsFor } from './MobileNav'
import { startupKeys, rememberKeys } from './prefetch'

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
const SECTIONS = ['home', 'projects', 'clients', 'production', 'bugs', 'enquiries', 'attendance', 'leave', 'calendar', 'people', 'settings', 'import']
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
  const [live, setLive] = useState('connecting')
  const [alerts, setAlerts] = useState([])

  // Only a new server or a new sign-in makes a new client. (Refreshing the person's details must not,
  // or every refresh would trigger another one.)
  const hub = session?.hub
  const token = session?.token
  const client = useMemo(() => (hub && token ? createClient({ hub, token }) : null), [hub, token])
  const perms = useMemo(() => new Set(session?.permissions || []), [session])

  // A page shown from memory that turned out to have changed on the hub: draw it again.
  useEffect(() => {
    if (!client) return undefined
    let t = null
    const off = client.onChange(() => { clearTimeout(t); t = setTimeout(() => setVersion((v) => v + 1), 120) })
    return () => { off(); clearTimeout(t) }
  }, [client])

  // One loading screen when the app opens or after sign-in: the main pages are loaded into memory,
  // so moving between them afterwards is instant.
  const [ready, setReady] = useState(null) // the client that finished loading
  const [slow, setSlow] = useState(false)
  const userId = session?.user?._id
  const mustChange = session?.user?.mustChangePassword
  useEffect(() => {
    if (!client || mustChange) return undefined
    let done = false
    setSlow(false)
    const slowT = setTimeout(() => setSlow(true), 6000)
    const finish = () => { if (!done) { done = true; clearTimeout(slowT); setReady(client) } }
    const giveUp = setTimeout(finish, 45000) // never stuck here: pages load themselves anyway
    client.get('/auth/me').then((me) => {
      const set = new Set(me.permissions || [])
      return client.prefetch(startupKeys(me.user, (p) => set.has(p)))
    }).catch(() => {}).finally(finish)
    return () => { done = true; clearTimeout(slowT); clearTimeout(giveUp) }
  }, [client, mustChange])
  // Remember which pages this person opens, to have them ready next time too.
  useEffect(() => {
    if (!client || !userId) return undefined
    const t = setTimeout(() => rememberKeys(userId, client.keys()), 3000)
    return () => clearTimeout(t)
  })
  // The drawer is a step in the history, so the phone's back button closes it.
  const [drawer, setDrawerState] = useState(false)
  const setDrawer = useCallback((open) => {
    if (open) { window.history.pushState({ drawer: 1 }, '', window.location.hash || '#/home'); setDrawerState(true) }
    else if (window.history.state?.drawer) window.history.back()
    else setDrawerState(false)
  }, [])
  useEffect(() => {
    const onPop = () => setDrawerState(!!window.history.state?.drawer)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
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

  // Live updates: the hub says when something changed, and the page on screen reloads by itself.
  // Several changes close together make one reload; a hidden tab reloads when it is shown again.
  const goRef = useRef(null)
  useEffect(() => {
    if (!hub || !token || session?.user?.mustChangePassword) return undefined
    let timer = null
    let pending = false
    const reload = () => { pending = false; setVersion((v) => v + 1) }
    const onVisible = () => { if (!document.hidden && pending) reload() }
    document.addEventListener('visibilitychange', onVisible)
    const stop = openStream({
      hub, token,
      onState: (s) => { if (s === 'signed-out') signOut('You were signed out. Please sign in again.'); else setLive(s) },
      onEvent: (name, data) => {
        if (name === 'change') {
          client?.markStale()
          clearTimeout(timer)
          timer = setTimeout(() => { if (document.hidden) pending = true; else reload() }, 700)
        } else if (name === 'notify') {
          const a = { ...data, key: `${data.kind}-${data.id}-${Date.now()}` }
          setAlerts((list) => [a, ...list].slice(0, 4))
          setTimeout(() => setAlerts((list) => list.filter((x) => x.key !== a.key)), 20000)
          // A desktop notification too, if allowed (Settings → Alerts), when this tab is not in front.
          try {
            if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || !document.hasFocus())) {
              const n = new Notification(data.title, { body: data.body, tag: a.key })
              n.onclick = () => { window.focus(); goRef.current?.(data); n.close() }
            }
          } catch { /* not supported here */ }
        }
      },
    })
    return () => { stop(); clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [hub, token, session?.user?.mustChangePassword]) // eslint-disable-line react-hooks/exhaustive-deps

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

  goRef.current = (a) => {
    setAlerts((list) => list.filter((x) => x.id !== a.id))
    if (a.kind === 'enquiry') go('enquiries', { tab: 'inbox', id: a.id })
    else if (a.kind === 'bug') go('bugs', { n: a.id })
  }

  if (!session) {
    return <Login theme={theme} toggleTheme={toggleTheme} notice={toast} onSignedIn={(s) => { saveSession(s); setSession(s); go('home') }} />
  }
  if (session.user?.mustChangePassword) {
    return <ChangePassword client={client} user={session.user} theme={theme} toggleTheme={toggleTheme} onSignOut={() => signOut()}
      onDone={(me) => { const n = { ...session, user: me.user, permissions: me.permissions }; saveSession(n); setSession(n); notify('Password changed. Welcome!') }} />
  }

  if (ready !== client) return <Boot slow={slow} />

  const user = session.user
  const b = badges || {}
  const openBugs = b.bugs ? Object.values(b.bugs).reduce((n, a) => n + a.open, 0) : 0
  const nav = [
    { group: null, items: [{ key: 'home', label: 'Home', icon: <Icon.home /> }] },
    { group: 'Work', items: [
      can('projects.view') && { key: 'projects', label: 'Projects', icon: <Icon.folder />, count: b.projects?.openIssues || null },
      can('clients.view') && { key: 'clients', label: 'Clients', icon: <Icon.building /> },
      can('assets.view') && { key: 'assets', label: 'Assets', icon: <AIcon.tag /> },
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
    can('data.import') && { group: 'Super user', items: [{ key: 'import', label: 'Bulk import', icon: <Icon.download /> }] },
  ].filter((g) => g && g.items.length)

  const pageProps = { client, user, can, go, params: route.params, setParams: (p) => setParams(route.view, p), onError, notify, version, refreshBadges, badges }
  const pages = { home: Home, projects: Projects, assets: Assets, clients: Clients, import: Import, production: Production, bugs: Bugs, enquiries: Enquiries, attendance: Attendance, leave: Leave, calendar: Calendar, people: People, settings: Settings }
  const allowed = { projects: can('projects.view'), assets: can('assets.view'), clients: can('clients.view'), import: can('data.import'), production: can('production.view'), bugs: can('bugs.view'), enquiries: can('enquiries.view') }
  const view = allowed[route.view] === false ? 'home' : route.view
  const Page = pages[view] || Home
  const items = nav.flatMap((g) => g.items)
  const tabs = tabsFor(items)
  const tabKeys = new Set(tabs.map((t) => t.key))
  const moreBadge = items.filter((n) => !tabKeys.has(n.key) && n.hot).reduce((t, n) => t + (n.count || 0), 0)
  // From the drawer: the page takes the drawer's place in the history (back then goes to the page before).
  const goFromDrawer = (key) => {
    if (window.history.state?.drawer) { window.history.replaceState(null, '', `#/${key}`); setRoute({ view: key, params: {} }); setDrawerState(false) }
    else { setDrawerState(false); go(key) }
  }
  const title = view === 'settings' ? 'Settings' : (items.find((n) => n.key === view)?.label || 'Home')

  return (
    <div className="shell">
      <TopBar title={title} live={live} user={user} onMenu={() => setDrawer(true)} />
      <aside className="side">
        <div className="brand"><Logo /><div><b>Nextup</b><span className="mono">Company hub</span></div>
          <span className={`live-dot ${live}`} title={live === 'live' ? 'Live: changes show by themselves' : 'Connecting to the hub for live updates…'} /></div>
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
            <button onClick={() => { client.clear(); setVersion((v) => v + 1) }} aria-label="Refresh" title="Refresh"><Icon.refresh /></button>
            <button onClick={() => signOut()} aria-label="Sign out" title="Sign out"><Icon.out /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Page key={view} {...pageProps} />
      </main>
      <TabBar tabs={tabs} view={view} go={go} onMore={() => setDrawer(true)} moreBadge={moreBadge} />
      <Drawer open={drawer} onClose={() => setDrawer(false)} user={user} nav={nav} view={view} go={goFromDrawer} theme={theme} toggleTheme={toggleTheme}
        live={live} onRefresh={() => { client.clear(); setVersion((v) => v + 1) }} onSignOut={() => signOut()} />

      {toast && <div className={`toast tone-${toast.tone}`} role="status">{toast.text}</div>}
      {alerts.length > 0 && (
        <div className="alerts" role="log" aria-live="polite">
          {alerts.map((a) => (
            <div key={a.key} className={`alert alert-${a.kind}`}>
              <button className="alert-open" onClick={() => goRef.current(a)}>
                {a.kind === 'bug' ? <Icon.bug /> : <Icon.inbox />}
                <span><b>{a.title}</b>{a.body && <small>{a.body}</small>}</span>
              </button>
              <button className="icon-btn" aria-label="Dismiss" onClick={() => setAlerts((list) => list.filter((x) => x.key !== a.key))}><Icon.close /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
