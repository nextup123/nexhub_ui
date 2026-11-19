import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Icon, Modal, fmtDay, fmtDateTime, timeAgo, todayStr } from '../ui'

const PHASES = [
  ['planned', 'Planned'], ['in_build', 'In build'], ['testing', 'Testing'], ['ready', 'Ready to ship'], ['dispatched', 'Dispatched'], ['installed', 'Installed'],
]
const PHASE_LABEL = Object.fromEntries(PHASES)
const STATE_LABEL = { pending: 'Not started', in_progress: 'In progress', done: 'Done', blocked: 'Blocked', skipped: 'Skipped' }
const NEXT_STATE = { pending: 'in_progress', in_progress: 'done', done: 'pending', blocked: 'in_progress', skipped: 'pending' }

/** One small block per stage, coloured by its state: the build at a glance. */
function StageStrip({ stages, big }) {
  return (
    <span className={`strip${big ? ' big' : ''}`} aria-hidden="true">
      {stages.filter((s) => s.state !== 'skipped').map((s) => <i key={s.key} className={`st-${s.state}`} title={`${s.label}: ${STATE_LABEL[s.state]}`} />)}
    </span>
  )
}
const Due = ({ u }) => (u.targetDate ? <span className={`due${u.late ? ' late' : ''}`}>{u.late ? <Icon.alert /> : null}{u.dispatchedOn ? `Sent ${fmtDay(u.dispatchedOn, { day: 'numeric', month: 'short' })}` : `Due ${fmtDay(u.targetDate, { day: 'numeric', month: 'short' })}`}</span> : null)
const Priority = ({ p }) => (p && p !== 'normal' ? <span className={`prio prio-${p}`}>{p === 'urgent' ? 'Urgent' : 'High'}</span> : null)

function UnitCard({ u, onOpen }) {
  return (
    <button className={`ucard${u.onHold ? ' hold' : ''}`} onClick={() => onOpen(u._id)}>
      <span className="uc-top"><b className="mono">{u.serial}</b><Priority p={u.priority} /></span>
      <span className="uc-model">{u.model}{u.colour ? ` · ${u.colour}` : ''}</span>
      <span className="uc-cust">{u.customer?.company || 'Stock'}{u.customer?.city ? `, ${u.customer.city}` : ''}</span>
      <StageStrip stages={u.stages} />
      <span className="uc-now">
        {u.onHold ? <><Icon.pause />On hold</> : u.progress.current ? <><i className={`stage-dot st-${u.progress.current.state}`} /><span className="uc-label">{u.progress.current.label}</span></> : <><Icon.check />All stages done</>}
        {u.progress.current?.assignee && <span className="muted uc-who">· {u.progress.current.assignee.split(' ')[0]}</span>}
      </span>
      <span className="uc-foot"><span className="mono muted">{u.progress.done}/{u.progress.total}</span><Due u={u} /></span>
    </button>
  )
}

function NewUnit({ client, templates, onClose, onDone, onError }) {
  const [f, setF] = useState({ model: 'NexC5', colour: 'White', company: '', city: '', enquiryRef: '', targetDate: '', priority: 'normal', description: '' })
  const model = templates?.models.find((m) => m.name === f.model)
  const save = async (e) => {
    e.preventDefault()
    try {
      const r = await client.post('/units', { model: f.model, colour: model?.colours.length ? f.colour : '', customer: { company: f.company, city: f.city }, enquiryRef: f.enquiryRef, targetDate: f.targetDate, priority: f.priority, description: f.description })
      onDone(r.unit)
    } catch (err) { onError(err) }
  }
  return (
    <Modal title="Add a robot to the build" onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label><span className="mono">Model</span><select value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })}>{templates?.models.map((m) => <option key={m.name}>{m.name}</option>)}</select></label>
        {model?.colours.length ? <label><span className="mono">Colour</span><select value={f.colour} onChange={(e) => setF({ ...f, colour: e.target.value })}>{model.colours.map((c) => <option key={c}>{c}</option>)}</select></label> : <span />}
        <label><span className="mono">Customer</span><input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} placeholder="Company (empty = for stock)" /></label>
        <label><span className="mono">City</span><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></label>
        <label><span className="mono">Target date</span><input type="date" value={f.targetDate} min={todayStr()} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></label>
        <label><span className="mono">Priority</span><select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
        <label><span className="mono">Website enquiry <small>(optional)</small></span><input value={f.enquiryRef} onChange={(e) => setF({ ...f, enquiryRef: e.target.value })} placeholder="ENQ-12" /></label>
        <span />
        <label className="span2"><span className="mono">Notes</span><textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Tooling, gripper, special requests…" /></label>
        {model && (
          <div className="span2 tmpl">
            <span className="mono muted">Build stages for {f.model} (you can add or remove stages later)</span>
            <ol>{model.stages.map((s) => <li key={s.key}>{s.label}<small>{s.area}</small></li>)}</ol>
          </div>
        )}
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Add unit</button></footer>
      </form>
    </Modal>
  )
}

