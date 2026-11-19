import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Modal, addDaysStr, fmtDay, todayStr } from '../ui'

const TYPE = { holiday: 'Holiday', event: 'Event', leave: 'On leave', unit: 'Production', visit: 'Site visit' }
const KINDS = { meeting: 'Meeting', demo: 'Demo', dispatch: 'Dispatch', training: 'Training', visit: 'Customer visit', other: 'Other' }
const HOL_KINDS = { national: 'National holiday', festival: 'Festival', optional: 'Optional holiday' }

function EventForm({ client, date, event, onClose, onSaved, onError }) {
  const [f, setF] = useState(event ? { title: event.title, date: event.date, endDate: event.endDate !== event.date ? event.endDate : '', time: event.time || '', kind: event.kind, location: event.location || '', description: event.description || '' } : { title: '', date, endDate: '', time: '', kind: 'meeting', location: '', description: '' })
  const save = async (e) => {
    e.preventDefault()
    try {
      if (event) await client.patch(`/events/${event.id}`, f)
      else await client.post('/events', f)
      onSaved(event ? 'Event updated' : 'Event added')
    } catch (err) { onError(err) }
  }
  const remove = async () => { try { await client.del(`/events/${event.id}`); onSaved('Event deleted') } catch (err) { onError(err) } }
  return (
    <Modal title={event ? 'Edit event' : 'Add an event'} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="span2"><span className="mono">Title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus placeholder="e.g. Demo for Verma CNC" /></label>
        <label><span className="mono">Date</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
        <label><span className="mono">Time</span><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
        <label><span className="mono">Kind</span><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="mono">Ends on <small>(several days)</small></span><input type="date" value={f.endDate} min={f.date} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></label>
        <label className="span2"><span className="mono">Where</span><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
        <label className="span2"><span className="mono">Details</span><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
        <footer className="span2 modal-actions">
          {event && <button type="button" className="btn sm danger-ghost" onClick={remove}>Delete</button>}
          <span className="grow" />
          <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
          <button className="btn primary sm">Save</button>
        </footer>
      </form>
    </Modal>
  )
}

