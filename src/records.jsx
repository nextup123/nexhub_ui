// Pieces shared by Projects, Clients and Production: error codes, highlighting, "seen before",
// equipment kinds, and the robot software forms.
import { Fragment, useEffect, useState } from 'react'
import { Icon, Modal, fmtDay, todayStr } from './ui'

export const EQUIP = {
  conveyor: 'Conveyor', spm: 'SPM (special purpose machine)', gripper: 'Gripper / end effector', vision: 'Vision system', fixture: 'Fixture / jig',
  safety: 'Safety (fence, scanner, curtain)', plc_panel: 'PLC / control panel', positioner: 'Positioner / turntable', agv: 'AGV / AMR', other: 'Other',
}
export const EQUIP_SHORT = { conveyor: 'Conveyor', spm: 'SPM', gripper: 'Gripper', vision: 'Vision', fixture: 'Fixture', safety: 'Safety', plc_panel: 'PLC panel', positioner: 'Positioner', agv: 'AGV', other: 'Other' }
export const EQUIP_ST = { planned: 'Planned', installed: 'Installed', removed: 'Removed' }

// Error and alarm codes, however they are written: E131, E-131, e 131, AL-21, F0003, Err 41.
// The hub reads them the same way, so any spelling finds the others.
const CODE_RX = /\b([a-z]{1,4})[\s\-_:#.]?(\d{2,6})\b/gi
export function codesIn(...texts) {
  const out = new Map()
  for (const t of texts.flat()) {
    if (!t) continue
    for (const m of String(t).matchAll(CODE_RX)) {
      const k = `${m[1]}${m[2]}`.toLowerCase()
      if (!out.has(k)) out.set(k, `${m[1]}${m[2]}`.toUpperCase())
    }
  }
  return out // squeezed → shown, e.g. e131 → E131
}
export const normWord = (w) => w.toLowerCase().replace(/^([a-z]{1,4})[-_:#.]?(\d{2,6})$/, '$1$2')
export const splitCodes = (s) => [...new Set(String(s || '').split(/[,;\n]+/).map((x) => x.trim().toUpperCase()).filter(Boolean))]

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** A searched word as a pattern: a code matches every spelling of it. */
export const wordPattern = (w) => {
  const m = /^([a-z]{1,4})(\d{2,6})$/i.exec(w)
  return m ? `${esc(m[1])}[\\s\\-_:#.]?${m[2]}` : esc(w)
}
/** Marks every searched word in a piece of text. */
export function Marked({ text, words }) {
  if (!text) return null
  if (!words?.length) return text
  const rx = new RegExp(`(${words.map(wordPattern).join('|')})`, 'gi')
  return String(text).split(rx).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))
}
/** Does this text hold the word (codes in any spelling)? */
export const holds = (text, w) => !!text && new RegExp(wordPattern(w), 'i').test(text)

export function CodeChips({ codes, words }) {
  if (!codes?.length) return null
  return <span className="codes">{codes.map((c) => <span key={c} className={`code${words?.some((w) => normWord(c) === w) ? ' hit' : ''}`}>{c}</span>)}</span>
}

/**
 * "Seen before": while a problem is being written, the solved problems most like it, from every
 * project. The more of its error codes and words match, the higher.
 */
export function SeenBefore({ client, text, exclude }) {
  const [hits, setHits] = useState(null)
  const [open, setOpen] = useState(null)
  const q = text.replace(/\s+/g, ' ').trim()
  useEffect(() => {
    if (q.length < 4) { setHits(null); return undefined }
    let live = true
    const t = setTimeout(() => {
      client.get('/projects/search', { q: q.slice(0, 280), mode: 'similar', kind: 'issue', exclude, limit: 5 })
        .then((r) => { if (live) setHits(r.hits.filter((h) => h.type === 'issue')) }, () => { if (live) setHits([]) })
    }, 450)
    return () => { live = false; clearTimeout(t) }
  }, [client, q, exclude])
  if (!hits || hits.length === 0) return null
  const solved = hits.filter((h) => h.item.solution)
  return (
    <div className="seen">
      <span className="seen-h"><Icon.search /><b>Seen before</b><span className="muted">{solved.length ? `${solved.length} like this ${solved.length === 1 ? 'was' : 'were'} solved` : 'Similar problems, not solved yet'}</span></span>
      <ul>
        {hits.map((h) => {
          const it = h.item
          const on = open === it._id
          return (
            <li key={it._id} className={on ? 'on' : ''}>
              <button type="button" onClick={() => setOpen(on ? null : it._id)} aria-expanded={on}>
                <span className={`dot tone-${it.status === 'solved' ? 'good' : 'bad'}`} />
                <span className="seen-main"><b>{it.title}</b><small>{h.project.ref} · {h.project.company || h.project.name}{it.serial ? ` · ${it.serial}` : ''} · {fmtDay(it.foundOn)}</small></span>
                <CodeChips codes={it.errorCodes} />
              </button>
              {on && (
                <div className="seen-body">
                  {it.rootCause && <p><span className="mono muted">Cause</span> {it.rootCause}</p>}
                  {it.solution ? <p className="seen-sol"><Icon.check /><span className="pre">{it.solution}</span></p> : <p className="dim">No solution written yet.</p>}
                  <a className="link-btn" href={`#/projects?id=${h.project._id}&tab=problems&e=${it._id}`} target="_blank" rel="noreferrer">Open {it.ref} in a new tab<Icon.arrow /></a>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Codes found in what was typed that are not in the codes field yet. */
export function CodeSuggest({ text, value, onAdd }) {
  const have = new Set(splitCodes(value).map(normWord))
  const found = [...codesIn(text).entries()].filter(([k]) => !have.has(k)).slice(0, 6)
  if (!found.length) return null
  return (
    <span className="span2 code-suggest">
      <span className="muted small">Found in the text:</span>
      {found.map(([k, shown]) => <button type="button" key={k} className="code add" onClick={() => onAdd(shown)} title="Add to the error codes"><Icon.plus />{shown}</button>)}
    </span>
  )
}

// ── robot software ──────────────────────────────────────────────
export function SoftwareForm({ client, unit, onClose, onSaved, onError }) {
  const [f, setF] = useState({ version: '', on: todayStr(), note: '' })
  const save = async (e) => {
    e.preventDefault()
    try {
      const r = await client.post(`/units/${unit._id}/software`, f)
      onSaved(r.unit, r.unchanged)
    } catch (err) { onError(err) }
  }
  return (
    <Modal title={`Software on ${unit.serial}`} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <p className="span2 muted">{unit.software?.version ? <>Now on <b className="mono">{unit.software.version}</b> since {fmtDay(unit.software.since)}.</> : 'No version recorded yet.'}</p>
        <label><span className="mono">Version now on the robot</span><input value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} required autoFocus placeholder="3.4.2" /></label>
        <label><span className="mono">Since</span><input type="date" value={f.on} max={todayStr()} onChange={(e) => setF({ ...f, on: e.target.value })} /></label>
        <label className="span2"><span className="mono">Why <small>(optional)</small></span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Fix for the E131 drive drop-outs" /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Save version</button></footer>
      </form>
    </Modal>
  )
}

export function SoftwareHistory({ unit }) {
  const list = [...(unit.softwareHistory || [])].reverse()
  if (!list.length) return <p className="empty-s">No version recorded yet.</p>
  return (
    <ol className="sw-hist">
      {list.map((h, i) => (
        <li key={i} className={i === 0 ? 'now' : ''}>
          <b className="mono">{h.version}</b>
          <span>{fmtDay(h.on)}{i === 0 ? ' · now' : ''}<small className="block muted">{h.by}{h.note ? `: ${h.note}` : ''}</small></span>
        </li>
      ))}
    </ol>
  )
}

/** A robot that was built (and maybe installed) before the hub, with what it runs now. */
export function PastRobotForm({ client, project, onClose, onSaved, onError }) {
  const [models, setModels] = useState([])
  const [f, setF] = useState({ model: 'NexC5', colour: '', serial: '', status: project ? 'installed' : 'built', dispatchedOn: '', installedOn: project?.goLiveDate || '', softwareVersion: '', description: '' })
  useEffect(() => { client.get('/production/templates').then((r) => setModels(r.models), onError) }, [client, onError])
  const model = models.find((m) => m.name === f.model)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async (e) => {
    e.preventDefault()
    const body = {
      model: f.model, colour: model?.colours.length ? (f.colour || model.colours[0]) : '', serial: f.serial.trim() || undefined, alreadyBuilt: true,
      softwareVersion: f.softwareVersion, description: f.description,
      dispatchedOn: f.status !== 'built' ? f.dispatchedOn || f.installedOn || undefined : undefined,
      installedOn: f.status === 'installed' ? f.installedOn || undefined : undefined,
      projectId: project?._id,
      customer: project ? { company: project.customer?.company || '', city: project.customer?.city || '' } : undefined,
    }
    try { const r = await client.post('/units', body); onSaved(r.unit) } catch (err) { onError(err) }
  }
  return (
    <Modal title={project ? `Add a robot already at ${project.customer?.company || 'the site'}` : 'Add a robot built before the hub'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <p className="span2 muted">For a robot built before the hub was used: every build stage is marked done, and it starts with the software version it runs today.</p>
        <label><span className="mono">Model</span><select value={f.model} onChange={set('model')}>{(models.length ? models : [{ name: 'NexC5' }]).map((m) => <option key={m.name}>{m.name}</option>)}</select></label>
        {model?.colours.length ? <label><span className="mono">Colour</span><select value={f.colour || model.colours[0]} onChange={set('colour')}>{model.colours.map((c) => <option key={c}>{c}</option>)}</select></label> : <span />}
        <label><span className="mono">Serial number <small>(as on the robot)</small></span><input value={f.serial} onChange={set('serial')} placeholder="NX-C5-0007, or empty for the next one" /></label>
        <label><span className="mono">Software version now</span><input value={f.softwareVersion} onChange={set('softwareVersion')} placeholder="3.4.2" /></label>
        <label><span className="mono">Where it is</span><select value={f.status} onChange={set('status')}><option value="installed">Installed at the site</option><option value="dispatched">Dispatched, not installed</option><option value="built">Built, still with us</option></select></label>
        {f.status === 'installed' ? <label><span className="mono">Installed on</span><input type="date" value={f.installedOn} max={todayStr()} onChange={set('installedOn')} /></label>
          : f.status === 'dispatched' ? <label><span className="mono">Dispatched on</span><input type="date" value={f.dispatchedOn} max={todayStr()} onChange={set('dispatchedOn')} /></label> : <span />}
        <label className="span2"><span className="mono">Notes</span><input value={f.description} onChange={set('description')} placeholder="Gripper, options, anything the next engineer should know" /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Add the robot</button></footer>
      </form>
    </Modal>
  )
}
