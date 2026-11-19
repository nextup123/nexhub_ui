import { useEffect, useState } from 'react'
import { Avatar, Icon, STATUS, STATUS_ORDER, StatusPill, timeAgo, useTick } from './ui'

function Kpi({ label, value, sub, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`kpi${onClick ? ' link' : ''}`} onClick={onClick}>
      <span className="mono muted">{label}</span>
      <b>{value ?? '–'}</b>
      {sub && <small>{sub}</small>}
    </Tag>
  )
}

/** Enquiries per day: one series, so one colour and no legend; hover shows the exact day. */
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(4, ...daily.map((d) => d.count))
  const step = max <= 6 ? 1 : max <= 12 ? 2 : Math.ceil(max / 5)
  const top = Math.ceil(max / step) * step
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  const W = 1000; const H = 240; const L = 34; const B = 26; const T = 10
  const bw = (W - L) / daily.length
  const y = (v) => T + (H - T - B) * (1 - v / top)
  const label = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Enquiries per day, last 30 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
          </g>
        ))}
        {daily.map((d, i) => {
          const h = y(0) - y(d.count)
          const x = L + i * bw + 2
          const w = Math.max(2, bw - 4)
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)}>
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
              {d.count > 0 && (
                <path className={`bar${hover === i ? ' on' : ''}`}
                  d={`M${x},${y(0)} V${y(d.count) + Math.min(4, h)} q0,-4 4,-4 H${x + w - 4} q4,0 4,4 V${y(0)} Z`} />
              )}
            </g>
          )
        })}
      </svg>
      <div className="chart-y">{ticks.map((t) => <span key={t} style={{ top: `${(y(t) / H) * 100}%` }}>{t}</span>)}</div>
      <div className="chart-x">
        {daily.map((d, i) => (i % 5 === (daily.length - 1) % 5 ? <span key={d.date} style={{ left: `${((L + (i + 0.5) * bw) / W) * 100}%` }}>{label(d.date)}</span> : null))}
      </div>
      {hover !== null && (
        <div className={`tip${hover > daily.length - 4 ? ' end' : hover < 3 ? ' start' : ''}`} style={{ left: `${((L + (hover + 0.5) * bw) / W) * 100}%`, top: `${(y(daily[hover].count) / H) * 100}%` }}>
          <div><b>{daily[hover].count}</b> {daily[hover].count === 1 ? 'enquiry' : 'enquiries'}</div><span>{label(daily[hover].date)}</span>
        </div>
      )}
    </div>
  )
}