function Holidays({ client, can, onError, notify, year, reload }) {
  const [list, setList] = useState(null)
  const [f, setF] = useState({ date: '', name: '', kind: 'festival' })
  const load = useCallback(() => client.get('/holidays', { year }).then((r) => setList(r.holidays), onError), [client, year, onError])
  useEffect(() => { load() }, [load])
  const add = async (e) => {
    e.preventDefault()
    try { await client.post('/holidays', f); setF({ date: '', name: '', kind: 'festival' }); notify('Holiday added'); load(); reload() } catch (err) { onError(err) }
  }
  const remove = async (h) => { try { await client.del(`/holidays/${h._id}`); notify(`${h.name} removed`, 'muted'); load(); reload() } catch (err) { onError(err) } }
  const today = todayStr()
  return (
    <section className="card">
      <header className="card-h"><h3>Holidays {year}</h3><span className="mono muted">{list ? `${list.filter((h) => h.kind !== 'optional').length} days off` : ''}</span></header>
      {!list ? <div className="loading">Loading…</div> : (
        <ul className="hol-list">
          {list.map((h) => (
            <li key={h._id} className={h.date < today ? 'past' : ''}>
              <span className="ag-date"><b>{fmtDay(h.date, { day: 'numeric' })}</b><small>{fmtDay(h.date, { month: 'short' })}</small></span>
              <span className="ag-main"><b>{h.name}</b><small>{fmtDay(h.date, { weekday: 'long' })} · {HOL_KINDS[h.kind]}</small></span>
              {can('holidays.manage') && <button className="icon-btn" onClick={() => remove(h)} aria-label={`Remove ${h.name}`}><Icon.trash /></button>}
            </li>
          ))}
          {list.length === 0 && <li className="muted">No holidays added for {year} yet.</li>}
        </ul>
      )}
      {can('holidays.manage') && (
        <form className="inline-form" onSubmit={add}>
          <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required aria-label="Date" />
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Holiday name" required aria-label="Name" />
          <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label="Kind">{Object.entries(HOL_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="btn sm primary"><Icon.plus />Add</button>
        </form>
      )}
    </section>
  )
}

export default function Calendar({ client, can, go, onError, notify, version, params, setParams }) {
  const [month, setMonth] = useState(params.month || todayStr().slice(0, 7))
  const [data, setData] = useState(null)
  const [picked, setPicked] = useState(params.day || todayStr())
  const [form, setForm] = useState(null)
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const start = addDaysStr(first, -((new Date(y, m - 1, 1).getDay() + 6) % 7)) // weeks start on Monday
  const cells = useMemo(() => Array.from({ length: 42 }, (_, i) => addDaysStr(start, i)), [start])
  const end = cells[41]
  const load = useCallback(() => client.get('/calendar', { from: start, to: end }).then(setData, onError), [client, start, end, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { setParams({ month, day: picked }) }, [month, picked]) // eslint-disable-line react-hooks/exhaustive-deps

  const shift = (n) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const on = (date) => (data?.items || []).filter((i) => i.date <= date && (i.endDate || i.date) >= date)
  const workDays = new Set(data?.workDays || [1, 2, 3, 4, 5, 6])
  const today = todayStr()
  const dayItems = on(picked)
  const openItem = (i) => {
    if (i.type === 'unit') go('production', { id: i.id })
    else if (i.type === 'visit') go('projects', { id: i.projectId, tab: 'visits', e: i.id })
    else if (i.type === 'event' && i.canEdit) setForm({ event: i })
  }

  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">Company calendar</span><h1>{new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long' })} <span className="muted">{y}</span></h1></div>
        <div className="toolbar">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon.left /></button>
          <button className="chip" onClick={() => { setMonth(today.slice(0, 7)); setPicked(today) }}>Today</button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon.right /></button>
          {can('calendar.manage') && <button className="btn primary" onClick={() => setForm({ date: picked })}><Icon.plus />Add event</button>}
        </div>
      </header>

      <div className="cal-layout">
        <section className="card cal-card">
          <div className="cal">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-h mono">{d}</div>)}
            {cells.map((d) => {
              const items = on(d)
              const wd = new Date(`${d}T00:00:00`).getDay()
              const hol = items.find((i) => i.type === 'holiday' && i.kind !== 'optional')
              return (
                <button key={d} className={`cal-d${d.slice(0, 7) !== month ? ' other' : ''}${!workDays.has(wd) || hol ? ' off' : ''}${d === today ? ' today' : ''}${d === picked ? ' picked' : ''}`} onClick={() => setPicked(d)}>
                  <span className="cal-n">{Number(d.slice(8))}</span>
                  <span className="cal-items">
                    {items.slice(0, 3).map((i) => <span key={i.type + i.id} className={`cal-i k-${i.type}${i.kind ? ` kk-${i.kind}` : ''}`}>{i.type === 'leave' ? `${i.title.split(' ')[0]} off` : i.title}</span>)}
                    {items.length > 3 && <span className="cal-more">+{items.length - 3} more</span>}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="legend">
            {Object.entries(TYPE).filter(([k]) => (k !== 'unit' || can('production.view')) && (k !== 'visit' || can('projects.view'))).map(([k, l]) => <span key={k}><i className={`sw-bar k-${k}`} />{l}</span>)}
          </div>
        </section>

        <aside className="card day-panel">
          <header className="card-h"><h3>{fmtDay(picked, { weekday: 'long', day: 'numeric', month: 'long' })}</h3></header>
          {dayItems.length === 0 ? <p className="empty-s">Nothing on this day.</p> : (
            <ul className="agenda">
              {dayItems.map((i) => (
                <li key={i.type + i.id}>
                  <span className={`ag-bar k-${i.type}`} />
                  <button className="ag-main" onClick={() => openItem(i)} disabled={!(i.type === 'unit' || i.type === 'visit' || (i.type === 'event' && i.canEdit))}>
                    <b>{i.type === 'leave' ? `${i.title} is on leave` : i.title}</b>
                    <small>{i.type === 'event' ? KINDS[i.kind] : i.type === 'holiday' ? HOL_KINDS[i.kind] : TYPE[i.type]}{i.type === 'visit' && i.people?.length ? ` · ${i.people.join(', ')}` : ''}{i.time ? ` · ${i.time}` : ''}{i.location ? ` · ${i.location}` : ''}{i.halfDay ? ' · half day' : ''}{i.endDate && i.endDate !== i.date ? ` · until ${fmtDay(i.endDate)}` : ''}</small>
                    {i.description && <p>{i.description}</p>}
                    {i.createdBy && <small className="muted">Added by {i.createdBy}</small>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {can('calendar.manage') && <button className="btn sm" onClick={() => setForm({ date: picked })}><Icon.plus />Add an event on this day</button>}
        </aside>
      </div>

      <Holidays client={client} can={can} onError={onError} notify={notify} year={String(y)} reload={load} />

      {form && <EventForm client={client} date={form.date} event={form.event} onError={onError} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); notify(msg); load() }} />}
    </div>
  )
}