function UnitDetail({ id, client, user, can, go, people, onBack, onError, notify, onChanged }) {
  const [u, setU] = useState(null)
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(null)
  const [blockNote, setBlockNote] = useState(null)
  const manage = can('production.manage')
  useEffect(() => { client.get(`/units/${id}`).then((r) => setU(r.unit), onError) }, [client, id, onError])

  const patchStage = async (s, body, msg) => {
    try { const r = await client.patch(`/units/${id}/stages/${s.key}`, body); setU((x) => ({ ...r.unit, project: x?.project })); onChanged(); if (msg) notify(msg) } catch (err) { onError(err) }
  }
  const patchUnit = async (body, msg) => {
    try { const r = await client.patch(`/units/${id}`, body); setU((x) => ({ ...r.unit, project: x?.project })); onChanged(); if (msg) notify(msg) } catch (err) { onError(err) }
  }
  const addNote = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    try { const r = await client.post(`/units/${id}/notes`, { text: note }); setU((x) => ({ ...x, notes: [...x.notes, r.note] })); setNote('') } catch (err) { onError(err) }
  }
  if (!u) return <div className="page"><div className="loading">Loading…</div></div>
  const mayChange = (s) => manage || s.assigneeId === user._id
  const timeline = [...u.history.map((h) => ({ ...h, kind: 'h' })), ...u.notes.map((n) => ({ ...n, by: n.author, kind: 'n' }))].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <div className="page unit-page">
      <button className="link-btn back-link" onClick={onBack}><Icon.left />All robots</button>
      <header className="unit-h">
        <div>
          <span className="mono muted">{u.model}{u.colour ? ` · ${u.colour}` : ''} · ordered {u.orderedOn ? fmtDay(u.orderedOn) : '–'}</span>
          <h1>{u.serial} <Priority p={u.priority} /></h1>
          <p className="muted">{u.customer?.company ? `For ${u.customer.company}${u.customer.city ? `, ${u.customer.city}` : ''}` : 'For stock'}{u.enquiryRef ? ` · from ${u.enquiryRef}` : ''}
            {u.project && <> · <button className="link-btn inline" onClick={() => go('projects', { id: u.project._id })}><Icon.folder />{u.project.ref} {u.project.name}</button></>}</p>
        </div>
        <div className="unit-phase">
          <span className={`phase ph-${u.phase}`}>{PHASE_LABEL[u.phase]}</span>
          <b>{u.progress.pct}%</b>
          <small>{u.progress.done} of {u.progress.total} stages</small>
        </div>
      </header>
      {u.onHold && <div className="banner warn"><Icon.pause /><span><b>On hold.</b> {u.holdReason}</span>{manage && <button className="btn sm" onClick={() => patchUnit({ onHold: false }, 'Back in the build')}>Resume</button>}</div>}
      {u.late && <div className="banner bad"><Icon.alert /><span><b>Past its target date</b> ({fmtDay(u.targetDate)}).</span></div>}

      <div className="stepper" role="list" aria-label="Build stages">
        {u.stages.filter((s) => s.state !== 'skipped').map((s, i) => (
          <div key={s.key} role="listitem" className={`step st-${s.state}`}>
            <span className="step-dot">{s.state === 'done' ? <Icon.check /> : i + 1}</span>
            <span className="step-l">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="unit-grid">
        <section className="card">
          <header className="card-h"><h3>Build stages</h3>{manage && <button className="link-btn" onClick={() => setAdding({ label: '', after: u.stages.at(-1)?.key })}><Icon.plus />Add a stage</button>}</header>
          <ol className="stages">
            {u.stages.map((s) => (
              <li key={s.key} className={`stage st-${s.state}`}>
                <button className="stage-tick" disabled={!mayChange(s)} onClick={() => patchStage(s, { state: NEXT_STATE[s.state] }, `${s.label}: ${STATE_LABEL[NEXT_STATE[s.state]].toLowerCase()}`)}
                  aria-label={`${s.label}: ${STATE_LABEL[s.state]}. ${mayChange(s) ? `Mark ${STATE_LABEL[NEXT_STATE[s.state]].toLowerCase()}` : ''}`} title={mayChange(s) ? `Mark ${STATE_LABEL[NEXT_STATE[s.state]].toLowerCase()}` : 'Only the person this stage is given to, or a lead, can change it'}>
                  {s.state === 'done' ? <Icon.check /> : s.state === 'blocked' ? '!' : s.state === 'in_progress' ? <i /> : null}
                </button>
                <div className="stage-main">
                  <b>{s.label}</b>
                  <small>
                    <span className="mono">{s.area}</span>
                    {' · '}{STATE_LABEL[s.state]}
                    {s.state === 'done' && s.doneAt ? ` by ${s.doneBy} ${timeAgo(s.doneAt)}` : ''}
                    {s.state === 'in_progress' && s.startedAt ? ` since ${timeAgo(s.startedAt).replace(' ago', '')}` : ''}
                  </small>
                  {s.note && <p className={s.state === 'blocked' ? 'bad-text' : ''}>{s.note}</p>}
                </div>
                <div className="stage-side">
                  {manage ? (
                    <select value={s.assigneeId || ''} onChange={(e) => patchStage(s, { assigneeId: e.target.value || null })} aria-label={`Who does ${s.label}`}>
                      <option value="">Nobody yet</option>
                      {people.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  ) : s.assignee ? <span className="who-chip"><Avatar name={s.assignee} size={22} />{s.assignee}</span> : <span className="muted small">Nobody yet</span>}
                  {mayChange(s) && (
                    <select className="state-sel" value={s.state} onChange={(e) => (e.target.value === 'blocked' ? setBlockNote({ s, text: s.note || '' }) : patchStage(s, { state: e.target.value }))} aria-label={`State of ${s.label}`}>
                      {Object.entries(STATE_LABEL).filter(([k]) => manage || k !== 'skipped').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  )}
                  {manage && s.state === 'pending' && <button className="icon-btn" title="Remove this stage" aria-label={`Remove ${s.label}`} onClick={() => client.del(`/units/${id}/stages/${s.key}`).then((r) => { setU((x) => ({ ...r.unit, project: x?.project })); onChanged() }, onError)}><Icon.trash /></button>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="unit-side">
          {manage && (
            <section className="card">
              <header className="card-h"><h3>Dates and status</h3></header>
              <div className="form-grid compact">
                <label><span className="mono">Target date</span><input type="date" value={u.targetDate || ''} onChange={(e) => patchUnit({ targetDate: e.target.value }, 'Target date saved')} /></label>
                <label><span className="mono">Priority</span><select value={u.priority} onChange={(e) => patchUnit({ priority: e.target.value })}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
                <label><span className="mono">Dispatched on</span><input type="date" value={u.dispatchedOn || ''} onChange={(e) => patchUnit({ dispatchedOn: e.target.value }, e.target.value ? `${u.serial} marked dispatched` : undefined)} /></label>
                <label><span className="mono">Installed on</span><input type="date" value={u.installedOn || ''} onChange={(e) => patchUnit({ installedOn: e.target.value }, e.target.value ? `${u.serial} marked installed` : undefined)} /></label>
              </div>
              {!u.onHold && <button className="btn sm" onClick={() => setBlockNote({ hold: true, text: '' })}><Icon.pause />Put on hold</button>}
            </section>
          )}
          <section className="card">
            <header className="card-h"><h3>Notes and history</h3></header>
            <form className="note-form" onSubmit={addNote}>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the team…" />
              <button className="btn sm" disabled={!note.trim()}>Add note</button>
            </form>
            <ol className="hist">
              {timeline.map((t, i) => (
                <li key={i} className={t.kind === 'n' ? 'is-note' : ''}>
                  {t.kind === 'n' ? <Avatar name={t.by} size={24} /> : <i className="hist-dot" />}
                  <div><span>{t.kind === 'n' ? <><b>{t.by}</b> {t.text}</> : t.text}</span><small className="muted" title={fmtDateTime(t.at)}>{t.kind === 'h' ? `${t.by} · ` : ''}{timeAgo(t.at)}</small></div>
                </li>
              ))}
            </ol>
          </section>
          {can('production.delete') && <button className="link-btn danger" onClick={() => client.del(`/units/${id}`).then(() => { notify(`${u.serial} deleted`, 'muted'); onChanged(); onBack() }, onError)}><Icon.trash />Delete this unit</button>}
        </div>
      </div>

      {adding && (
        <Modal title="Add a stage" onClose={() => setAdding(null)}>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); client.post(`/units/${id}/stages`, adding).then((r) => { setU((x) => ({ ...r.unit, project: x?.project })); setAdding(null); onChanged() }, onError) }}>
            <label className="span2"><span className="mono">Stage</span><input value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} placeholder="e.g. Gripper fitted" required autoFocus /></label>
            <label className="span2"><span className="mono">After</span><select value={adding.after} onChange={(e) => setAdding({ ...adding, after: e.target.value })}>{u.stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
            <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={() => setAdding(null)}>Cancel</button><button className="btn primary sm">Add</button></footer>
          </form>
        </Modal>
      )}
      {blockNote && (
        <Modal title={blockNote.hold ? `Put ${u.serial} on hold` : `${blockNote.s.label} is blocked`} onClose={() => setBlockNote(null)}>
          <form className="form-grid" onSubmit={(e) => {
            e.preventDefault()
            if (blockNote.hold) patchUnit({ onHold: true, holdReason: blockNote.text }, `${u.serial} is on hold`)
            else patchStage(blockNote.s, { state: 'blocked', note: blockNote.text }, `${blockNote.s.label}: blocked`)
            setBlockNote(null)
          }}>
            <label className="span2"><span className="mono">What is it waiting for?</span><input value={blockNote.text} onChange={(e) => setBlockNote({ ...blockNote, text: e.target.value })} required autoFocus placeholder="e.g. Gearbox delayed by the supplier" /></label>
            <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={() => setBlockNote(null)}>Cancel</button><button className="btn primary sm">Save</button></footer>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default function Production({ client, user, can, params, setParams, go, onError, notify, version }) {
  const [units, setUnits] = useState(null)
  const [summary, setSummary] = useState(null)
  const [templates, setTemplates] = useState(null)
  const [people, setPeople] = useState([])
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState(params.q || '')
  const viewMode = params.view === 'list' ? 'list' : 'board'
  const mine = params.mine === 'true'

  const load = useCallback(() => {
    client.get('/units').then((r) => setUnits(r.units), onError)
    client.get('/units/summary').then(setSummary, onError)
  }, [client, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { client.get('/production/templates').then(setTemplates, onError) }, [client, onError])
  useEffect(() => { if (can('production.manage')) client.get('/users').then((r) => setPeople(r.users.filter((p) => p.role !== 'hr')), onError) }, [client, can, onError])

  const set = (p) => setParams({ ...params, ...p })
  const shown = useMemo(() => (units || []).filter((u) => {
    if (params.model && u.model !== params.model) return false
    if (mine && !u.stages.some((s) => s.assigneeId === user._id && s.state !== 'done' && s.state !== 'skipped')) return false
    if (q) { const t = q.toLowerCase(); if (![u.serial, u.model, u.customer?.company, u.customer?.city, u.enquiryRef].some((x) => String(x || '').toLowerCase().includes(t))) return false }
    return true
  }), [units, params.model, mine, q, user._id])

  if (params.id) {
    return <UnitDetail id={params.id} client={client} user={user} can={can} go={go} people={people} onError={onError} notify={notify} onChanged={load} onBack={() => setParams({ ...params, id: undefined })} />
  }
  const s = summary
  const boardPhases = PHASES.filter(([p]) => p !== 'installed')

  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">Production</span><h1>{s ? <>{s.inProgress} robots <span className="muted">in the build.</span></> : 'Production'}</h1></div>
        {can('production.manage') && <button className="btn primary" onClick={() => setAdding(true)}><Icon.plus />Add a robot</button>}
      </header>

      {s && (
        <div className="kpis six">
          {boardPhases.map(([p, l]) => <button key={p} className="kpi link" onClick={() => set({ view: 'list', phase: p })}><span className="mono muted">{l}</span><b>{s.byPhase[p]}</b></button>)}
          <div className="kpi"><span className="mono muted">Needs attention</span><b className={s.late.length + s.blocked ? 'bad-text' : ''}>{s.late.length + s.blocked}</b><small>{s.late.length} late · {s.blocked} blocked</small></div>
        </div>
      )}

      <div className="toolbar between">
        <div className="toolbar">
          <div className="search small"><Icon.search /><input value={q} onChange={(e) => { setQ(e.target.value); set({ q: e.target.value }) }} placeholder="Serial, customer, ENQ…" aria-label="Search robots" /></div>
          <select className="chip-select" value={params.model || ''} onChange={(e) => set({ model: e.target.value })} aria-label="Model">
            <option value="">All models</option>{templates?.models.map((m) => <option key={m.name}>{m.name}</option>)}
          </select>
          <button className={`chip${mine ? ' on' : ''}`} onClick={() => set({ mine: mine ? undefined : 'true' })}>My stages{s?.myStages.length ? ` (${s.myStages.length})` : ''}</button>
          {params.phase && viewMode === 'list' && <button className="chip clear" onClick={() => set({ phase: undefined })}>{PHASE_LABEL[params.phase]} ✕</button>}
        </div>
        <div className="seg-ctl small" role="radiogroup" aria-label="View">
          <button role="radio" aria-checked={viewMode === 'board'} className={viewMode === 'board' ? 'on tone-new' : 'tone-new'} onClick={() => set({ view: undefined })}><Icon.board />Board</button>
          <button role="radio" aria-checked={viewMode === 'list'} className={viewMode === 'list' ? 'on tone-new' : 'tone-new'} onClick={() => set({ view: 'list' })}><Icon.list />List</button>
        </div>
      </div>

      {!units ? <div className="loading">Loading…</div> : units.length === 0 ? (
        <div className="card empty"><Icon.robot /><b>No robots in the build yet</b><span className="muted">{can('production.manage') ? 'Add the first one with “Add a robot”.' : 'A lead adds robots when an order comes in.'}</span></div>
      ) : viewMode === 'board' ? (
        <div className="kanban">
          {boardPhases.map(([p, l]) => {
            const col = shown.filter((u) => u.phase === p)
            return (
              <section key={p} className="kcol">
                <header><span className={`phase ph-${p}`}>{l}</span><span className="mono muted">{col.length}</span></header>
                <div className="kcards">{col.map((u) => <UnitCard key={u._id} u={u} onOpen={(id) => set({ id })} />)}{!col.length && <p className="muted small kempty">None</p>}</div>
              </section>
            )
          })}
        </div>
      ) : (
        <section className="card flush">
          <table className="tbl units-tbl">
            <thead><tr><th>Serial</th><th>Model</th><th>Customer</th><th>Stages</th><th>Now</th><th>Phase</th><th>Target</th></tr></thead>
            <tbody>
              {shown.filter((u) => !params.phase || u.phase === params.phase).map((u) => (
                <tr key={u._id} className="click" onClick={() => set({ id: u._id })}>
                  <td className="mono"><b>{u.serial}</b> <Priority p={u.priority} /></td>
                  <td>{u.model}{u.colour ? <small className="muted"> · {u.colour}</small> : ''}</td>
                  <td>{u.customer?.company || <span className="muted">Stock</span>}</td>
                  <td><StageStrip stages={u.stages} /><small className="muted mono"> {u.progress.done}/{u.progress.total}</small></td>
                  <td>{u.onHold ? 'On hold' : u.progress.current ? <><i className={`stage-dot st-${u.progress.current.state}`} /> {u.progress.current.label}</> : 'Done'}</td>
                  <td><span className={`phase ph-${u.phase}`}>{PHASE_LABEL[u.phase]}</span></td>
                  <td><Due u={u} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {adding && <NewUnit client={client} templates={templates} onError={onError} onClose={() => setAdding(false)} onDone={(u) => { setAdding(false); notify(`${u.serial} added`); load(); set({ id: u._id }) }} />}
      {go && null}
    </div>
  )
}
