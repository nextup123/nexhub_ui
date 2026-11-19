import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Icon, Modal, fmtDay, fmtTime, todayStr, useTick } from '../ui'

const CELL = {
  present: { label: 'Present', short: 'P' },
  half_day: { label: 'Half day', short: '½' },
  absent: { label: 'Absent', short: 'A' },
  leave: { label: 'On leave', short: 'L' },
  holiday: { label: 'Holiday', short: 'H' },
  off: { label: 'Weekly off', short: '' },
  not_in: { label: 'Not in yet', short: '·' },
  upcoming: { label: '', short: '' },
}
const MODE = { office: 'Office', wfh: 'Work from home', site: 'Customer site' }

function duration(from, to = new Date()) {
  const m = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

/** Today's check-in and check-out for the signed-in person (also on the home page). */
export function CheckCard({ client, data, reload, onError, notify }) {
  useTick(30000)
  const [mode, setMode] = useState('office')
  const [busy, setBusy] = useState(false)
  const me = data?.me || {}
  const rec = me.record
  const act = async (path, body, msg) => {
    setBusy(true)
    try { await client.post(path, body); notify(msg); reload() } catch (err) { onError(err) } finally { setBusy(false) }
  }
  if (!data) return <section className="card check"><div className="loading">Loading…</div></section>
  const onLeave = me.status === 'leave'
  return (
    <section className="card check">
      <header className="card-h"><h3><Icon.clock />Today</h3><span className="mono muted">Office opens {data.officeStart}</span></header>
      {rec?.checkIn ? (
        <>
          <div className="check-big">
            <b>{rec.checkOut ? duration(rec.checkIn, rec.checkOut) : duration(rec.checkIn)}</b>
            <small>{rec.checkOut ? 'worked today' : 'since you checked in'}</small>
          </div>
          <dl className="check-times">
            <div><dt>In</dt><dd>{fmtTime(rec.checkIn)}{rec.late && <span className="pill tone-progress"><i />Late</span>}</dd></div>
            <div><dt>Out</dt><dd>{rec.checkOut ? fmtTime(rec.checkOut) : '–'}</dd></div>
            <div><dt>Where</dt><dd>{MODE[rec.mode] || rec.mode}</dd></div>
          </dl>
          {!rec.checkOut
            ? <button className="btn primary wide" disabled={busy} onClick={() => act('/attendance/check-out', {}, 'Checked out. See you tomorrow.')}>Check out</button>
            : <p className="muted done-line"><Icon.check /> Done for today</p>}
        </>
      ) : (
        <>
          <div className="check-big"><b>{onLeave ? 'On leave' : 'Not checked in'}</b><small>{onLeave ? 'Enjoy your day off' : fmtTime(new Date())}</small></div>
          {!onLeave && (
            <>
              <div className="seg-ctl small" role="radiogroup" aria-label="Where are you working">
                {Object.entries(MODE).map(([k, l]) => <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? 'on tone-new' : 'tone-new'} onClick={() => setMode(k)}>{l}</button>)}
              </div>
              <button className="btn primary wide" disabled={busy} onClick={() => act('/attendance/check-in', { mode }, 'Checked in. Have a good day.')}>Check in</button>
            </>
          )}
        </>
      )}
    </section>
  )
}

function EditDay({ client, person, date, cell, onClose, onSaved, onError }) {
  const t = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '')
  const [f, setF] = useState({ status: ['present', 'half_day', 'absent', 'leave', 'holiday'].includes(cell.status) ? cell.status : 'present', checkIn: t(cell.checkIn) || '09:30', checkOut: t(cell.checkOut) || '18:00', note: cell.note || '' })
  const save = async (body) => {
    try { await client.put(`/attendance/${person._id}/${date}`, body); onSaved() } catch (err) { onError(err) }
  }
  const timed = f.status === 'present' || f.status === 'half_day'
  return (
    <Modal title={`${person.name} · ${fmtDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}`} onClose={onClose}>
      <form className="form-grid" onSubmit={(e) => { e.preventDefault(); save({ ...f, checkIn: timed ? f.checkIn : '', checkOut: timed ? f.checkOut : '' }) }}>
        <label className="span2"><span className="mono">Mark as</span>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {['present', 'half_day', 'absent', 'leave', 'holiday'].map((s) => <option key={s} value={s}>{CELL[s].label}</option>)}
          </select>
        </label>
        {timed && <label><span className="mono">In</span><input type="time" value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} /></label>}
        {timed && <label><span className="mono">Out</span><input type="time" value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} /></label>}
        <label className="span2"><span className="mono">Note</span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Forgot to check in, came at 9:15" /></label>
        <footer className="span2 modal-actions">
          <button type="button" className="btn sm" onClick={() => save({ clear: true })}>Clear the day</button>
          <span className="grow" />
          <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
          <button className="btn primary sm">Save</button>
        </footer>
      </form>
    </Modal>
  )
}

