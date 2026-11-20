import { useEffect, useState } from 'react'
import { Avatar, Icon, RoleBadge, isTop } from '../ui'

// New website enquiries and bug reports: pop-ups here, desktop notifications, and (founders) Telegram.
function Alerts({ client, user, can, onError, notify }) {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const secure = typeof window !== 'undefined' && window.isSecureContext
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported')
  const [tg, setTg] = useState(null)
  const [chats, setChats] = useState(null)
  const top = isTop(user)
  useEffect(() => { if (top) client.get('/notifications/telegram').then(setTg, () => {}) }, [client, top])
  const what = [can('enquiries.view') && 'new website enquiries', can('bugs.view') && 'new bug reports'].filter(Boolean)
  const ask = async () => { try { setPerm(await Notification.requestPermission()) } catch { setPerm('denied') } }
  const test = async () => { try { await client.post('/notifications/telegram/test'); notify('Sent. Check Telegram on your phone.') } catch (err) { onError(err) } }
  const find = async () => { try { setChats((await client.get('/notifications/telegram/chats')).chats) } catch (err) { onError(err) } }
  if (!what.length && !top) return null
  return (
    <section className="card">
      <header className="card-h"><h3>Alerts</h3></header>
      <div className="alerts-set">
        <p>{what.length ? <>While the dashboard is open you get a pop-up for {what.join(' and ')}, and every page updates by itself.</> : 'Your role gets no alerts.'}</p>
        {what.length > 0 && (
          <div className="row-between">
            <span><b>Desktop notifications</b><br /><span className="muted small">
              {!supported ? 'This browser does not support them.'
                : !secure ? 'Browsers allow them only on http://localhost, not on a network address like this one.'
                  : perm === 'granted' ? 'On. They show even when this tab is in the background.'
                    : perm === 'denied' ? 'Blocked. Allow notifications for this site in the browser’s site settings.'
                      : 'Off.'}</span></span>
            {supported && secure && perm === 'default' && <button className="btn primary sm" onClick={ask}>Turn on</button>}
          </div>
        )}
        {top && (
          <div className="row-between">
            <span><b>Telegram (phone)</b><br /><span className="muted small">
              {!tg ? '…' : tg.configured ? `On: alerts go to ${tg.chats} chat${tg.chats === 1 ? '' : 's'}, even when the dashboard is closed.`
                : tg.botToken ? 'Bot token set. Now add TELEGRAM_CHAT_ID on Render: press Start in your bot, then Find my chat id.'
                  : 'Off. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on Render (the hub’s README shows how).'}</span></span>
            <span className="btn-row">
              {tg?.botToken && <button className="btn sm" onClick={find}>Find my chat id</button>}
              {tg?.configured && <button className="btn primary sm" onClick={test}>Send a test</button>}
            </span>
          </div>
        )}
        {chats && (
          <div className="chat-ids">
            {chats.length === 0
              ? <p className="muted small">No chats yet. Open your bot in Telegram, press Start (or send it any message), then try again.</p>
              : chats.map((c) => <div key={c.id}><code>{c.id}</code> <span className="muted small">{c.name || c.type}</span></div>)}
            {chats.length > 0 && <p className="muted small">Put this number in Render → Environment as TELEGRAM_CHAT_ID (several: separate them with commas), then save.</p>}
          </div>
        )}
      </div>
    </section>
  )
}

