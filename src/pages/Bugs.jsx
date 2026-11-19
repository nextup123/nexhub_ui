import { useCallback, useEffect, useState } from 'react'
import { Avatar, Icon, fmtDateTime, timeAgo } from '../ui'

const SEV = { critical: ['Critical', 'bad'], high: ['Serious', 'progress'], medium: ['Annoying', 'new'], low: ['Small', 'muted'] }
const ST = { new: 'New', triaged: 'Triaged', need_info: 'Need info', in_progress: 'In progress', fixed: 'Fixed', released: 'Released', closed: 'Closed', wont_fix: "Won't fix", duplicate: 'Duplicate' }
const ST_TONE = { new: 'new', triaged: 'new', need_info: 'progress', in_progress: 'progress', fixed: 'good', released: 'good', closed: 'muted', wont_fix: 'muted', duplicate: 'muted' }
const CAT = { crash: 'Crash', wrong_result: 'Wrong result', drive_communication: 'Drive communication', screen_problem: 'Screen problem', slow: 'Slow', update: 'Update', other: 'Other' }
const Sev = ({ s }) => <span className={`pill tone-${SEV[s]?.[1] || 'muted'}`}><i />{SEV[s]?.[0] || s}</span>
const St = ({ s }) => <span className={`pill tone-${ST_TONE[s] || 'muted'}`}><i />{ST[s] || s}</span>

