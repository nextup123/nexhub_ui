import { useEffect } from 'react'
import { Avatar, Icon, Logo, RoleBadge } from './ui'

// On a phone (the Android app, or a browser narrower than 760 px) the side menu becomes:
// a top bar (menu button, page title, you), a bottom tab bar with the main pages, and a drawer
// with everything else: your profile, the other pages, light / dark, refresh and sign out.

const menuIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
const moreIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>

// The pages that earn a tab, best first; the first four this person may open are shown.
const TAB_ORDER = ['home', 'projects', 'assets', 'production', 'enquiries', 'attendance', 'leave', 'calendar']
const SHORT = { enquiries: 'Enquiries', 'Website enquiries': 'Enquiries', 'Bug reports': 'Bugs' }

export function tabsFor(items) {
  const byKey = Object.fromEntries(items.map((n) => [n.key, n]))
  return TAB_ORDER.map((k) => byKey[k]).filter(Boolean).slice(0, 4)
}

export function TopBar({ title, live, user, onMenu }) {
  return (
    <header className="m-top">
      <button className="m-icon" onClick={onMenu} aria-label="Open the menu">{menuIcon()}</button>
      <h1>{title}</h1>
      <span className={`m-live ${live}`} title={live === 'live' ? 'Live' : 'Connecting…'} />
      <button className="m-me" onClick={onMenu} aria-label="Your account"><Avatar name={user.name} size={32} /></button>
    </header>
  )
}

export function TabBar({ tabs, view, go, onMore, moreBadge }) {
  const inTabs = tabs.some((t) => t.key === view)
  return (
    <nav className="m-tabs" aria-label="Main">
      {tabs.map((t) => (
        <button key={t.key} className={view === t.key ? 'on' : ''} onClick={() => go(t.key)} aria-current={view === t.key ? 'page' : undefined}>
          <span className="m-tab-ic">{t.icon}{t.count ? <em className={t.hot ? 'hot' : ''}>{t.count > 99 ? '99+' : t.count}</em> : null}</span>
          <small>{SHORT[t.label] || t.label}</small>
        </button>
      ))}
      <button className={!inTabs ? 'on' : ''} onClick={onMore} aria-label="More">
        <span className="m-tab-ic">{moreIcon()}{moreBadge ? <em className="hot">{moreBadge > 99 ? '99+' : moreBadge}</em> : null}</span>
        <small>More</small>
      </button>
    </nav>
  )
}

export function Drawer({ open, onClose, user, nav, view, go, theme, toggleTheme, onRefresh, onSignOut, live }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  const pick = (key) => go(key) // closes the drawer too
  return (
    <div className={`m-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="m-scrim" onClick={onClose} />
      <aside className="m-panel" role="dialog" aria-label="Menu">
        <div className="m-panel-h">
          <div className="brand"><Logo /><div><b>Nextup</b><span className="mono">Company hub</span></div></div>
          <button className="m-icon" onClick={onClose} aria-label="Close the menu"><Icon.close /></button>
        </div>

        <button className="m-profile" onClick={() => pick('settings')}>
          <Avatar name={user.name} size={52} />
          <span className="m-profile-t">
            <b>{user.name}</b>
            <small>{user.title || user.email}</small>
            <span className="m-profile-tags"><RoleBadge role={user.role} />{user.team ? <span className="m-team">{user.team}</span> : null}</span>
          </span>
          <Icon.right />
        </button>

        <div className="m-scroll">
          {nav.map((g) => (
            <div key={g.group || 'top'} className="m-group">
              {g.group && <div className="m-label mono">{g.group}</div>}
              {g.items.map((n) => (
                <button key={n.key} className={view === n.key ? 'on' : ''} onClick={() => pick(n.key)}>
                  {n.icon}<span>{n.label}</span>{n.count ? <em className={n.hot ? 'hot' : ''}>{n.count}</em> : null}
                </button>
              ))}
            </div>
          ))}
          <div className="m-group">
            <div className="m-label mono">You</div>
            <button className={view === 'settings' ? 'on' : ''} onClick={() => pick('settings')}><Icon.settings /><span>Settings and password</span></button>
            <button onClick={toggleTheme} role="switch" aria-checked={theme === 'dark'}>
              {theme === 'dark' ? <Icon.moon /> : <Icon.sun />}<span>Dark mode</span>
              <i className={`m-switch${theme === 'dark' ? ' on' : ''}`} />
            </button>
            <button onClick={() => { onClose(); onRefresh() }}><Icon.refresh /><span>Refresh everything</span></button>
          </div>
        </div>

        <div className="m-panel-f">
          <span className={`m-status ${live}`}><i />{live === 'live' ? 'Live: changes show by themselves' : 'Connecting to the hub…'}</span>
          <button className="btn m-out" onClick={() => { onClose(); onSignOut() }}><Icon.out />Sign out</button>
        </div>
      </aside>
    </div>
  )
}

/** One loading screen when the app opens or after sign-in, while everything loads. */
export function Boot({ slow, progress = 0 }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  const step = pct < 15 ? 'Saying hello to the hub…' : pct < 55 ? 'Loading your pages…' : pct < 95 ? 'Loading projects, clients and robots…' : 'Almost there…'
  return (
    <div className="boot" role="status" aria-live="polite">
      <div className="boot-in">
        <div className="boot-ring">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <circle cx="32" cy="32" r="28" className="boot-track" />
            <circle cx="32" cy="32" r="28" className="boot-arc" style={{ strokeDashoffset: 176 - 176 * (pct / 100) }} />
          </svg>
          <span className="boot-logo"><Logo /></span>
        </div>
        <b>{slow && pct < 15 ? 'Waking up the hub' : 'Getting things ready'}</b>
        <small className="muted">{slow && pct < 15 ? 'If nobody used it for a while this takes up to a minute. Hang on.' : step}</small>
        <div className="boot-bar"><i style={{ transform: `scaleX(${Math.max(0.04, pct / 100)})` }} /></div>
      </div>
    </div>
  )
}
