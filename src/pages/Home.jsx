import { useCallback, useEffect, useState } from 'react'
import { Avatar, Icon, addDaysStr, fmtDay, fmtHour, fmtRange, fmtTime, plural, todayStr, useTick } from '../ui'
import { CheckCard } from './Attendance'

const greeting = () => { const h = Number(fmtHour(new Date())); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const KIND_LABEL = { holiday: 'Holiday', event: 'Event', leave: 'On leave', unit: 'Production' }

export default function Home({ client, user, can, go, onError, notify, version, badges, refreshBadges }) {
  useTick()
  const [today, setToday] = useState(null)
  const [prod, setProd] = useState(null)
  const [cal, setCal] = useState(null)

  const loadToday = useCallback(() => client.get('/attendance/today').then(setToday, onError), [client, onError])
  useEffect(() => { loadToday() }, [loadToday, version])
  useEffect(() => { if (can('production.view')) client.get('/units/summary').then(setProd, onError) }, [client, can, onError, version])
  useEffect(() => { const t = todayStr(); client.get('/calendar', { from: t, to: addDaysStr(t, 21) }).then(setCal, onError) }, [client, onError, version])

  const b = badges || {}
  const away = (today?.board || []).filter((p) => p.status === 'leave')
  const notIn = (today?.board || []).filter((p) => p.status === 'not_in')
  const upcoming = (cal?.items || []).filter((i) => i.type !== 'leave' || i.userId !== user._id).slice(0, 8)
  const bugOpen = b.bugs ? Object.values(b.bugs).reduce((n, a) => n + a.open, 0) : 0
  const bugHot = b.bugs ? Object.values(b.bugs).reduce((n, a) => n + a.critical, 0) : 0

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <span className="mono muted">{fmtDay(todayStr(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <h1>{greeting()}, <span className="muted">{user.name.split(' ')[0]}.</span></h1>
        </div>
      </header>

      <div className="home-grid">
        <CheckCard client={client} data={today} reload={loadToday} onError={onError} notify={notify} />

        <section className="card tiles">
          {b.approvals > 0 && <button className="tile hot" onClick={() => go('leave')}><span className="mono">Waiting for you</span><b>{b.approvals}</b><small>{plural(b.approvals, 'leave request')} to approve</small></button>}
          {prod && <button className="tile" onClick={() => go('production')}><span className="mono">Robots in the build</span><b>{prod.inProgress}</b><small>{prod.late.length ? `${prod.late.length} late · ` : ''}{prod.blocked ? `${prod.blocked} blocked · ` : ''}{prod.byPhase.ready} ready to ship</small></button>}
          {b.projects && <button className="tile" onClick={() => go('projects')}><span className="mono">Projects</span><b>{b.projects.active}</b><small>{b.projects.openIssues ? `${plural(b.projects.openIssues, 'open problem')}${b.projects.serious ? ` · ${b.projects.serious} serious` : ''}` : 'no open problems'}</small></button>}
          {b.enquiries && <button className="tile" onClick={() => go('enquiries', { tab: 'inbox', status: 'inbox', unread: 'true' })}><span className="mono">Website enquiries</span><b>{b.enquiries.unread}</b><small>unread · {b.enquiries.open} waiting for a reply</small></button>}
          {b.bugs && <button className="tile" onClick={() => go('bugs')}><span className="mono">Open bug reports</span><b>{bugOpen}</b><small>{bugHot} serious or critical</small></button>}
          {today && today.counts.total > 0 && <button className="tile" onClick={() => go('attendance')}><span className="mono">{can('attendance.all') ? 'In today' : 'Your team today'}</span><b>{today.counts.present}<span className="of">/{today.counts.total}</span></b><small>{today.counts.leave} on leave · {today.counts.notIn} not in yet</small></button>}
          {!prod && !b.enquiries && !b.bugs && !(today && today.counts.total) && !(b.approvals > 0) && (
            <button className="tile" onClick={() => go('leave')}><span className="mono">Leave</span><b><Icon.leave /></b><small>See your balance or ask for leave</small></button>
          )}
        </section>
      </div>

      <div className="two-col">
        {prod && prod.myStages.length > 0 && (
          <section className="card">
            <header className="card-h"><h3><Icon.robot />Your build stages</h3><button className="link-btn" onClick={() => go('production', { mine: 'true' })}>Open<Icon.arrow /></button></header>
            <ul className="mini-list">
              {prod.myStages.slice(0, 6).map((s) => (
                <li key={s.unitId + s.key}>
                  <button onClick={() => go('production', { id: s.unitId })}>
                    <i className={`stage-dot st-${s.state}`} />
                    <span><b>{s.label}</b><small>{s.serial} · {s.model}</small></span>
                    <span className="mono muted">{s.targetDate ? `due ${fmtDay(s.targetDate, { day: 'numeric', month: 'short' })}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {prod && prod.late.length > 0 && can('production.manage') && (
          <section className="card">
            <header className="card-h"><h3><Icon.alert />Past their target date</h3></header>
            <ul className="mini-list">
              {prod.late.map((u) => (
                <li key={u._id}><button onClick={() => go('production', { id: u._id })}>
                  <i className="stage-dot st-blocked" />
                  <span><b>{u.serial}</b><small>{u.model} · at {u.progress.current?.label || 'the end'}</small></span>
                  <span className="mono bad-text">due {fmtDay(u.targetDate, { day: 'numeric', month: 'short' })}</span>
                </button></li>
              ))}
            </ul>
          </section>
        )}

        <section className="card">
          <header className="card-h"><h3><Icon.calendar />Coming up</h3><button className="link-btn" onClick={() => go('calendar')}>Calendar<Icon.arrow /></button></header>
          {!cal ? <div className="loading">Loading…</div> : upcoming.length === 0 ? <p className="empty-s">Nothing in the next three weeks.</p> : (
            <ul className="agenda">
              {upcoming.map((i) => (
                <li key={i.type + i.id + i.date}>
                  <span className="ag-date"><b>{fmtDay(i.date, { day: 'numeric' })}</b><small>{fmtDay(i.date, { month: 'short' })}</small></span>
                  <span className={`ag-bar k-${i.type}`} />
                  <span className="ag-main"><b>{i.type === 'leave' ? `${i.title} on leave` : i.title}</b><small>{KIND_LABEL[i.type]}{i.time ? ` · ${i.time}` : ''}{i.endDate && i.endDate !== i.date ? ` · ${fmtRange(i.date, i.endDate)}` : ''}{i.location ? ` · ${i.location}` : ''}</small></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {today && (away.length > 0 || notIn.length > 0) && (
          <section className="card">
            <header className="card-h"><h3><Icon.users />Who is out</h3><span className="mono muted">Today</span></header>
            <ul className="people-mini">
              {away.map((p) => <li key={p.user._id}><Avatar name={p.user.name} size={30} /><span><b>{p.user.name}</b><small>On leave{p.halfDay ? ' (half day)' : ''}</small></span></li>)}
              {notIn.map((p) => <li key={p.user._id}><Avatar name={p.user.name} size={30} /><span><b>{p.user.name}</b><small>Not checked in yet</small></span></li>)}
            </ul>
          </section>
        )}
      </div>
      <p className="fine center">Signed in as {user.email}. Last check-in at {today?.me?.checkIn ? fmtTime(today.me.checkIn) : 'none today'}.</p>
    </div>
  )
}