function BugDetail({ number, client, can, onError, notify, onChanged, onClose }) {
  const [bug, setBug] = useState(null)
  const [text, setText] = useState('')
  useEffect(() => { client.get(`/bugs/${number}`).then((r) => setBug(r.bug), onError) }, [client, number, onError])
  const patch = async (body, msg) => { try { const r = await client.patch(`/bugs/${number}`, body); setBug(r.bug); onChanged(); if (msg) notify(msg) } catch (err) { onError(err) } }
  const comment = async (e) => {
    e.preventDefault()
    try { const r = await client.post(`/bugs/${number}/comments`, { text }); setBug((b) => ({ ...b, comments: [...(b.comments || []), r.comment] })); setText('') } catch (err) { onError(err) }
  }
  if (!bug) return <div className="detail"><div className="loading">Loading…</div></div>
  const triage = can('bugs.triage')
  return (
    <article className="detail">
      <header className="detail-h">
        <button className="icon-btn back" onClick={onClose} aria-label="Back to the list"><Icon.back /></button>
        <span className="mono muted">{bug.number} · {bug.appId === 'main_app' ? 'Main application' : 'EtherCAT config tool'} {bug.appVersion ? `v${bug.appVersion}` : ''}</span>
        <div className="detail-tools"><button className="icon-btn close" onClick={onClose} aria-label="Close"><Icon.close /></button></div>
      </header>
      <h2 className="bug-title">{bug.title}</h2>
      <div className="row-meta"><Sev s={bug.severity} /><St s={bug.status} /><span className="tag">{CAT[bug.category]}</span><span className="tag ghost">{bug.frequency === 'always' ? 'Every time' : bug.frequency === 'sometimes' ? 'Sometimes' : 'Once'}</span></div>
      {triage && (
        <div className="form-grid compact">
          <label><span className="mono">Status</span><select value={bug.status} onChange={(e) => patch({ status: e.target.value }, `${bug.number}: ${ST[e.target.value]}`)}>{Object.entries(ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="mono">Priority</span><select value={bug.priority || ''} onChange={(e) => patch({ priority: e.target.value || null })}><option value="">Not set</option>{Object.entries(SEV).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label><span className="mono">Who fixes it</span><input defaultValue={bug.assignee || ''} onBlur={(e) => e.target.value !== (bug.assignee || '') && patch({ assignee: e.target.value }, 'Assigned')} placeholder="Name" /></label>
          <label><span className="mono">Fixed in version</span><input defaultValue={bug.fixedInVersion || ''} onBlur={(e) => e.target.value !== (bug.fixedInVersion || '') && patch({ fixedInVersion: e.target.value })} placeholder="3.5.1" /></label>
        </div>
      )}
      <section className="message"><span className="mono muted">What happened</span><p>{bug.description}</p>
        {bug.stepsToReproduce && <><span className="mono muted">What they were doing</span><p className="pre">{bug.stepsToReproduce}</p></>}
      </section>
      <dl className="facts">
        <div><dt><Icon.factory />Machine</dt><dd>{bug.machine?.name || '–'}{bug.machine?.site ? ` · ${bug.machine.site}` : ''}</dd></div>
        <div><dt><Icon.building />Reported by</dt><dd>{bug.reporter?.name || '–'}{bug.reporter?.company ? `, ${bug.reporter.company}` : ''}{bug.reporter?.phone ? <small className="block"><a href={`tel:${bug.reporter.phone.replace(/[^\d+]/g, '')}`}>{bug.reporter.phone}</a></small> : null}</dd></div>
        <div><dt><Icon.clock />Reported</dt><dd>{fmtDateTime(bug.reportedAt || bug.createdAt)}</dd></div>
        <div><dt><Icon.settings />Assigned to</dt><dd>{bug.assignee || <span className="dim">Nobody yet</span>}</dd></div>
      </dl>
      {bug.attachments?.length > 0 && <div className="shots">{bug.attachments.map((a) => <span key={a.id} className="tag">{a.name}</span>)}</div>}
      <section className="activity">
        <span className="mono muted">Comments</span>
        <ol>
          {(bug.comments || []).map((c, i) => (
            <li key={i} className="note"><Avatar name={c.author} size={26} /><div><b>{c.author}</b> <time className="dim">{timeAgo(c.at)}</time>{!c.internal && <span className="tag">Visible to the customer</span>}<p>{c.text}</p></div></li>
          ))}
          {(bug.statusHistory || []).slice(1).map((h, i) => <li key={`h${i}`} className="ev"><i className={`dot tone-${ST_TONE[h.status]}`} /><span>Marked <b>{ST[h.status]?.toLowerCase()}</b> by {h.by}</span><time className="dim">{timeAgo(h.at)}</time></li>)}
        </ol>
        {can('bugs.comment') && (
          <form className="note-form" onSubmit={comment}>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment for the team…" />
            <button className="btn sm" disabled={!text.trim()}>Comment</button>
          </form>
        )}
      </section>
    </article>
  )
}

export default function Bugs({ client, can, params, setParams, onError, notify, version, refreshBadges, badges }) {
  const [data, setData] = useState(null)
  const [q, setQ] = useState(params.q || '')
  const status = params.status || 'open'
  const key = JSON.stringify({ status, appId: params.app, severity: params.severity, q: params.q })
  const load = useCallback(() => client.get('/bugs', { ...JSON.parse(key), limit: 100 }).then(setData, onError), [client, key, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { const t = setTimeout(() => { if ((params.q || '') !== q) setParams({ ...params, q }) }, 300); return () => clearTimeout(t) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p) => setParams({ ...params, ...p })
  const apps = badges?.bugs || {}

  return (
    <div className={`inbox${params.n ? ' has-detail' : ''}`}>
      <section className="list-pane">
        <header className="list-h">
          <div className="list-title"><h1>Bug reports</h1><span className="mono muted">{data ? `${data.total} ${status === 'open' ? 'open' : 'listed'}` : '…'}</span></div>
          <div className="subtabs inline">
            {[['', 'All apps'], ...Object.entries(apps).map(([id, a]) => [id, a.name])].map(([id, l]) => (
              <button key={id || 'all'} className={(params.app || '') === id ? 'on' : ''} onClick={() => set({ app: id || undefined, n: undefined })}>{l}{id && apps[id]?.open ? <em>{apps[id].open}</em> : null}</button>
            ))}
          </div>
          <div className="search"><Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, number, customer, machine…" aria-label="Search bugs" /></div>
          <div className="filters">
            <select value={status} onChange={(e) => set({ status: e.target.value, n: undefined })} aria-label="Status">
              <option value="open">Open</option><option value="">Everything</option>{Object.entries(ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {Object.entries(SEV).map(([k, [l]]) => <button key={k} className={`chip${params.severity === k ? ' on' : ''}`} onClick={() => set({ severity: params.severity === k ? undefined : k })}>{l}</button>)}
          </div>
        </header>
        <div className="rows">
          {!data ? <div className="loading">Loading…</div> : data.bugs.length === 0 ? (
            <div className="empty"><Icon.bug /><b>No bugs here</b><span className="muted">Nothing matches these filters.</span></div>
          ) : data.bugs.map((b) => (
            <button key={b.number} className={`row${params.n === b.number ? ' sel' : ''}`} onClick={() => set({ n: b.number })}>
              <span className={`sev-bar tone-${SEV[b.severity]?.[1]}`} />
              <span className="row-main">
                <span className="row-top"><b>{b.title}</b><span className="row-time">{timeAgo(b.createdAt)}</span></span>
                <span className="row-co">{b.reporter?.company || b.machine?.name || 'Unknown customer'}</span>
                <span className="row-meta"><Sev s={b.severity} /><St s={b.status} /><span className="tag ghost">{CAT[b.category]}</span>{b.assignee && <span className="tag">{b.assignee}</span>}<span className="mono muted ref">{b.number}</span></span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="detail-pane">
        {params.n
          ? <BugDetail key={params.n} number={params.n} client={client} can={can} onError={onError} notify={notify} onChanged={() => { load(); refreshBadges() }} onClose={() => set({ n: undefined })} />
          : <div className="empty detail-empty"><Icon.bug /><b>Pick a bug report to read it</b><span className="muted">{can('bugs.triage') ? 'You can change status, priority and who fixes it.' : 'You can read reports and comment.'}</span></div>}
      </section>
    </div>
  )
}