// What each permission means, in plain words, so people can see what their role allows.
const WORDS = {
  'users.view': 'See the company directory',
  'users.manage': 'Add people, change roles and teams, reset passwords',
  'users.hr_records': 'See HR records (joining date, employee id, emergency contact)',
  'attendance.self': 'Check in and out, see your own attendance',
  'attendance.team': 'See your team’s attendance',
  'attendance.all': 'See everyone’s attendance',
  'attendance.edit': 'Correct anyone’s attendance',
  'leave.self': 'Ask for leave and see your balance',
  'leave.approve_team': 'Approve your team’s leave',
  'leave.approve_all': 'Approve anyone’s leave',
  'holidays.manage': 'Add and remove company holidays',
  'calendar.view': 'See the company calendar',
  'calendar.manage': 'Add events to the calendar',
  'projects.view': 'See projects, their problems, solutions and site visits',
  'projects.manage': 'Create projects, change their team, robots and status',
  'projects.log': 'Log problems, solutions, site visits and notes',
  'projects.delete': 'Delete projects',
  'production.view': 'See robots in the build',
  'production.manage': 'Add robots, change stages and dates, give stages to people',
  'production.update_assigned': 'Tick off build stages given to you',
  'production.delete': 'Delete robots from the build list',
  'enquiries.view': 'Read website enquiries (customer contact details)',
  'enquiries.edit': 'Answer enquiries, change their status, add notes',
  'enquiries.delete': 'Delete enquiries',
  'bugs.view': 'Read bug reports from the machines',
  'bugs.comment': 'Comment on bug reports',
  'bugs.triage': 'Change bug status and priority, see the customer’s phone',
  'releases.publish': 'Publish release notes',
  'apps.manage': 'Add or change the apps',
}

export default function Settings({ client, user, can, onError, notify }) {
  const [p, setP] = useState({ name: user.name, phone: user.phone || '' })
  const [pw, setPw] = useState({ current: '', password: '', again: '' })
  const saveProfile = async (e) => {
    e.preventDefault()
    try { await client.patch('/auth/me', p); notify('Saved. It shows everywhere after the next refresh.') } catch (err) { onError(err) }
  }
  const savePw = async (e) => {
    e.preventDefault()
    if (pw.password !== pw.again) return onError(new Error('The two new passwords are not the same'))
    try { await client.post('/auth/password', { current: pw.current, password: pw.password }); setPw({ current: '', password: '', again: '' }); notify('Password changed. Other devices were signed out.') } catch (err) { onError(err) }
    return undefined
  }
  const perms = Object.keys(WORDS)
  return (
    <div className="page">
      <header className="page-h">
        <div className="who">
          <Avatar name={user.name} size={64} />
          <div><span className="mono muted">Your account</span><h1>{user.name}</h1><p className="muted">{user.title || ''}{user.team ? ` · ${user.team}` : ''} · <RoleBadge role={user.role} /></p></div>
        </div>
      </header>
      <div className="two-col">
        <section className="card">
          <header className="card-h"><h3>Details</h3></header>
          <form className="form-grid" onSubmit={saveProfile}>
            <label className="span2"><span className="mono">Name</span><input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} required /></label>
            <label><span className="mono">Email</span><input value={user.email} disabled /></label>
            <label><span className="mono">Phone</span><input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></label>
            <p className="span2 muted small">HR changes your email, role and team.</p>
            <footer className="span2 modal-actions"><span className="grow" /><button className="btn primary sm">Save</button></footer>
          </form>
        </section>
        <section className="card">
          <header className="card-h"><h3>Password</h3></header>
          <form className="form-grid" onSubmit={savePw}>
            <label className="span2"><span className="mono">Current password</span><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></label>
            <label><span className="mono">New password</span><input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} required minLength={8} autoComplete="new-password" /></label>
            <label><span className="mono">Again</span><input type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required autoComplete="new-password" /></label>
            <footer className="span2 modal-actions"><span className="grow" /><button className="btn primary sm">Change password</button></footer>
          </form>
        </section>
      </div>
      <Alerts client={client} user={user} can={can} onError={onError} notify={notify} />
      <section className="card">
        <header className="card-h"><h3>What your role can do</h3><RoleBadge role={user.role} /></header>
        <ul className="perm-list">
          {perms.map((k) => <li key={k} className={can(k) ? 'yes' : 'no'}>{can(k) ? <Icon.check /> : <Icon.close />}<span>{WORDS[k]}</span></li>)}
        </ul>
      </section>
    </div>
  )
}
