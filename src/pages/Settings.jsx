import { useState } from 'react'
import { Avatar, Icon, RoleBadge } from '../ui'

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
      <section className="card">
        <header className="card-h"><h3>What your role can do</h3><RoleBadge role={user.role} /></header>
        <ul className="perm-list">
          {perms.map((k) => <li key={k} className={can(k) ? 'yes' : 'no'}>{can(k) ? <Icon.check /> : <Icon.close />}<span>{WORDS[k]}</span></li>)}
        </ul>
      </section>
    </div>
  )
}
