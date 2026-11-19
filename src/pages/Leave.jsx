import { useCallback, useEffect, useState } from 'react'
import { Avatar, Icon, Modal, fmtRange, timeAgo, todayStr } from '../ui'

const LABELS = { casual: 'Casual leave', sick: 'Sick leave', earned: 'Earned leave', unpaid: 'Unpaid leave' }
const STATUS_TONE = { pending: 'progress', approved: 'good', rejected: 'bad', cancelled: 'muted' }
const STATUS_LABEL = { pending: 'Waiting', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled' }
const Pill = ({ s }) => <span className={`pill tone-${STATUS_TONE[s]}`}><i />{STATUS_LABEL[s]}</span>
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`

function RequestForm({ client, onClose, onDone, onError }) {
  const [f, setF] = useState({ type: 'casual', from: todayStr(), to: todayStr(), halfDay: false, reason: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try { const r = await client.post('/leave', f); onDone(r.leave) } catch (err) { onError(err) } finally { setBusy(false) }
  }
  return (
    <Modal title="Ask for leave" onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <label className="span2"><span className="mono">Type</span>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label><span className="mono">From</span><input type="date" value={f.from} required onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} /></label>
        <label><span className="mono">To</span><input type="date" value={f.to} min={f.from} required onChange={(e) => setF({ ...f, to: e.target.value, halfDay: false })} /></label>
        {f.from === f.to && <label className="check span2"><input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked })} /><span>Half day</span></label>}
        <label className="span2"><span className="mono">Reason <small>(only you and whoever approves it see this)</small></span><textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <p className="span2 muted small">Sundays and company holidays are not counted.</p>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm" disabled={busy}>Send request</button></footer>
      </form>
    </Modal>
  )
}

export default function Leave({ client, user, can, onError, notify, version, refreshBadges }) {
  const year = todayStr().slice(0, 4)
  const [bal, setBal] = useState(null)
  const [mine, setMine] = useState(null)
  const [approvals, setApprovals] = useState(null)
  const [team, setTeam] = useState(null)
  const [asking, setAsking] = useState(false)
  const [comment, setComment] = useState({})
  const approver = can('leave.approve_all') || can('leave.approve_team')

  const load = useCallback(() => {
    client.get('/leave/balance', { year }).then((r) => setBal(r.balance), onError)
    client.get('/leave', { scope: 'mine' }).then((r) => setMine(r.leave), onError)
    if (approver) {
      client.get('/leave', { scope: 'approvals' }).then((r) => setApprovals(r.leave), onError)
      client.get('/leave', { scope: 'team', status: 'approved,pending', year }).then((r) => setTeam(r.leave.filter((l) => !l.mine)), onError)
    }
  }, [client, year, approver, onError])
  useEffect(() => { load() }, [load, version])

  const decide = async (l, decision) => {
    try {
      await client.post(`/leave/${l._id}/decision`, { decision, comment: comment[l._id] || '' })
      notify(decision === 'approve' ? `Approved ${l.user.name}'s leave` : `Declined ${l.user.name}'s leave`, decision === 'approve' ? 'good' : 'muted')
      load(); refreshBadges()
    } catch (err) { onError(err) }
  }
  const cancel = async (l) => {
    try { await client.post(`/leave/${l._id}/cancel`); notify('Request cancelled', 'muted'); load() } catch (err) { onError(err) }
  }
  const upcomingTeam = (team || []).filter((l) => l.to >= todayStr()).sort((a, b) => (a.from < b.from ? -1 : 1))

  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">Leave · {year}</span><h1>{approvals?.length ? <>{approvals.length} waiting <span className="muted">for you.</span></> : <>Time off.</>}</h1></div>
        <button className="btn primary" onClick={() => setAsking(true)}><Icon.plus />Ask for leave</button>
      </header>

      <div className="kpis">
        {bal ? Object.entries(LABELS).map(([k, l]) => {
          const b = bal[k]
          return (
            <div key={k} className="kpi">
              <span className="mono muted">{l}</span>
              <b>{b.allowed == null ? b.used : b.left}<span className="of">{b.allowed == null ? ' used' : ` / ${b.allowed}`}</span></b>
              {b.allowed != null && <span className="meter"><i style={{ width: `${Math.min(100, ((b.used + b.pending) / b.allowed) * 100)}%` }} /></span>}
              <small>{b.allowed == null ? 'No limit' : `${days(b.used)} taken${b.pending ? `, ${b.pending} waiting` : ''}`}</small>
            </div>
          )
        }) : <div className="kpi"><div className="loading">Loading…</div></div>}
      </div>

      {approver && (
        <section className="card">
          <header className="card-h"><h3>Waiting for your decision</h3><span className="mono muted">{can('leave.approve_all') ? 'Everyone' : `Team ${user.team}`}</span></header>
          {!approvals ? <div className="loading">Loading…</div> : approvals.length === 0 ? <p className="empty-s">Nothing to decide. All caught up.</p> : (
            <ul className="approvals">
              {approvals.map((l) => (
                <li key={l._id}>
                  <Avatar name={l.user.name} size={40} />
                  <div className="ap-main">
                    <b>{l.user.name} <span className="muted">· {l.user.team}</span></b>
                    <span>{LABELS[l.type]} · {fmtRange(l.from, l.to)} · <b>{l.halfDay ? 'half a day' : days(l.days)}</b></span>
                    {l.reason && <p>“{l.reason}”</p>}
                    <small className="muted">Asked {timeAgo(l.createdAt)}</small>
                  </div>
                  <div className="ap-act">
                    <input placeholder="Comment (optional)" value={comment[l._id] || ''} onChange={(e) => setComment({ ...comment, [l._id]: e.target.value })} />
                    <div>
                      <button className="btn sm" onClick={() => decide(l, 'reject')}>Decline</button>
                      <button className="btn primary sm" onClick={() => decide(l, 'approve')}><Icon.check />Approve</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="two-col">
        <section className="card">
          <header className="card-h"><h3>Your requests</h3></header>
          {!mine ? <div className="loading">Loading…</div> : mine.length === 0 ? <p className="empty-s">You have not asked for leave yet.</p> : (
            <table className="tbl">
              <thead><tr><th>Dates</th><th>Type</th><th>Days</th><th>Status</th><th /></tr></thead>
              <tbody>
                {mine.map((l) => (
                  <tr key={l._id}>
                    <td>{fmtRange(l.from, l.to)}{l.comment && <small className="block muted">“{l.comment}” – {l.decidedBy}</small>}</td>
                    <td>{LABELS[l.type]}</td>
                    <td>{l.halfDay ? '½' : l.days}</td>
                    <td><Pill s={l.status} />{l.decidedBy && l.status !== 'pending' && <small className="block muted">by {l.decidedBy}</small>}</td>
                    <td className="right">{(l.status === 'pending' || (l.status === 'approved' && l.from > todayStr())) && <button className="link-btn sm" onClick={() => cancel(l)}>Cancel</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {approver && (
          <section className="card">
            <header className="card-h"><h3>Who is away next</h3><span className="mono muted">{can('leave.approve_all') ? 'Everyone' : `Team ${user.team}`}</span></header>
            {!team ? <div className="loading">Loading…</div> : upcomingTeam.length === 0 ? <p className="empty-s">Nobody has leave coming up.</p> : (
              <ul className="people-mini">
                {upcomingTeam.slice(0, 10).map((l) => (
                  <li key={l._id}><Avatar name={l.user.name} size={30} /><span><b>{l.user.name}</b><small>{fmtRange(l.from, l.to)} · {LABELS[l.type]}</small></span><Pill s={l.status} /></li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
      {asking && <RequestForm client={client} onError={onError} onClose={() => setAsking(false)} onDone={(l) => { setAsking(false); notify(`Request sent: ${days(l.days)}`); load() }} />}
    </div>
  )
}
