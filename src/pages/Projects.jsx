import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Icon, Modal, fmtDay, fmtDateTime, plural, timeAgo, todayStr } from '../ui'
import { CodeChips, CodeSuggest, EQUIP, EQUIP_SHORT, EQUIP_ST, Marked, PastRobotForm, SeenBefore, SoftwareForm, codesIn, holds, normWord, splitCodes, wordPattern } from '../records'

export const STATUS = { planning: 'Planning', in_progress: 'In progress', commissioning: 'Commissioning', live: 'Live', on_hold: 'On hold', closed: 'Closed' }
const STATUS_TONE = { planning: 'muted', in_progress: 'new', commissioning: 'progress', live: 'good', on_hold: 'bad', closed: 'muted' }
const ISSUE = { open: 'Open', investigating: 'Investigating', workaround: 'Workaround', solved: 'Solved' }
const ISSUE_TONE = { open: 'bad', investigating: 'progress', workaround: 'progress', solved: 'good' }
const SEV = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
const CAT = { mechanical: 'Mechanical', electrical: 'Electrical', software: 'Software', communication: 'Communication / EtherCAT', gripper_tooling: 'Gripper / tooling', safety: 'Safety', process: 'Process / quality', customer_side: 'Customer side', other: 'Other' }
export const PHASE = { planned: 'Planned', in_build: 'In build', testing: 'Testing', ready: 'Ready to ship', dispatched: 'Dispatched', installed: 'Installed' }
const OPEN = ['open', 'investigating', 'workaround']

const Pill = ({ tone, children }) => <span className={`pill tone-${tone}`}><i />{children}</span>
export const ProjectStatus = ({ s }) => <Pill tone={STATUS_TONE[s] || 'muted'}>{STATUS[s] || s}</Pill>
const IssueStatus = ({ s }) => <Pill tone={ISSUE_TONE[s] || 'muted'}>{ISSUE[s] || s}</Pill>
const Sev = ({ s }) => (s && s !== 'medium' ? <span className={`sev sev-${s}`}>{SEV[s]}</span> : null)

/** The part of a long text around the first searched word. */
function around(text, words, len = 220) {
  if (!text) return ''
  const t = text.toLowerCase()
  const at = Math.min(...(words || []).map((w) => { const m = new RegExp(wordPattern(w), 'i').exec(t); return m ? m.index : -1 }).filter((x) => x >= 0), Infinity)
  if (!Number.isFinite(at) || text.length <= len) return text.length > len ? `${text.slice(0, len)}…` : text
  const from = Math.max(0, at - 70)
  return `${from ? '…' : ''}${text.slice(from, from + len)}${from + len < text.length ? '…' : ''}`
}
const matches = (text, words) => !!text && words.some((w) => holds(text, w))
/** Tags for what a problem is about: the part, the equipment, the software it ran. */
function ProblemTags({ e, words }) {
  return (
    <>
      <CodeChips codes={e.errorCodes} words={words} />
      {e.component && <span className="tag"><Marked text={e.component} words={words} /></span>}
      {e.equipmentName && <span className="tag eq-tag"><Icon.factory /><Marked text={e.equipmentName} words={words} /></span>}
      {e.serial && <span className="tag mono">{e.serial}</span>}
      {e.softwareVersion && <span className="tag mono sw-tag" title="Software on the robot when it happened">v{e.softwareVersion}</span>}
    </>
  )
}