function Breakdown({ title, icon, rows, total, onPick }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <section className="card">
      <header className="card-h"><h3>{icon}{title}</h3><span className="mono muted">Last 30 days</span></header>
      {rows.length === 0 ? <p className="empty-s">No enquiries yet.</p> : (
        <ul className="hbars">
          {rows.slice(0, 7).map((r) => (
            <li key={r.name}>
              <button onClick={() => onPick(r.name)} title={`Show ${r.name}`}>
                <span className="hb-name">{r.name}</span>
                <span className="hb-track"><i style={{ width: `${(r.count / max) * 100}%` }} /></span>
                <span className="hb-val">{r.count}<small>{Math.round((r.count / total) * 100)}%</small></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function Overview({ summary, client, version, onError, go }) {
  useTick()
  const [recent, setRecent] = useState(null)
  useEffect(() => {
    client.list({ status: 'inbox', limit: 6 }).then((r) => setRecent(r.submissions), onError)
  }, [client, version, onError])

  if (!summary) return <div className="page"><div className="loading">Loading…</div></div>

  const s = summary
  const trend = s.prev7 ? Math.round(((s.last7 - s.prev7) / s.prev7) * 100) : null
  const last30 = s.daily.reduce((n, d) => n + d.count, 0)
  const statusTotal = STATUS_ORDER.filter((k) => k !== 'spam').reduce((n, k) => n + (s.byStatus[k] || 0), 0)
  const hours = s.medianReplyHours
  const replyTime = hours == null ? '–' : hours < 1 ? `${Math.max(1, Math.round(hours * 60))} min` : hours < 48 ? `${Math.round(hours)} h` : `${Math.round(hours / 24)} days`

  return (
    <div className="page">
      <header className="page-h">
        <div>
          <span className="mono muted">Overview</span>
          <h1>{s.unread ? <>{s.unread} unread <span className="muted">{s.unread === 1 ? 'enquiry.' : 'enquiries.'}</span></> : <>All caught up.</>}</h1>
        </div>
        {s.unread > 0 && <button className="btn primary" onClick={() => go('inbox', { status: 'inbox', unread: 'true' })}>Read them<Icon.arrow /></button>}
      </header>

      <div className="kpis">
        <Kpi label="Waiting for a reply" value={s.open} sub={`${s.byStatus.new} new · ${s.byStatus.in_progress} in progress`} onClick={() => go('inbox', { status: 'open' })} />
        <Kpi label="This week" value={s.last7} sub={trend === null ? 'No enquiries the week before' : `${trend >= 0 ? '+' : ''}${trend}% on the week before (${s.prev7})`} />
        <Kpi label="Answered" value={s.replyRate == null ? '–' : `${Math.round(s.replyRate * 100)}%`} sub={`${s.answered} of ${s.total} replied or closed`} />
        <Kpi label="Typical reply time" value={replyTime} sub="Median, from arrival to Replied" />
      </div>

      <section className="card">
        <header className="card-h"><h3>Enquiries per day</h3><span className="mono muted">{last30} in the last 30 days</span></header>
        <DailyChart daily={s.daily} />
      </section>

      <section className="card">
        <header className="card-h"><h3>Where things stand</h3><span className="mono muted">{statusTotal} enquiries · {s.spam} spam</span></header>
        <div className="stack" role="img" aria-label="Enquiries by status">
          {STATUS_ORDER.filter((k) => k !== 'spam' && s.byStatus[k]).map((k) => (
            <button key={k} className={`seg tone-${STATUS[k].tone}`} style={{ flexGrow: s.byStatus[k] }} onClick={() => go('inbox', { status: k })} title={`${STATUS[k].label}: ${s.byStatus[k]}`} />
          ))}
        </div>
        <div className="legend">
          {STATUS_ORDER.filter((k) => k !== 'spam').map((k) => (
            <button key={k} onClick={() => go('inbox', { status: k })}><i className={`dot tone-${STATUS[k].tone}`} />{STATUS[k].label}<b>{s.byStatus[k] || 0}</b></button>
          ))}
        </div>
      </section>

      <div className="two-col">
        <Breakdown title="Interested in" icon={<Icon.robot />} rows={s.byProduct} total={last30 || 1} onPick={(p) => go('inbox', { status: 'inbox', product: p === 'Not given' ? '' : p })} />
        <Breakdown title="Industry" icon={<Icon.factory />} rows={s.byIndustry} total={last30 || 1} onPick={(p) => go('inbox', { status: 'inbox', industry: p === 'Not given' ? '' : p })} />
      </div>

      <section className="card">
        <header className="card-h"><h3>Latest enquiries</h3><button className="link-btn" onClick={() => go('inbox', { status: 'inbox' })}>See all<Icon.arrow /></button></header>
        {!recent ? <div className="loading">Loading…</div> : recent.length === 0 ? <p className="empty-s">Nothing yet. Enquiries from the website’s contact page appear here.</p> : (
          <ul className="recent">
            {recent.map((r) => (
              <li key={r._id}>
                <button onClick={() => go('inbox', { status: 'inbox', id: r._id })} className={r.readAt ? '' : 'unread'}>
                  <Avatar name={r.name} />
                  <span className="r-who"><b>{r.name}</b><small>{r.company || r.email || r.phone}</small></span>
                  <span className="r-msg">{r.message}</span>
                  <span className="r-prod mono">{r.product}</span>
                  <StatusPill status={r.status} />
                  <span className="r-time muted">{timeAgo(r.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
