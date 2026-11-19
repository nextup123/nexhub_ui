import { useEffect, useState } from 'react'
import { defaultHubUrl, publicCall, rememberHubUrl } from './api'
import { Icon, Logo, setTimeZone } from './ui'

function Art() {
  return (
    <div className="login-art" aria-hidden="true">
      <div className="login-art-in">
        <span className="mono">Nextup Robotics</span>
        <h1>One place to<br /><span className="muted">run the company.</span></h1>
        <p>Robots on the build line, bug reports from the field, enquiries from the website, attendance, leave and the company calendar.</p>
      </div>
      <div className="grid-lines" />
    </div>
  )
}

export default function Login({ onSignedIn, theme, toggleTheme, notice }) {
  const [hub, setHub] = useState(defaultHubUrl)
  const [mode, setMode] = useState('signin') // signin | setup
  const [f, setF] = useState({ email: '', password: '', name: '', setupKey: '', remember: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(notice?.text || '')
  const [showServer, setShowServer] = useState(false)
  const [reach, setReach] = useState('checking') // checking | ok | down
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // A fresh server has no accounts yet: show the one-time setup.
  // On Render's free plan the hub sleeps when unused and takes up to a minute to wake, so keep trying.
  useEffect(() => {
    let stop = false
    let timer
    const server = hub.trim().replace(/\/$/, '')
    const check = (n) => {
      publicCall(server, 'GET', '/auth/status').then((s) => {
        if (stop) return
        setTimeZone(s.tz); setMode(s.needsSetup ? 'setup' : 'signin'); setReach('ok')
      }, () => {
        if (stop) return
        setReach(n < 1 ? 'checking' : 'down')
        if (n < 12) timer = setTimeout(() => check(n + 1), 5000)
      })
    }
    setReach('checking')
    timer = setTimeout(() => check(0), 250)
    return () => { stop = true; clearTimeout(timer) }
  }, [hub])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const server = hub.trim().replace(/\/$/, '')
    try {
      const r = mode === 'setup'
        ? await publicCall(server, 'POST', '/auth/setup', { setupKey: f.setupKey, name: f.name, email: f.email, password: f.password })
        : await publicCall(server, 'POST', '/auth/login', { email: f.email, password: f.password, remember: f.remember })
      rememberHubUrl(server)
      onSignedIn({ hub: server, token: r.token, user: r.user, permissions: r.permissions, remember: f.remember })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <button className="icon-btn login-theme" onClick={toggleTheme} aria-label="Switch light or dark">{theme === 'dark' ? <Icon.sun /> : <Icon.moon />}</button>
      <Art />
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><Logo /><div><b>Nextup</b><span className="mono">Company hub</span></div></div>
        {mode === 'setup' ? (
          <>
            <h2>Set up</h2>
            <p className="muted">No accounts yet. Create the first founder account with the setup key (<code>SETUP_KEY</code> on the server). This works once.</p>
            <label><span className="mono">Setup key</span><input type="password" value={f.setupKey} onChange={set('setupKey')} required autoFocus /></label>
            <label><span className="mono">Your name</span><input value={f.name} onChange={set('name')} required autoComplete="name" /></label>
          </>
        ) : (
          <>
            <h2>Sign in</h2>
            <p className="muted">Use the email and password HR gave you.</p>
          </>
        )}
        <label><span className="mono">Email</span><input type="email" value={f.email} onChange={set('email')} required autoComplete="username" autoFocus={mode === 'signin'} /></label>
        <label><span className="mono">Password {mode === 'setup' && <small>(at least 8 characters)</small>}</span><input type="password" value={f.password} onChange={set('password')} required minLength={mode === 'setup' ? 8 : undefined} autoComplete={mode === 'setup' ? 'new-password' : 'current-password'} /></label>
        {mode === 'signin' && <label className="check"><input type="checkbox" checked={f.remember} onChange={set('remember')} /><span>Keep me signed in on this computer (30 days)</span></label>}
        {reach === 'down' && !error && <div className="form-error" role="alert">Can’t reach the hub at {hub.replace(/^https?:\/\//, '')}. Check the server address below. On Render’s free plan the hub sleeps when nobody uses it and takes up to a minute to wake; this screen keeps trying.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'setup' ? 'Create founder account' : 'Sign in'}<Icon.arrow /></button>
        <div className="fine">
          <Icon.shield />
          <span>Server{reach === 'checking' ? ' (connecting…)' : ''}: {showServer
            ? <input className="inline-input" value={hub} onChange={(e) => setHub(e.target.value)} onBlur={() => setShowServer(false)} autoFocus />
            : <button type="button" className="link-btn sm" onClick={() => setShowServer(true)}>{hub.replace(/^https?:\/\//, '')}</button>}</span>
        </div>
      </form>
    </div>
  )
}

/** Shown after signing in with a temporary password. */
export function ChangePassword({ client, user, onDone, onSignOut, theme, toggleTheme }) {
  const [f, setF] = useState({ current: '', password: '', again: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (f.password !== f.again) { setError('The two new passwords are not the same'); return }
    setBusy(true)
    try { onDone(await client.post('/auth/password', { current: f.current, password: f.password })) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="login">
      <button className="icon-btn login-theme" onClick={toggleTheme} aria-label="Switch light or dark">{theme === 'dark' ? <Icon.sun /> : <Icon.moon />}</button>
      <Art />
      <form className="login-card" onSubmit={submit}>
        <div className="brand"><Logo /><div><b>Nextup</b><span className="mono">Company hub</span></div></div>
        <h2>Welcome, {user.name.split(' ')[0]}</h2>
        <p className="muted">You signed in with a temporary password. Choose your own to continue.</p>
        <label><span className="mono">Temporary password</span><input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required autoComplete="current-password" autoFocus /></label>
        <label><span className="mono">New password <small>(at least 8 characters)</small></span><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
        <label><span className="mono">New password again</span><input type="password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} required autoComplete="new-password" /></label>
        {reach === 'down' && !error && <div className="form-error" role="alert">Can’t reach the hub at {hub.replace(/^https?:\/\//, '')}. Check the server address below. On Render’s free plan the hub sleeps when nobody uses it and takes up to a minute to wake; this screen keeps trying.</div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>Save and continue<Icon.arrow /></button>
        <button type="button" className="link-btn" onClick={onSignOut}>Sign out</button>
      </form>
    </div>
  )
}