export default function Attendance({ client, user, can, onError, notify, version, params, setParams }) {
  const [today, setToday] = useState(null)
  const [month, setMonth] = useState(params.month || todayStr().slice(0, 7))
  const [grid, setGrid] = useState(null)
  const [team, setTeam] = useState(params.team || '')
  const [edit, setEdit] = useState(null)
  const loadToday = useCallback(() => client.get('/attendance/today').then(setToday, onError), [client, onError])
  const loadGrid = useCallback(() => client.get('/attendance/month', { month }).then(setGrid, onError), [client, month, onError])
  useEffect(() => { loadToday() }, [loadToday, version])
  useEffect(() => { loadGrid() }, [loadGrid, version])
  useEffect(() => { setParams({ month, team }) }, [month, team]) // eslint-disable-line react-hooks/exhaustive-deps

  const shift = (n) => { const [y, m] = month.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)) }
  const teams = useMemo(() => [...new Set((grid?.people || []).map((p) => p.user.team).filter(Boolean))].sort(), [grid])
  const people = (grid?.people || []).filter((p) => !team || p.user.team === team)
  const others = today?.board || []
  const groups = [
    ['In', others.filter((o) => o.status === 'present' || o.status === 'half_day')],
    ['On leave', others.filter((o) => o.status === 'leave')],
    ['Not in yet', others.filter((o) => o.status === 'not_in')],
  ]
  const scopeLabel = can('attendance.all') ? 'Everyone' : can('attendance.team') ? `Your team (${user.team})` : 'You'

  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">Attendance</span><h1>{fmtDay(today?.date || todayStr(), { weekday: 'long', day: 'numeric', month: 'long' })}</h1></div>
      </header>

      <div className="home-grid">
        <CheckCard client={client} data={today} reload={() => { loadToday(); loadGrid() }} onError={onError} notify={notify} />
        {others.length > 0 ? (
          <section className="card">
            <header className="card-h"><h3><Icon.users />{scopeLabel} today</h3><span className="mono muted">{today.counts.present} of {today.counts.total} in</span></header>
            <div className="board-today">
              {groups.map(([label, list]) => (
                <div key={label}>
                  <span className="mono muted">{label} · {list.length}</span>
                  <ul>
                    {list.map((o) => (
                      <li key={o.user._id}>
                        <Avatar name={o.user.name} size={28} />
                        <span><b>{o.user.name}</b><small>{o.checkIn ? `${fmtTime(o.checkIn)}${o.checkOut ? ` – ${fmtTime(o.checkOut)}` : ''}${o.mode && o.mode !== 'office' ? ` · ${MODE[o.mode]}` : ''}` : o.user.title}</small></span>
                        {o.late && <span className="pill tone-progress"><i />Late</span>}
                      </li>
                    ))}
                    {!list.length && <li className="muted none">Nobody</li>}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="card">
            <header className="card-h"><h3>This month</h3></header>
            {grid?.people?.[0] && <Totals t={grid.people[0].totals} />}
          </section>
        )}
      </div>

      <section className="card">
        <header className="card-h wrap">
          <h3>{fmtDay(`${month}-01`, { month: 'long', year: 'numeric' })}</h3>
          <div className="toolbar">
            {teams.length > 1 && (
              <select className="chip-select" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
                <option value="">All teams</option>{teams.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon.left /></button>
            <button className="chip" onClick={() => setMonth(todayStr().slice(0, 7))}>This month</button>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon.right /></button>
          </div>
        </header>
        {!grid ? <div className="loading">Loading…</div> : (
          <>
            <div className="att-wrap">
              <table className="att">
                <thead>
                  <tr>
                    <th className="who-col">Person</th>
                    {grid.days.map((d) => <th key={d.date} className={`${!d.workday ? 'off' : ''}${d.holiday ? ' hol' : ''}${d.date === grid.today ? ' today' : ''}`} title={d.holiday || ''}><small>{'SMTWTFS'[d.weekday]}</small>{Number(d.date.slice(8))}</th>)}
                    <th className="tot">Present</th><th className="tot">Leave</th><th className="tot">Absent</th><th className="tot">Late</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.user._id}>
                      <th className="who-col"><Avatar name={p.user.name} size={24} /><span><b>{p.user.name}</b><small>{p.user.team}</small></span></th>
                      {grid.days.map((d) => {
                        const c = p.days[d.date] || {}
                        const title = [CELL[c.status]?.label, c.checkIn && `${fmtTime(c.checkIn)}${c.checkOut ? `–${fmtTime(c.checkOut)}` : ''}`, c.hours && `${c.hours} h`, c.late && 'late', c.mode && c.mode !== 'office' && MODE[c.mode], c.label, c.note].filter(Boolean).join(' · ')
                        const editable = grid.canEdit && c.status !== 'upcoming'
                        return (
                          <td key={d.date} className={`c-${c.status}${c.late ? ' late' : ''}${d.date === grid.today ? ' today' : ''}`} title={title}>
                            {editable ? <button onClick={() => setEdit({ person: p.user, date: d.date, cell: c })} aria-label={`${p.user.name}, ${d.date}: ${title}`}>{CELL[c.status]?.short}</button> : <span>{CELL[c.status]?.short}</span>}
                          </td>
                        )
                      })}
                      <td className="tot">{p.totals.present + p.totals.half_day / 2}</td><td className="tot">{p.totals.leave}</td><td className="tot">{p.totals.absent}</td><td className="tot">{p.totals.late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legend att-legend">
              {['present', 'half_day', 'leave', 'absent', 'holiday', 'off'].map((s) => <span key={s}><i className={`sw c-${s}`}>{CELL[s].short}</i>{CELL[s].label}</span>)}
              <span><i className="sw c-present late">P</i>Late</span>
              {grid.canEdit && <span className="muted">Click a day to correct it.</span>}
            </div>
          </>
        )}
      </section>
      {edit && <EditDay client={client} {...edit} onClose={() => setEdit(null)} onError={onError} onSaved={() => { setEdit(null); notify('Day updated'); loadGrid(); loadToday() }} />}
    </div>
  )
}

function Totals({ t }) {
  return (
    <div className="totals">
      <div><b>{t.present + t.half_day / 2}</b><small>days present</small></div>
      <div><b>{t.leave}</b><small>on leave</small></div>
      <div><b>{t.late}</b><small>late</small></div>
      <div><b>{t.hours}</b><small>hours</small></div>
    </div>
  )
}