// ── forms ──────────────────────────────────────────────────────
/** New or edited project. Its client is picked from the list, or typed to make a new one. */
export function ProjectForm({ client, project, people, presetClientId, onClose, onSaved, onError }) {
  const c = project?.customer || {}
  const [clients, setClients] = useState(null)
  const [f, setF] = useState({
    name: project?.name || '', status: project?.status || 'planning', application: project?.application || '', enquiryRef: project?.enquiryRef || '',
    startDate: project?.startDate || todayStr(), goLiveDate: project?.goLiveDate || '', closedOn: project?.closedOn || '', description: project?.description || '', tags: (project?.tags || []).join(', '),
    clientId: project ? project.clientId || (c.company ? '__new' : '') : presetClientId || '', newClient: project && !project.clientId ? c.company || '' : '',
    city: c.city || '', site: c.site || '', contactName: c.contactName || '', contactPhone: c.contactPhone || '', contactEmail: c.contactEmail || '',
    team: (project?.team || []).map((m) => ({ userId: m.userId, role: m.role })),
  })
  useEffect(() => { client.get('/clients').then((r) => setClients(r.clients), () => setClients([])) }, [client])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const picked = clients?.find((x) => x._id === f.clientId)
  const past = f.status === 'live' || f.status === 'closed'
  const save = async (e) => {
    e.preventDefault()
    const company = f.clientId === '__new' ? f.newClient.trim() : picked?.name || ''
    const body = {
      name: f.name, status: f.status, application: f.application, enquiryRef: f.enquiryRef, startDate: f.startDate, goLiveDate: f.goLiveDate, description: f.description, tags: f.tags,
      closedOn: f.status === 'closed' ? f.closedOn || f.goLiveDate || todayStr() : undefined,
      clientId: f.clientId && f.clientId !== '__new' ? f.clientId : '',
      customer: { company, city: f.city || picked?.city || '', site: f.site, contactName: f.contactName, contactPhone: f.contactPhone, contactEmail: f.contactEmail },
      team: f.team.filter((m) => m.userId),
    }
    try { const r = project ? await client.patch(`/projects/${project._id}`, body) : await client.post('/projects', body); onSaved(r.project) } catch (err) { onError(err) }
  }
  const setMember = (i, k, v) => setF({ ...f, team: f.team.map((m, j) => (j === i ? { ...m, [k]: v } : m)) })
  return (
    <Modal title={project ? `Edit ${project.ref}` : 'New project'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label className="span2"><span className="mono">Project name</span><input value={f.name} onChange={set('name')} required autoFocus placeholder="e.g. CNC machine tending cell" /></label>
        <label><span className="mono">Client</span>
          <select value={f.clientId} onChange={(e) => { const v = e.target.value; const x = clients?.find((k) => k._id === v); setF({ ...f, clientId: v, city: x?.city || f.city }) }}>
            <option value="">Internal (no client)</option>
            {(clients || []).map((x) => <option key={x._id} value={x._id}>{x.name}{x.city ? `, ${x.city}` : ''}</option>)}
            <option value="__new">+ A new client…</option>
          </select>
        </label>
        {f.clientId === '__new' ? <label><span className="mono">New client’s name</span><input value={f.newClient} onChange={set('newClient')} required placeholder="Company name" /></label>
          : <label><span className="mono">City</span><input value={f.city} onChange={set('city')} /></label>}
        {f.clientId === '__new' && <label><span className="mono">City</span><input value={f.city} onChange={set('city')} /></label>}
        <label className={f.clientId === '__new' ? '' : 'span2'}><span className="mono">Site address</span><input value={f.site} onChange={set('site')} placeholder="Where the robots are installed" /></label>
        <label><span className="mono">Contact person at the site</span><input value={f.contactName} onChange={set('contactName')} /></label>
        <label><span className="mono">Contact phone</span><input value={f.contactPhone} onChange={set('contactPhone')} /></label>
        <label><span className="mono">Contact email</span><input type="email" value={f.contactEmail} onChange={set('contactEmail')} /></label>
        <label><span className="mono">Website enquiry <small>(optional)</small></span><input value={f.enquiryRef} onChange={set('enquiryRef')} placeholder="ENQ-12" /></label>
        <label><span className="mono">Application</span><input value={f.application} onChange={set('application')} placeholder="Machine tending, welding, palletising…" /></label>
        <label><span className="mono">Status</span><select value={f.status} onChange={set('status')}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="mono">Started</span><input type="date" value={f.startDate} onChange={set('startDate')} /></label>
        <label><span className="mono">Go-live</span><input type="date" value={f.goLiveDate} onChange={set('goLiveDate')} /></label>
        {f.status === 'closed' && <label><span className="mono">Closed on</span><input type="date" value={f.closedOn} onChange={set('closedOn')} /></label>}
        {!project && <p className="span2 hint-line">{past ? 'A project done before the hub: after saving, add its robots with “Add a robot already on site” and the software each one runs.' : 'For a project done before the hub, pick Live or Closed and give its real dates.'}</p>}
        <label className="span2"><span className="mono">What the project is</span><textarea rows={3} value={f.description} onChange={set('description')} placeholder="Robots, cell layout, cycle time, anything the next engineer should know" /></label>
        <label className="span2"><span className="mono">Tags <small>(comma separated, help search)</small></span><input value={f.tags} onChange={set('tags')} placeholder="welding, ethercat, vision" /></label>
        <div className="span2 team-edit">
          <span className="mono muted">Team</span>
          {f.team.map((m, i) => (
            <div key={i} className="team-row">
              <select value={m.userId} onChange={(e) => setMember(i, 'userId', e.target.value)} aria-label="Person"><option value="">Pick a person</option>{people.map((p) => <option key={p._id} value={p._id}>{p.name}{p.team ? ` · ${p.team}` : ''}</option>)}</select>
              <input value={m.role} onChange={(e) => setMember(i, 'role', e.target.value)} placeholder="Role on this project, e.g. Site engineer" aria-label="Role on the project" />
              <button type="button" className="icon-btn" onClick={() => setF({ ...f, team: f.team.filter((_, j) => j !== i) })} aria-label="Remove from the team"><Icon.close /></button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setF({ ...f, team: [...f.team, { userId: '', role: '' }] })}><Icon.plus />Add someone</button>
        </div>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">{project ? 'Save' : 'Create project'}</button></footer>
      </form>
    </Modal>
  )
}

/** Conveyors, SPMs, grippers and the rest of the cell around the robots. */
function EquipmentForm({ client, project, item, onClose, onSaved, onError }) {
  const [f, setF] = useState({ kind: item?.kind || 'conveyor', name: item?.name || '', make: item?.make || '', model: item?.model || '', serial: item?.serial || '', supplier: item?.supplier || '', status: item?.status || 'installed', installedOn: item?.installedOn || '', notes: item?.notes || '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    try {
      const r = item ? await client.patch(`/projects/${project._id}/equipment/${item._id}`, f) : await client.post(`/projects/${project._id}/equipment`, f)
      onSaved(r.equipment)
    } catch (err) { onError(err) }
  }
  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add equipment to the cell'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label><span className="mono">Kind</span><select value={f.kind} onChange={set('kind')}>{Object.entries(EQUIP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="mono">Name</span><input value={f.name} onChange={set('name')} required autoFocus placeholder={f.kind === 'spm' ? 'e.g. Deburring SPM' : f.kind === 'conveyor' ? 'e.g. Infeed conveyor' : 'What the team calls it'} /></label>
        <label><span className="mono">Make</span><input value={f.make} onChange={set('make')} placeholder="Manufacturer, or Nextup if we built it" /></label>
        <label><span className="mono">Model</span><input value={f.model} onChange={set('model')} /></label>
        <label><span className="mono">Serial number</span><input value={f.serial} onChange={set('serial')} /></label>
        <label><span className="mono">Supplier</span><input value={f.supplier} onChange={set('supplier')} placeholder="Who to call for spares" /></label>
        <label><span className="mono">Status</span><select value={f.status} onChange={set('status')}>{Object.entries(EQUIP_ST).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="mono">Installed on</span><input type="date" value={f.installedOn} onChange={set('installedOn')} /></label>
        <label className="span2"><span className="mono">Notes</span><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Belt width, drives, PLC signals to the robot, settings…" /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">{item ? 'Save' : 'Add'}</button></footer>
      </form>
    </Modal>
  )
}

const blankProblem = () => ({ title: '', solution: '', rootCause: '', status: 'solved', category: 'other', severity: 'medium', unitId: '', equipmentId: '', errorCodes: '', component: '', softwareVersion: '' })
const problemBody = (p) => ({ ...p, unitId: p.unitId || undefined, equipmentId: p.equipmentId || undefined, errorCodes: splitCodes(p.errorCodes), softwareVersion: p.softwareVersion || undefined })

/** The fields that make a problem findable later: error codes, the part, the equipment, the software. */
function ProblemWhat({ f, setField, units, equipment, text }) {
  const unit = units.find((u) => u._id === f.unitId)
  return (
    <>
      <label><span className="mono">Error / alarm codes</span><input value={f.errorCodes} onChange={(e) => setField('errorCodes', e.target.value)} placeholder="E131, AL-21" /></label>
      <label><span className="mono">Part or component</span><input value={f.component} onChange={(e) => setField('component', e.target.value)} placeholder="Servo drive J3, gripper finger…" /></label>
      <CodeSuggest text={text} value={f.errorCodes} onAdd={(c) => setField('errorCodes', [...splitCodes(f.errorCodes), c].join(', '))} />
      <label><span className="mono">Robot</span><select value={f.unitId} onChange={(e) => setField('unitId', e.target.value)}><option value="">Not one robot</option>{units.map((u) => <option key={u._id} value={u._id}>{u.serial} · {u.model}{u.software?.version ? ` · v${u.software.version}` : ''}</option>)}</select></label>
      <label><span className="mono">Equipment</span><select value={f.equipmentId} onChange={(e) => setField('equipmentId', e.target.value)} disabled={!equipment.length}><option value="">{equipment.length ? 'Not the equipment' : 'No equipment listed'}</option>{equipment.map((q) => <option key={q._id} value={q._id}>{EQUIP_SHORT[q.kind]} · {q.name}</option>)}</select></label>
      <label><span className="mono">Software version <small>(when it happened)</small></span><input value={f.softwareVersion} onChange={(e) => setField('softwareVersion', e.target.value)} placeholder={unit?.software?.version ? `${unit.software.version} (the robot’s now)` : '3.4.2'} /></label>
    </>
  )
}

function VisitForm({ client, project, units, people, user, visit, onClose, onSaved, onError }) {
  const team = project.team.map((m) => m.userId)
  const equipment = (project.equipment || []).filter((q) => q.status !== 'removed')
  const [f, setF] = useState(visit
    ? { date: visit.date, hours: visit.hours ?? '', purpose: visit.purpose || '', workDone: visit.workDone || '', nextSteps: visit.nextSteps || '', engineers: (visit.engineers || []).map((x) => x.userId), problems: [] }
    : { date: todayStr(), hours: '', purpose: '', workDone: '', nextSteps: '', engineers: [user._id], problems: [blankProblem()] })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setPr = (i, k, v) => setF((x) => ({ ...x, problems: x.problems.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }))
  const toggle = (id) => setF({ ...f, engineers: f.engineers.includes(id) ? f.engineers.filter((x) => x !== id) : [...f.engineers, id] })
  const ordered = [...people].sort((a, b) => (team.includes(b._id) ? 1 : 0) - (team.includes(a._id) ? 1 : 0))
  const save = async (e) => {
    e.preventDefault()
    const body = { date: f.date, hours: f.hours === '' ? null : Number(f.hours), purpose: f.purpose, workDone: f.workDone, nextSteps: f.nextSteps, engineers: f.engineers }
    try {
      if (visit) { const r = await client.patch(`/project-entries/${visit._id}`, body); onSaved(r.entry, []) } else {
        const r = await client.post(`/projects/${project._id}/entries`, { kind: 'visit', ...body, problems: f.problems.filter((p) => p.title.trim()).map(problemBody) })
        onSaved(r.entry, r.problems)
      }
    } catch (err) { onError(err) }
  }
  return (
    <Modal title={visit ? 'Edit site visit' : `Log a site visit · ${project.name}`} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label><span className="mono">Date of the visit</span><input type="date" value={f.date} onChange={set('date')} required max={todayStr()} /></label>
        <label><span className="mono">Hours on site</span><input type="number" min="0" step="0.5" value={f.hours} onChange={set('hours')} placeholder="8" /></label>
        <div className="span2 who-pick">
          <span className="mono muted">Who went</span>
          <div>{ordered.map((p) => <button type="button" key={p._id} className={`chip${f.engineers.includes(p._id) ? ' on' : ''}`} onClick={() => toggle(p._id)}>{p.name}</button>)}</div>
        </div>
        <label className="span2"><span className="mono">Why you went</span><input value={f.purpose} onChange={set('purpose')} placeholder="Installation, service call, training…" /></label>
        <label className="span2"><span className="mono">What was done</span><textarea rows={3} value={f.workDone} onChange={set('workDone')} placeholder="Work done today, readings, settings changed" /></label>
        {!visit && (
          <div className="span2 problems-edit">
            <span className="mono muted">Problems found today, and how they were solved</span>
            {f.problems.map((p, i) => (
              <div key={i} className="pr-row">
                <div className="pr-head">
                  <b className="mono">{i + 1}</b>
                  <input value={p.title} onChange={(e) => setPr(i, 'title', e.target.value)} placeholder="The problem, e.g. E131: J3 drive drops off the EtherCAT bus" aria-label="Problem" />
                  <button type="button" className="icon-btn" onClick={() => setF({ ...f, problems: f.problems.filter((_, j) => j !== i) })} aria-label="Remove this problem"><Icon.close /></button>
                </div>
                <SeenBefore client={client} text={[p.title, p.errorCodes, p.component].join(' ')} />
                <div className="form-grid compact">
                  <ProblemWhat f={p} setField={(k, v) => setPr(i, k, v)} units={units} equipment={equipment} text={`${p.title} ${p.solution} ${p.rootCause}`} />
                  <label className="span2"><span className="mono">How it was solved</span><textarea rows={2} value={p.solution} onChange={(e) => setPr(i, 'solution', e.target.value)} placeholder="What fixed it, so the next person can do the same. Leave empty if it is still open." /></label>
                  <label className="span2"><span className="mono">Cause <small>(if known)</small></span><input value={p.rootCause} onChange={(e) => setPr(i, 'rootCause', e.target.value)} /></label>
                  <label><span className="mono">Status</span><select value={p.status} onChange={(e) => setPr(i, 'status', e.target.value)}>{Object.entries(ISSUE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label><span className="mono">Type</span><select value={p.category} onChange={(e) => setPr(i, 'category', e.target.value)}>{Object.entries(CAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label><span className="mono">How bad</span><select value={p.severity} onChange={(e) => setPr(i, 'severity', e.target.value)}>{Object.entries(SEV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                </div>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => setF({ ...f, problems: [...f.problems, blankProblem()] })}><Icon.plus />Another problem</button>
          </div>
        )}
        <label className="span2"><span className="mono">Next steps</span><input value={f.nextSteps} onChange={set('nextSteps')} placeholder="What is left for the next visit" /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">{visit ? 'Save' : 'Save the visit'}</button></footer>
      </form>
    </Modal>
  )
}

function IssueForm({ client, project, units, issue, solveOnly, onClose, onSaved, onError }) {
  const equipment = (project.equipment || []).filter((q) => q.status !== 'removed' || q._id === issue?.equipmentId)
  const [f, setF] = useState(issue
    ? { title: issue.title, description: issue.description || '', category: issue.category, severity: issue.severity, unitId: issue.unitId || '', equipmentId: issue.equipmentId || '', errorCodes: (issue.errorCodes || []).join(', '), component: issue.component || '', softwareVersion: issue.softwareVersion || '', foundOn: issue.foundOn || '', status: solveOnly && issue.status !== 'solved' ? 'solved' : issue.status, rootCause: issue.rootCause || '', solution: issue.solution || '' }
    : { title: '', description: '', category: 'other', severity: 'medium', unitId: '', equipmentId: '', errorCodes: '', component: '', softwareVersion: '', foundOn: todayStr(), status: 'open', rootCause: '', solution: '' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setField = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const save = async (e) => {
    e.preventDefault()
    const body = solveOnly ? { status: f.status, rootCause: f.rootCause, solution: f.solution } : { ...problemBody(f), unitId: f.unitId || null, equipmentId: f.equipmentId || null, softwareVersion: f.softwareVersion }
    // A new problem without a typed version takes the robot's, on the hub.
    if (!issue && !f.softwareVersion) delete body.softwareVersion
    try {
      const r = issue ? await client.patch(`/project-entries/${issue._id}`, body) : await client.post(`/projects/${project._id}/entries`, { kind: 'issue', ...body })
      onSaved(r.entry)
    } catch (err) { onError(err) }
  }
  return (
    <Modal title={solveOnly ? `${issue.ref}: how was it solved?` : issue ? `Edit ${issue.ref}` : 'Log a problem'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        {solveOnly ? <p className="span2 solve-q"><b>{issue.title}</b> <CodeChips codes={issue.errorCodes} /></p> : (
          <>
            <label className="span2"><span className="mono">The problem</span><input value={f.title} onChange={set('title')} required autoFocus placeholder="One line someone would search for, e.g. E131: J3 drive drops off EtherCAT" /></label>
            <div className="span2"><SeenBefore client={client} text={[f.title, f.errorCodes, f.component, f.description.slice(0, 200)].join(' ')} exclude={issue?._id} /></div>
            <label className="span2"><span className="mono">Details</span><textarea rows={3} value={f.description} onChange={set('description')} placeholder="When it happens, the exact error text, what was tried" /></label>
            <ProblemWhat f={f} setField={setField} units={units} equipment={equipment} text={`${f.title} ${f.description} ${f.solution}`} />
            <label><span className="mono">Type</span><select value={f.category} onChange={set('category')}>{Object.entries(CAT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label><span className="mono">How bad</span><select value={f.severity} onChange={set('severity')}>{Object.entries(SEV).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label><span className="mono">Found on</span><input type="date" value={f.foundOn} onChange={set('foundOn')} /></label>
          </>
        )}
        <label><span className="mono">Status</span><select value={f.status} onChange={set('status')}>{Object.entries(ISSUE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        {solveOnly && <span />}
        <label className="span2"><span className="mono">Cause</span><textarea rows={2} value={f.rootCause} onChange={set('rootCause')} placeholder="Why it happened, if known" autoFocus={solveOnly} /></label>
        <label className="span2"><span className="mono">Solution</span><textarea rows={3} value={f.solution} onChange={set('solution')} placeholder="What fixed it, step by step, so the next person can do the same" /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Save</button></footer>
      </form>
    </Modal>
  )
}

// ── record items ───────────────────────────────────────────────
function ProblemCard({ e, open, onToggle, words, can, onSolve, onEdit, onDelete, onUpdate, visitDate }) {
  const [text, setText] = useState('')
  return (
    <article className={`prob${open ? ' open' : ''} st-${e.status}`} id={`e-${e._id}`}>
      <button className="prob-h" onClick={onToggle} aria-expanded={open}>
        <span className="prob-ico"><Icon.wrench /></span>
        <span className="prob-main">
          <span className="prob-top"><span className="mono muted">{e.ref}</span><b><Marked text={e.title} words={words} /></b></span>
          <span className="row-meta"><IssueStatus s={e.status} /><Sev s={e.severity} /><ProblemTags e={e} words={words} /><span className="tag ghost">{CAT[e.category] || e.category}</span><span className="muted small">Found {fmtDay(e.foundOn || e.createdAt.slice(0, 10))}{e.createdBy ? ` by ${e.createdBy}` : ''}</span></span>
          {!open && e.solution && <span className="prob-sol-line"><Icon.check /><Marked text={around(e.solution, words || [], 140)} words={words} /></span>}
        </span>
        <span className="prob-chev">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="prob-body">
          {e.description && <p className="pre"><Marked text={e.description} words={words} /></p>}
          <dl className="prob-dl">
            <div><dt>Cause</dt><dd>{e.rootCause ? <Marked text={e.rootCause} words={words} /> : <span className="dim">Not known yet</span>}</dd></div>
            <div className={e.solution ? 'sol' : ''}><dt>Solution</dt><dd>{e.solution ? <span className="pre"><Marked text={e.solution} words={words} /></span> : <span className="dim">Not solved yet</span>}{e.status === 'solved' && e.solvedBy && <small className="block muted">Solved by {e.solvedBy}{e.solvedOn ? ` on ${fmtDay(e.solvedOn)}` : ''}</small>}</dd></div>
            {visitDate && <div><dt>Found on</dt><dd>Site visit of {fmtDay(visitDate)}</dd></div>}
          </dl>
          {e.updates?.length > 0 && (
            <ol className="hist small-hist">{e.updates.map((u, i) => <li key={i}><i className="hist-dot" /><div><span><b>{u.by}</b> {u.status ? <>marked it <b>{ISSUE[u.status]?.toLowerCase()}</b></> : <Marked text={u.text} words={words} />}</span><small className="muted" title={fmtDateTime(u.at)}>{timeAgo(u.at)}</small></div></li>)}</ol>
          )}
          {can('projects.log') && (
            <div className="prob-actions">
              <form className="note-form inline" onSubmit={(ev) => { ev.preventDefault(); if (text.trim()) { onUpdate(text); setText('') } }}>
                <input value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Add an update: what you tried, what you found" aria-label="Update" />
                <button className="btn sm" disabled={!text.trim()}>Add</button>
              </form>
              <span className="grow" />
              {e.status !== 'solved' ? <button className="btn primary sm" onClick={onSolve}><Icon.check />Write the solution</button> : <button className="btn sm" onClick={onSolve}>Change the solution</button>}
              {e.canEdit && <button className="icon-btn" onClick={onEdit} aria-label="Edit" title="Edit"><Icon.edit /></button>}
              {e.canEdit && <button className="icon-btn" onClick={onDelete} aria-label="Delete" title="Delete"><Icon.trash /></button>}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function VisitCard({ v, problems, words, onOpenProblem, onEdit, onDelete }) {
  return (
    <article className="visit" id={`e-${v._id}`}>
      <div className="visit-date"><b>{fmtDay(v.date, { day: 'numeric' })}</b><span className="mono">{fmtDay(v.date, { month: 'short', year: 'numeric' })}</span></div>
      <div className="visit-main">
        <header>
          <div>
            <b className="visit-title"><Marked text={v.purpose || 'Site visit'} words={words} /></b>
            <span className="visit-who">{(v.engineers || []).map((x) => <span key={x.userId} className="who-chip"><Avatar name={x.name} size={20} />{x.name}</span>)}{v.hours ? <span className="muted small">{v.hours} h on site</span> : null}</span>
          </div>
          {v.canEdit && <span className="visit-tools"><button className="icon-btn" onClick={onEdit} aria-label="Edit visit" title="Edit"><Icon.edit /></button><button className="icon-btn" onClick={onDelete} aria-label="Delete visit" title="Delete"><Icon.trash /></button></span>}
        </header>
        {v.workDone && <p className="pre"><Marked text={v.workDone} words={words} /></p>}
        {problems.length > 0 && (
          <ul className="visit-probs">
            {problems.map((p) => (
              <li key={p._id} className={`st-${p.status}`}>
                <button onClick={() => onOpenProblem(p._id)}>
                  <span className="vp-top"><IssueStatus s={p.status} /><b><Marked text={p.title} words={words} /></b></span>
                  {p.solution ? <span className="vp-sol"><Icon.check /><Marked text={p.solution} words={words} /></span> : <span className="vp-sol dim">No solution yet</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {v.nextSteps && <p className="next"><span className="mono muted">Next</span> <Marked text={v.nextSteps} words={words} /></p>}
      </div>
    </article>
  )
}

// ── one project ────────────────────────────────────────────────
function ProjectPage({ id, client, user, can, params, setParams, go, people, onError, notify, onBack, version }) {
  const [data, setData] = useState(null)
  const [freeUnits, setFreeUnits] = useState([])
  const [form, setForm] = useState(null)
  const [openIds, setOpenIds] = useState(() => new Set(params.e ? [params.e] : []))
  const [noteText, setNoteText] = useState('')
  const [issueFilter, setIssueFilter] = useState('all')
  const [pq, setPq] = useState('')
  const tab = params.tab || 'overview'
  const manage = can('projects.manage')

  const load = useCallback(() => client.get(`/projects/${id}`).then(setData, onError), [client, id, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { if (manage && can('production.view')) client.get('/units', { project: 'none' }).then((r) => setFreeUnits(r.units), () => {}) }, [client, manage, can, data?.units?.length])
  // Opening a project from search: go to the item.
  useEffect(() => {
    if (!params.e || !data) return
    const t = setTimeout(() => document.getElementById(`e-${params.e}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
    return () => clearTimeout(t)
  }, [params.e, data, tab])

  const setTab = (t) => setParams({ id, tab: t === 'overview' ? undefined : t })
  const words = useMemo(() => [...new Set(pq.trim().toLowerCase().split(/[\s,;]+/).filter(Boolean).map(normWord))], [pq])
  if (!data) return <div className="page"><div className="loading">Loading…</div></div>
  const { project: p, units, entries, counts, client: cl } = data
  const equipment = p.equipment || []
  const issues = entries.filter((e) => e.kind === 'issue')
  const visits = entries.filter((e) => e.kind === 'visit').sort((a, b) => (a.date < b.date ? 1 : -1))
  const notes = entries.filter((e) => e.kind === 'note')
  const byId = new Map(entries.map((e) => [e._id, e]))
  const toggle = (eid) => setOpenIds((s) => { const n = new Set(s); if (n.has(eid)) n.delete(eid); else n.add(eid); return n })
  const openProblem = (eid) => { setOpenIds((s) => new Set([...s, eid])); setParams({ id, tab: 'problems', e: eid }) }
  const replaceEntry = (en) => setData((d) => ({ ...d, entries: d.entries.map((x) => (x._id === en._id ? en : x)) }))
  const del = async (en) => {
    try { await client.del(`/project-entries/${en._id}`); notify('Deleted', 'muted'); load() } catch (err) { onError(err) }
  }
  const textOfEntry = (e) => { const t = [e.ref, e.title, e.description, e.rootCause, e.solution, e.purpose, e.workDone, e.nextSteps, e.text, e.serial, e.component, e.equipmentName, e.softwareVersion, ...(e.errorCodes || []), ...(e.updates || []).map((u) => u.text)].join(' '); return `${t} ${[...codesIn(t).keys()].join(' ')}` }
  const hit = (e) => !words.length || words.every((w) => holds(textOfEntry(e), w))
  const shownIssues = issues.filter((e) => (issueFilter === 'all' || (issueFilter === 'open' ? OPEN.includes(e.status) : e.status === issueFilter)) && hit(e))
    .sort((a, b) => (OPEN.includes(a.status) === OPEN.includes(b.status) ? (a.foundOn < b.foundOn ? 1 : -1) : OPEN.includes(a.status) ? -1 : 1))
  const c = p.customer || {}
  const addUnit = async (unitId) => {
    if (!unitId) return
    try { await client.put(`/projects/${id}/units/${unitId}`); notify('Robot added to the project'); load() } catch (err) { onError(err) }
  }
  const removeUnit = async (u) => {
    try { await client.del(`/projects/${id}/units/${u._id}`); notify(`${u.serial} taken off the project`, 'muted'); load() } catch (err) { onError(err) }
  }

  return (
    <div className="page project-page">
      <button className="link-btn back-link" onClick={onBack}><Icon.left />All projects</button>
      <header className="unit-h">
        <div>
          <span className="mono muted">{p.ref}{p.application ? ` · ${p.application}` : ''}</span>
          <h1>{p.name}</h1>
          <p className="muted">{cl && can('clients.view') ? <button className="link-btn inline" onClick={() => go('clients', { id: cl._id })}><Icon.building />{cl.name}</button> : c.company || 'Internal'}{c.city ? `, ${c.city}` : ''}{p.goLiveDate ? ` · go-live ${fmtDay(p.goLiveDate)}` : ''}</p>
        </div>
        <div className="proj-h-side">
          <ProjectStatus s={p.status} />
          {manage && <button className="btn sm" onClick={() => setForm({ type: 'project' })}><Icon.edit />Edit</button>}
        </div>
      </header>

      <div className="proj-stats">
        <div><b>{counts.robots}</b><span>{counts.robots === 1 ? 'robot' : 'robots'}</span></div>
        <div><b>{equipment.length}</b><span>{equipment.length === 1 ? 'piece' : 'pieces'} of equipment</span></div>
        <div className={counts.openIssues ? 'hot' : ''}><b>{counts.openIssues}</b><span>open {counts.openIssues === 1 ? 'problem' : 'problems'}</span></div>
        <div><b>{counts.issues - counts.openIssues}</b><span>solved</span></div>
        <div><b>{counts.visits}</b><span>site {counts.visits === 1 ? 'visit' : 'visits'}{counts.lastVisit ? `, last ${fmtDay(counts.lastVisit, { day: 'numeric', month: 'short' })}` : ''}</span></div>
      </div>

      <div className="toolbar between proj-bar">
        <div className="subtabs inline" role="tablist">
          {[['overview', 'Overview'], ['problems', `Problems${issues.length ? ` · ${issues.length}` : ''}`], ['visits', `Site visits${visits.length ? ` · ${visits.length}` : ''}`], ['notes', `Notes${notes.length ? ` · ${notes.length}` : ''}`]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="toolbar">
          {tab !== 'overview' && <div className="search small"><Icon.search /><input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search this project" aria-label="Search this project" /></div>}
          {can('projects.log') && <button className="btn sm" onClick={() => setForm({ type: 'issue' })}><Icon.wrench />Log a problem</button>}
          {can('projects.log') && <button className="btn primary sm" onClick={() => setForm({ type: 'visit' })}><Icon.pin />Log a site visit</button>}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="unit-grid proj-grid">
          <div className="proj-col">
            <section className="card">
              <header className="card-h"><h3><Icon.robot />Robots on this project</h3>{manage && can('production.manage') && <button className="link-btn" onClick={() => setForm({ type: 'pastRobot' })}><Icon.plus />Add a robot already on site</button>}</header>
              {units.length === 0 ? <p className="empty-s">No robots yet.{manage ? ' Add one from the build list below, or one that is already on site.' : ''}</p> : (
                <ul className="proj-units">
                  {units.map((u) => {
                    const n = issues.filter((e) => e.unitId === u._id && OPEN.includes(e.status)).length
                    return (
                      <li key={u._id}>
                        <button className="pu-main" onClick={() => can('production.view') && go('production', { id: u._id })}>
                          <b className="mono">{u.serial}</b><span>{u.model}{u.colour ? ` · ${u.colour}` : ''}{u.installedOn ? ` · installed ${fmtDay(u.installedOn, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                        </button>
                        <span className="pu-sw" title={u.software?.since ? `Since ${fmtDay(u.software.since)}` : 'No version recorded'}>{u.software?.version ? <span className="tag mono sw-tag">v{u.software.version}</span> : <span className="dim small">No version</span>}</span>
                        <span className={`phase ph-${u.phase}`}>{PHASE[u.phase]}</span>
                        {n ? <span className="bad-text small">{plural(n, 'open problem')}</span> : <span className="muted small mono">{u.progress.done}/{u.progress.total}</span>}
                        <span className="pu-tools">
                          {(can('production.manage') || can('projects.log')) && <button className="icon-btn" onClick={() => setForm({ type: 'software', unit: u })} aria-label={`Software on ${u.serial}`} title="Update the software version"><Icon.refresh /></button>}
                          {manage && <button className="icon-btn" onClick={() => removeUnit(u)} aria-label={`Take ${u.serial} off this project`} title="Take off this project"><Icon.close /></button>}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
              {manage && (
                <div className="form-grid compact add-unit">
                  <label className="span2"><span className="mono">Add a robot from the build list</span>
                    <select value="" onChange={(e) => addUnit(e.target.value)}>
                      <option value="">{freeUnits.length ? 'Pick a robot…' : 'No robots without a project'}</option>
                      {freeUnits.map((u) => <option key={u._id} value={u._id}>{u.serial} · {u.model}{u.customer?.company ? ` · ${u.customer.company}` : ''} · {PHASE[u.phase]}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </section>

            <section className="card">
              <header className="card-h"><h3><Icon.factory />Equipment in the cell</h3>{manage && <button className="link-btn" onClick={() => setForm({ type: 'equipment' })}><Icon.plus />Add equipment</button>}</header>
              {equipment.length === 0 ? <p className="empty-s">Nothing listed. {manage ? 'Add conveyors, SPMs, grippers, vision, safety and panels, so problems can be logged against them.' : ''}</p> : (
                <ul className="equip-list">
                  {equipment.map((q) => {
                    const n = issues.filter((e) => e.equipmentId === q._id && OPEN.includes(e.status)).length
                    return (
                      <li key={q._id} className={q.status === 'removed' ? 'gone' : ''}>
                        <span className={`eq-kind k-${q.kind}`}>{EQUIP_SHORT[q.kind] || q.kind}</span>
                        <span className="eq-main"><b>{q.name}</b><small>{[q.make, q.model, q.serial && `S/N ${q.serial}`].filter(Boolean).join(' · ') || 'No make or model yet'}{q.supplier ? ` · from ${q.supplier}` : ''}</small>{q.notes && <small className="eq-notes">{q.notes}</small>}</span>
                        <span className="eq-side">{n ? <span className="bad-text small">{plural(n, 'open problem')}</span> : q.status !== 'installed' ? <span className="muted small">{EQUIP_ST[q.status]}</span> : q.installedOn ? <span className="muted small">{fmtDay(q.installedOn, { day: 'numeric', month: 'short', year: 'numeric' })}</span> : null}</span>
                        {manage ? <span className="pu-tools"><button className="icon-btn" onClick={() => setForm({ type: 'equipment', item: q })} aria-label={`Edit ${q.name}`} title="Edit"><Icon.edit /></button><button className="icon-btn" onClick={() => client.del(`/projects/${id}/equipment/${q._id}`).then(() => { notify(`${q.name} removed`, 'muted'); load() }, onError)} aria-label={`Remove ${q.name}`} title="Remove"><Icon.trash /></button></span> : <span />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="card">
              <header className="card-h"><h3><Icon.wrench />Open problems</h3>{issues.length > 0 && <button className="link-btn" onClick={() => setTab('problems')}>All problems<Icon.arrow /></button>}</header>
              {issues.filter((e) => OPEN.includes(e.status)).length === 0 ? <p className="empty-s">{issues.length ? `None open. ${plural(issues.length, 'problem')} solved so far.` : 'No problems logged.'}</p> : (
                <ul className="mini-list">
                  {issues.filter((e) => OPEN.includes(e.status)).map((e) => (
                    <li key={e._id}><button onClick={() => openProblem(e._id)}><i className={`dot tone-${ISSUE_TONE[e.status]}`} /><span><b>{e.title}</b><small>{e.ref} · {ISSUE[e.status]}{e.errorCodes?.length ? ` · ${e.errorCodes.join(', ')}` : ''}{e.serial ? ` · ${e.serial}` : ''}{e.equipmentName ? ` · ${e.equipmentName}` : ''} · {fmtDay(e.foundOn)}</small></span><Sev s={e.severity} /></button></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <header className="card-h"><h3><Icon.pin />Latest site visits</h3>{visits.length > 0 && <button className="link-btn" onClick={() => setTab('visits')}>All visits<Icon.arrow /></button>}</header>
              {visits.length === 0 ? <p className="empty-s">No site visits logged yet.</p> : (
                <ul className="mini-list">
                  {visits.slice(0, 4).map((v) => (
                    <li key={v._id}><button onClick={() => setParams({ id, tab: 'visits', e: v._id })}><span className="mini-date"><b>{fmtDay(v.date, { day: 'numeric' })}</b><small>{fmtDay(v.date, { month: 'short' })}</small></span><span><b>{v.purpose || 'Site visit'}</b><small>{(v.engineers || []).map((x) => x.name.split(' ')[0]).join(', ')}{v.problemIds?.length ? ` · ${plural(v.problemIds.length, 'problem')}` : ''}</small></span><span /></button></li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="unit-side">
            <section className="card">
              <header className="card-h"><h3>Details</h3></header>
              <dl className="facts one">
                <div><dt><Icon.building />Client</dt><dd>{cl && can('clients.view') ? <button className="link-btn inline" onClick={() => go('clients', { id: cl._id })}>{cl.name}</button> : c.company || '–'}{c.city ? `, ${c.city}` : ''}{cl?.industry ? <small className="block muted">{cl.industry}</small> : null}</dd></div>
                {c.site && <div><dt><Icon.pin />Site</dt><dd>{c.site}</dd></div>}
                {c.contactName !== undefined ? (
                  <div><dt><Icon.phone />Contact at site</dt><dd>{c.contactName || '–'}{c.contactPhone ? <small className="block"><a href={`tel:${c.contactPhone.replace(/[^\d+]/g, '')}`}>{c.contactPhone}</a></small> : null}{c.contactEmail ? <small className="block"><a href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a></small> : null}</dd></div>
                ) : <div><dt><Icon.phone />Contact at site</dt><dd className="dim">Shown to the project team</dd></div>}
                <div><dt><Icon.calendar />Dates</dt><dd>Started {p.startDate ? fmtDay(p.startDate) : '–'}{p.goLiveDate ? <small className="block">Go-live {fmtDay(p.goLiveDate)}</small> : null}{p.closedOn ? <small className="block">Closed {fmtDay(p.closedOn)}</small> : null}</dd></div>
                {p.enquiryRef && <div><dt><Icon.inbox />From enquiry</dt><dd className="mono">{p.enquiryRef}</dd></div>}
              </dl>
              {p.description && <p className="pre proj-desc">{p.description}</p>}
              {p.tags?.length > 0 && <div className="tags">{p.tags.map((t) => <span key={t} className="tag ghost">{t}</span>)}</div>}
            </section>
            <section className="card">
              <header className="card-h"><h3><Icon.users />Team</h3>{manage && <button className="link-btn" onClick={() => setForm({ type: 'project' })}>Change</button>}</header>
              {p.team.length === 0 ? <p className="empty-s">Nobody yet.</p> : (
                <ul className="people-mini">{p.team.map((m) => <li key={m.userId}><Avatar name={m.name} size={30} /><span><b>{m.name}{m.userId === user._id ? <span className="muted"> (you)</span> : null}</b><small>{m.role || 'Team member'}</small></span></li>)}</ul>
              )}
            </section>
            <section className="card">
              <header className="card-h"><h3>History</h3></header>
              <ol className="hist">
                {[...p.history].reverse().slice(0, 12).map((h, i) => <li key={i}><i className="hist-dot" /><div><span>{h.text}</span><small className="muted" title={fmtDateTime(h.at)}>{h.by} · {timeAgo(h.at)}</small></div></li>)}
              </ol>
            </section>
            {can('projects.delete') && <button className="link-btn danger" onClick={() => client.del(`/projects/${id}`).then(() => { notify(`${p.ref} deleted`, 'muted'); onBack() }, onError)}><Icon.trash />Delete this project and its record</button>}
          </div>
        </div>
      )}

      {tab === 'problems' && (
        <section className="prob-list">
          <div className="toolbar">
            {[['all', 'All'], ['open', 'Not solved'], ['solved', 'Solved']].map(([k, l]) => <button key={k} className={`chip${issueFilter === k ? ' on' : ''}`} onClick={() => setIssueFilter(k)}>{l}</button>)}
          </div>
          {shownIssues.length === 0 ? <div className="card empty"><Icon.wrench /><b>{issues.length ? 'Nothing matches' : 'No problems logged'}</b><span className="muted">{issues.length ? 'Try other words or filters.' : 'Log problems as they happen, with how they were solved.'}</span></div>
            : shownIssues.map((e) => (
              <ProblemCard key={e._id} e={e} open={openIds.has(e._id) || words.length > 0} onToggle={() => toggle(e._id)} words={words} can={can}
                visitDate={e.visitId ? byId.get(e.visitId)?.date : null}
                onSolve={() => setForm({ type: 'solve', entry: e })} onEdit={() => setForm({ type: 'issue', entry: e })} onDelete={() => del(e)}
                onUpdate={(text) => client.post(`/project-entries/${e._id}/updates`, { text }).then((r) => replaceEntry(r.entry), onError)} />
            ))}
        </section>
      )}

      {tab === 'visits' && (
        <section className="visit-list">
          {visits.filter(hit).length === 0 ? <div className="card empty"><Icon.pin /><b>{visits.length ? 'Nothing matches' : 'No site visits yet'}</b><span className="muted">{visits.length ? 'Try other words.' : 'Log each day at the customer’s site: what was done, what went wrong and how it was fixed.'}</span></div>
            : visits.filter(hit).map((v) => (
              <VisitCard key={v._id} v={v} words={words} problems={(v.problemIds || []).map((x) => byId.get(x)).filter(Boolean)}
                onOpenProblem={openProblem} onEdit={() => setForm({ type: 'visit', entry: v })} onDelete={() => del(v)} />
            ))}
        </section>
      )}

      {tab === 'notes' && (
        <section className="card">
          {can('projects.log') && (
            <form className="note-form" onSubmit={(e) => { e.preventDefault(); if (!noteText.trim()) return; client.post(`/projects/${id}/entries`, { kind: 'note', text: noteText }).then(() => { setNoteText(''); load() }, onError) }}>
              <textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="A note for everyone on this project: decisions, customer requests, settings…" />
              <button className="btn sm" disabled={!noteText.trim()}>Add note</button>
            </form>
          )}
          <ol className="activity-notes">
            {notes.filter(hit).map((n) => (
              <li key={n._id} id={`e-${n._id}`}><Avatar name={n.createdBy} size={28} /><div><b>{n.createdBy}</b> <time className="dim" title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time><p className="pre"><Marked text={n.text} words={words} /></p></div>{n.canEdit && <button className="icon-btn" onClick={() => del(n)} aria-label="Delete note"><Icon.trash /></button>}</li>
            ))}
            {notes.length === 0 && <li className="muted">No notes yet.</li>}
          </ol>
        </section>
      )}

      {form?.type === 'equipment' && <EquipmentForm client={client} project={p} item={form.item} onError={onError} onClose={() => setForm(null)} onSaved={(q) => { setForm(null); notify(`${q.name} saved`); load() }} />}
      {form?.type === 'software' && <SoftwareForm client={client} unit={form.unit} onError={onError} onClose={() => setForm(null)} onSaved={(u, same) => { setForm(null); notify(same ? `${u.serial} was already on that version` : `${u.serial} is now on ${u.software.version}`); load() }} />}
      {form?.type === 'pastRobot' && <PastRobotForm client={client} project={p} onError={onError} onClose={() => setForm(null)} onSaved={(u) => { setForm(null); notify(`${u.serial} added to ${p.ref}`); load() }} />}
      {form?.type === 'project' && <ProjectForm client={client} project={p} people={people} onError={onError} onClose={() => setForm(null)} onSaved={() => { setForm(null); notify('Project saved'); load() }} />}
      {form?.type === 'visit' && <VisitForm client={client} project={p} units={units} people={people} user={user} visit={form.entry} onError={onError} onClose={() => setForm(null)}
        onSaved={(v, probs) => { setForm(null); notify(form.entry ? 'Visit saved' : `Site visit logged${probs.length ? ` with ${plural(probs.length, 'problem')}` : ''}`); load(); setParams({ id, tab: 'visits', e: v._id }) }} />}
      {(form?.type === 'issue' || form?.type === 'solve') && <IssueForm client={client} project={p} units={units} issue={form.entry} solveOnly={form.type === 'solve'} onError={onError} onClose={() => setForm(null)}
        onSaved={(en) => { setForm(null); notify(form.type === 'solve' && en.status === 'solved' ? `${en.ref} solved` : `${en.ref} saved`); load(); setOpenIds((s) => new Set([...s, en._id])); setParams({ id, tab: 'problems', e: en._id }) }} />}
    </div>
  )
}

// ── search across everything ───────────────────────────────────
const HIT = { project: ['Project', Icon.folder], client: ['Client', Icon.building], issue: ['Problem', Icon.wrench], visit: ['Site visit', Icon.pin], note: ['Note', Icon.note] }

export function SearchResults({ client, q, kind, onlyOpen, clientId, setKind, setOnlyOpen, onOpen, onError }) {
  const [res, setRes] = useState(null)
  useEffect(() => {
    let live = true
    setRes(null)
    const t = setTimeout(() => {
      client.get('/projects/search', { q, kind: kind || undefined, status: onlyOpen ? 'open' : undefined, clientId }).then((r) => { if (live) setRes(r) }, (err) => { if (live) { setRes({ hits: [], words: [] }); onError(err) } })
    }, 250)
    return () => { live = false; clearTimeout(t) }
  }, [client, q, kind, onlyOpen, clientId, onError])
  const counts = useMemo(() => (res ? res.hits.reduce((m, h) => ({ ...m, [h.type]: (m[h.type] || 0) + 1 }), {}) : {}), [res])
  const words = res?.words || []
  const kinds = [['', 'Everything'], ['issue', 'Problems'], ['visit', 'Site visits'], ['note', 'Notes'], ['project', 'Projects'], ...(clientId ? [] : [['client', 'Clients']])]
  return (
    <section className="search-res">
      <div className="toolbar">
        {kinds.map(([k, l]) => <button key={k || 'all'} className={`chip${(kind || '') === k ? ' on' : ''}`} onClick={() => setKind(k || undefined)}>{l}{!kind && k && counts[k] ? ` · ${counts[k]}` : ''}</button>)}
        <span className="grow" />
        <button className={`chip${onlyOpen ? ' on' : ''}`} onClick={() => setOnlyOpen(!onlyOpen)}>Only problems not solved</button>
      </div>
      {!res ? <div className="loading">Searching…</div> : res.hits.length === 0 ? (
        <div className="card empty"><Icon.search /><b>Nothing found for “{q}”</b><span className="muted">Every word has to appear. Try fewer or other words: an error code, a part, a serial number, a customer.</span></div>
      ) : (
        <>
          <p className="muted small res-count">{plural(res.hits.length, 'result')}{res.hits.length >= 200 ? ' (first 200)' : ''}. Best matches first: an error code or the problem’s title counts most, and solved problems hold the answer.</p>
          <ol className="hits">
            {res.hits.map((h) => {
              const [label, Ico] = HIT[h.type] || HIT.note
              const it = h.item
              return (
                <li key={`${h.type}-${it._id}`}>
                  <button className={`hit k-${h.type}${it.status ? ` st-${it.status}` : ''}`} onClick={() => onOpen(h)}>
                    <span className="hit-ico"><Ico /></span>
                    <span className="hit-main">
                      <span className="hit-top"><span className="mono muted">{label}{it.ref && h.type !== 'project' ? ` · ${it.ref}` : ''}{h.project ? ` · ${h.project.ref} ${h.project.name}${h.project.company ? ` · ${h.project.company}` : ''}` : ''}</span></span>
                      {h.type === 'client' && <><b><Marked text={it.name} words={words} /></b><span className="hit-snip">{[it.industry, it.city].filter(Boolean).join(' · ')}</span></>}
                      {h.type === 'project' && <><b><Marked text={it.name} words={words} /></b><span className="hit-snip"><Marked text={around([it.application, it.description].filter(Boolean).join(' · '), words)} words={words} /></span></>}
                      {h.type === 'issue' && <>
                        <b><Marked text={it.title} words={words} /></b>
                        <span className="row-meta"><IssueStatus s={it.status} /><Sev s={it.severity} /><ProblemTags e={it} words={words} /><span className="tag ghost">{CAT[it.category]}</span><span className="muted small">{fmtDay(it.foundOn)}</span></span>
                        {it.solution && <span className="hit-sol"><Icon.check /><span><Marked text={around(it.solution, words)} words={words} /></span></span>}
                        {it.rootCause && matches(it.rootCause, words) && <span className="hit-snip"><span className="mono muted">Cause </span><Marked text={around(it.rootCause, words)} words={words} /></span>}
                        {it.description && matches(it.description, words) && <span className="hit-snip"><Marked text={around(it.description, words)} words={words} /></span>}
                      </>}
                      {h.type === 'visit' && <>
                        <b>{fmtDay(it.date)} · <Marked text={it.purpose || 'Site visit'} words={words} /></b>
                        <span className="hit-snip"><Marked text={around([it.workDone, it.nextSteps].filter(Boolean).join(' · Next: '), words)} words={words} /></span>
                        <span className="muted small">{(it.engineers || []).map((x) => x.name).join(', ')}</span>
                      </>}
                      {h.type === 'note' && <><b>{it.createdBy} · {timeAgo(it.createdAt)}</b><span className="hit-snip"><Marked text={around(it.text, words)} words={words} /></span></>}
                    </span>
                    <Icon.arrow />
                  </button>
                </li>
              )
            })}
          </ol>
        </>
      )}
    </section>
  )
}

/** Where a search hit opens. */
export const openHit = (go, h, backq) => (h.type === 'client'
  ? go('clients', { id: h.item._id })
  : go('projects', { id: h.project._id, tab: h.type === 'project' ? undefined : h.type === 'issue' ? 'problems' : h.type === 'visit' ? 'visits' : 'notes', e: h.type === 'project' ? undefined : h.item._id, backq }))

// ── the list ───────────────────────────────────────────────────
export function ProjectCard({ p, onOpen, hideClient }) {
  const eq = p.counts.equipment || 0
  return (
    <button className="pcard-proj" onClick={onOpen}>
      <span className="pc-top"><span className="mono muted">{p.ref}</span><ProjectStatus s={p.status} /></span>
      <b className="pc-name">{p.name}</b>
      {!hideClient && <span className="pc-cust">{p.customer?.company || 'Internal'}{p.customer?.city ? `, ${p.customer.city}` : ''}</span>}
      {(p.application || hideClient) && <span className="pc-app">{[p.application, hideClient && p.customer?.city].filter(Boolean).join(' · ')}</span>}
      <span className="pc-robots">{p.counts.serials.length ? p.counts.serials.map((x) => <span key={x} className="tag mono">{x}</span>) : <span className="muted small">No robots yet</span>}{eq ? <span className="tag eq-tag"><Icon.factory />{plural(eq, 'equipment', 'equipment')}</span> : null}</span>
      <span className="pc-foot">
        <span className={p.counts.openIssues ? 'bad-text' : 'muted'}><Icon.wrench />{p.counts.openIssues ? `${p.counts.openIssues} open` : `${p.counts.issues} solved`}</span>
        <span className="muted"><Icon.pin />{p.counts.lastVisit ? `Visited ${fmtDay(p.counts.lastVisit, { day: 'numeric', month: 'short' })}` : p.goLiveDate && p.status !== 'planning' ? `Live ${fmtDay(p.goLiveDate, { month: 'short', year: 'numeric' })}` : 'No visits'}</span>
        <span className="pc-team">{p.team.slice(0, 4).map((m) => <Avatar key={m.userId} name={m.name} size={24} />)}</span>
      </span>
    </button>
  )
}

export default function Projects({ client, user, can, params, setParams, go, onError, notify, version }) {
  const [list, setList] = useState(null)
  const [people, setPeople] = useState([])
  const [q, setQ] = useState(params.q || '')
  const [creating, setCreating] = useState(false)
  const filter = params.filter || 'active'
  const grouped = params.view !== 'cards'

  const load = useCallback(() => client.get('/projects').then((r) => setList(r.projects), onError), [client, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { client.get('/users').then((r) => setPeople(r.users.filter((p) => p.active !== false && p.role !== 'hr')), onError) }, [client, onError])
  // The address can change the search too (back button, a link from another page).
  useEffect(() => { setQ((x) => (x.trim() === (params.q || '') ? x : params.q || '')) }, [params.q])
  useEffect(() => {
    const t = setTimeout(() => { if ((params.q || '') !== q.trim()) setParams({ ...params, q: q.trim() || undefined }) }, 350)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  if (params.id) {
    return <ProjectPage key={params.id} id={params.id} client={client} user={user} can={can} params={params} setParams={(p) => setParams({ ...p })} go={go} people={people} onError={onError} notify={notify} version={version}
      onBack={() => { setParams({ q: params.backq || undefined }); load() }} />
  }

  const shown = (list || []).filter((p) => (filter === 'active' ? p.status !== 'closed' : filter === 'mine' ? p.team.some((m) => m.userId === user._id) : filter === 'all' ? true : p.status === filter))
  const active = (list || []).filter((p) => p.status !== 'closed')
  const openProblems = active.reduce((n, p) => n + p.counts.openIssues, 0)
  const searching = !!params.q
  // One block per client, so a client's several projects sit together.
  const groups = []
  if (grouped) {
    const by = new Map()
    for (const p of shown) {
      const k = p.clientId || (p.customer?.company ? `name:${p.customer.company}` : '')
      if (!by.has(k)) by.set(k, { key: k, clientId: p.clientId, name: p.customer?.company || 'Internal projects', city: p.customer?.city, projects: [] })
      by.get(k).projects.push(p)
    }
    groups.push(...[...by.values()].sort((a, b) => (!a.key ? 1 : !b.key ? -1 : a.name.localeCompare(b.name))))
  }
  const openProject = (p) => setParams({ id: p._id })

  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">Projects</span><h1>{list ? <>{active.length} active {active.length === 1 ? 'project' : 'projects'}{openProblems ? <span className="muted">, {plural(openProblems, 'open problem')}.</span> : <span className="muted">.</span>}</> : 'Projects'}</h1></div>
        <div className="toolbar">
          {can('clients.view') && <button className="btn" onClick={() => go('clients')}><Icon.building />Clients</button>}
          {can('projects.manage') && <button className="btn primary" onClick={() => setCreating(true)}><Icon.plus />New project</button>}
        </div>
      </header>

      <div className="big-search">
        <Icon.search />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything: an error code like E131, a part, a solution, a serial, a client…" aria-label="Search projects, problems, solutions and site visits" />
        {q && <button className="icon-btn" onClick={() => { setQ(''); setParams({}) }} aria-label="Clear the search"><Icon.close /></button>}
      </div>

      {searching ? (
        <SearchResults client={client} q={params.q} kind={params.kind} onlyOpen={params.open === 'true'} onError={onError}
          setKind={(k) => setParams({ ...params, kind: k })} setOnlyOpen={(v) => setParams({ ...params, open: v ? 'true' : undefined })}
          onOpen={(h) => (h.type === 'client' ? go('clients', { id: h.item._id }) : setParams({ id: h.project._id, tab: h.type === 'project' ? undefined : h.type === 'issue' ? 'problems' : h.type === 'visit' ? 'visits' : 'notes', e: h.type === 'project' ? undefined : h.item._id, backq: params.q }))} />
      ) : (
        <>
          <div className="toolbar between">
            <div className="toolbar">
              {[['active', 'Active'], ['mine', 'My projects'], ['all', 'All'], ...Object.entries(STATUS)].map(([k, l]) => <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setParams({ ...params, filter: k === 'active' ? undefined : k })}>{l}</button>)}
            </div>
            <div className="seg-mini" role="group" aria-label="Show as">
              <button className={grouped ? 'on' : ''} onClick={() => setParams({ ...params, view: undefined })}><Icon.building />By client</button>
              <button className={!grouped ? 'on' : ''} onClick={() => setParams({ ...params, view: 'cards' })}><Icon.grid />All cards</button>
            </div>
          </div>
          {!list ? <div className="loading">Loading…</div> : shown.length === 0 ? (
            <div className="card empty"><Icon.folder /><b>{list.length ? 'No projects here' : 'No projects yet'}</b><span className="muted">{can('projects.manage') ? 'Start one with “New project” and put robots from the build list on it.' : 'A lead creates projects when an order is confirmed.'}</span></div>
          ) : grouped ? (
            <div className="client-groups">
              {groups.map((g) => (
                <section key={g.key || 'internal'} className="client-group" style={{ '--n': Math.min(g.projects.length, 3) }}>
                  <header>
                    {g.clientId && can('clients.view') ? <button className="cg-name" onClick={() => go('clients', { id: g.clientId })}><Icon.building /><b>{g.name}</b><Icon.arrow /></button> : <span className="cg-name"><Icon.building /><b>{g.name}</b></span>}
                    <span className="muted small">{plural(g.projects.length, 'project')} · {plural(g.projects.reduce((n, p) => n + p.counts.robots, 0), 'robot')}{g.projects.some((p) => p.counts.openIssues) ? ` · ${plural(g.projects.reduce((n, p) => n + p.counts.openIssues, 0), 'open problem')}` : ''}</span>
                  </header>
                  <div className="proj-cards">{g.projects.map((p) => <ProjectCard key={p._id} p={p} hideClient onOpen={() => openProject(p)} />)}</div>
                </section>
              ))}
            </div>
          ) : (
            <div className="proj-cards">{shown.map((p) => <ProjectCard key={p._id} p={p} onOpen={() => openProject(p)} />)}</div>
          )}
        </>
      )}
      {creating && <ProjectForm client={client} people={people} onError={onError} onClose={() => setCreating(false)} onSaved={(p) => { setCreating(false); notify(`${p.ref} created`); load(); setParams({ id: p._id }) }} />}
    </div>
  )
}
