// Tagged assets: the project › assembly › part tree, adding parts from the store, moving, returning, labels.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Modal, fmtDate, plural, timeAgo } from './ui'
import './assets.css'

export const KIND = { assembly: 'Assembly', unit: 'Single piece', lot: 'Lot' }
export const STATUS = { active: 'In use', faulty: 'Faulty', returned: 'Returned', scrapped: 'Scrapped' }
export const ASSEMBLY_TYPES = ['Panel', 'Robot arm', 'Computer', 'Joint', 'Gripper', 'Conveyor', 'Fixture', 'Cabinet', 'Sub-assembly', 'Other']
const GROUP = { it: 'IT', electrical: 'Electrical', raw_material: 'Raw material', mechanical: 'Mechanical', machinery: 'Machinery' }

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
export const AIcon = {
  assembly: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" /></svg>,
  unit: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="1.5" /></svg>,
  lot: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><circle cx="8" cy="9" r="3" /><circle cx="16" cy="9" r="3" /><circle cx="12" cy="16" r="3" /></svg>,
  tag: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></svg>,
  print: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3" /><rect x="7" y="14" width="10" height="7" /></svg>,
  chev: ({ open }) => <svg width="14" height="14" viewBox="0 0 24 24" {...P} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M9 6l6 6-6 6" /></svg>,
  move: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M5 12h14M15 8l4 4-4 4M9 4l-4 4 4 4" opacity="0" /><path d="M4 12h16M16 8l4 4-4 4" /></svg>,
  back: () => <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>,
}
export const KindIcon = ({ kind }) => { const I = AIcon[kind] || AIcon.unit; return <span className={`a-kind k-${kind}`}><I /></span> }
export const Tag = ({ tag, big }) => <span className={`a-tag${big ? ' big' : ''}`}>{tag}</span>
const qtyText = (a) => (a.kind === 'lot' ? `${a.quantity} ${a.unit || 'pcs'}` : '')

/** Nested from flat: children under their parent, in tag order. */
export function buildTree(list) {
  const byParent = new Map()
  const ids = new Set(list.map((a) => a._id))
  list.forEach((a) => { const p = a.parentId && ids.has(a.parentId) ? a.parentId : ''; if (!byParent.has(p)) byParent.set(p, []); byParent.get(p).push(a) })
  const count = new Map()
  const countOf = (id) => { if (count.has(id)) return count.get(id); const n = (byParent.get(id) || []).reduce((t, c) => t + 1 + countOf(c._id), 0); count.set(id, n); return n }
  return { byParent, countOf }
}

function TreeRow({ a, depth, tree, open, toggle, onOpen, onAdd, canManage, match }) {
  const kids = tree.byParent.get(a._id) || []
  const isOpen = open.has(a._id) || !!match
  if (match && !match.has(a._id)) return null
  return (
    <>
      <div className={`a-row depth-${Math.min(depth, 6)} ${a.kind}`} style={{ '--d': depth }}>
        <button className="a-twist" onClick={() => toggle(a._id)} disabled={!kids.length} aria-label={isOpen ? 'Fold' : 'Unfold'} aria-expanded={kids.length ? isOpen : undefined}>{kids.length ? <AIcon.chev open={isOpen} /> : null}</button>
        <button className="a-main" onClick={() => onOpen(a)}>
          <KindIcon kind={a.kind} />
          <span className="a-name"><b>{a.name}</b>{a.kind === 'assembly' ? <small>{a.assemblyType}{kids.length ? ` · ${plural(tree.countOf(a._id), 'part')}` : ' · empty'}</small> : <small>{[qtyText(a), a.serial && `S/N ${a.serial}`, a.itemRef].filter(Boolean).join(' · ')}</small>}</span>
          {a.status === 'faulty' && <span className="a-st faulty">Faulty</span>}
          <Tag tag={a.tag} />
        </button>
        {canManage && a.kind === 'assembly' ? <button className="a-add" onClick={() => onAdd(a)} title={`Add a part to ${a.name}`}><Icon.plus />Part</button> : <span className="a-add-sp" />}
      </div>
      {isOpen && kids.map((c) => <TreeRow key={c._id} a={c} depth={depth + 1} tree={tree} open={open} toggle={toggle} onOpen={onOpen} onAdd={onAdd} canManage={canManage} match={match} />)}
    </>
  )
}

/** The Assets tab of a project. */
export function ProjectAssets({ client, project, can, go, onError, notify, version }) {
  const [data, setData] = useState(null)
  const [open, setOpen] = useState(() => new Set())
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const manage = can('assets.manage')
  const load = useCallback(() => client.get(`/projects/${project._id}/assets`).then((d) => {
    setData(d)
    // First time: show the components and what is directly inside them.
    setOpen((o) => (o.size ? o : new Set(d.assets.filter((a) => !a.parentId).map((a) => a._id))))
  }, onError), [client, project._id, onError])
  useEffect(() => { load() }, [load, version])
  const tree = useMemo(() => buildTree(data?.assets || []), [data])
  // Search: keep what matches and the assemblies above it.
  const match = useMemo(() => {
    const w = q.trim().toLowerCase().replace(/-/g, '')
    if (!w || !data) return null
    const byId = new Map(data.assets.map((a) => [a._id, a]))
    const keep = new Set()
    data.assets.forEach((a) => {
      const t = [a.tag.replace(/-/g, ''), a.name, a.serial, a.make, a.model, a.itemRef, a.assemblyType].join(' ').toLowerCase()
      if (t.includes(w)) { let c = a; while (c) { keep.add(c._id); c = byId.get(c.parentId) } }
    })
    return keep
  }, [q, data])
  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const roots = tree.byParent.get('') || []
  const labels = () => client.download('/assets/labels.pdf', { projectId: project._id }, `${project.ref}-labels.pdf`).then(() => notify('Labels saved: print on A4 (3 × 8 labels)'), onError)
  const bom = () => client.download(`/projects/${project._id}/assets/export.xlsx`, {}, `${project.ref}-bill-of-materials.xlsx`).then(() => notify('Bill of materials saved'), onError)
  if (!data) return <div className="loading">Loading…</div>
  const t = data.totals

  return (
    <section className="card a-card">
      <header className="a-head">
        <div>
          <h3>What is in {project.ref}</h3>
          <p className="muted">{t.tags ? `${plural(t.assemblies, 'component')}, ${plural(t.units + t.lots, 'part')} (${t.pieces} pieces), ${plural(t.tags, 'tag')}` : 'Nothing tagged yet.'}</p>
        </div>
        <div className="toolbar">
          {t.tags > 0 && <div className="search small"><Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a tag, part or serial" aria-label="Find in this project" /></div>}
          {t.tags > 0 && <button className="btn sm" onClick={bom}><Icon.download />Bill of materials</button>}
          {t.tags > 0 && <button className="btn sm" onClick={labels}><AIcon.print />Labels</button>}
          {manage && <button className="btn primary sm" onClick={() => setForm({ type: 'component' })}><Icon.plus />Add component</button>}
        </div>
      </header>
      {!roots.length ? (
        <div className="a-empty">
          <div className="a-empty-art" aria-hidden="true"><span><AIcon.assembly /></span><i /><span><AIcon.unit /></span><i /><span><AIcon.lot /></span></div>
          <p><b>Start with the big pieces.</b> Add the project's components (a panel, the robot arm, the computer), then add parts into each one from the store. Every part gets its own tag, down to a bag of bolts.</p>
          {manage && <div className="a-quick">{['Panel', 'Robot arm', 'Computer'].map((n) => <button key={n} className="btn sm" onClick={() => setForm({ type: 'component', preset: n })}><Icon.plus />{n}</button>)}</div>}
        </div>
      ) : (
        <div className="a-tree" role="tree">
          {roots.map((a) => <TreeRow key={a._id} a={a} depth={0} tree={tree} open={open} toggle={toggle} onOpen={(x) => go('assets', { id: x._id })} onAdd={(x) => setForm({ type: 'part', parent: x })} canManage={manage} match={match} />)}
          {match && !match.size && <p className="empty-s">Nothing in this project matches “{q}”.</p>}
        </div>
      )}
      {form && <AddModal client={client} project={project} parent={form.parent} component={form.type === 'component'} preset={form.preset} onClose={() => setForm(null)} onError={onError}
        onSaved={(list) => { setForm(null); notify(list.length === 1 ? `${list[0].name}: tag ${list[0].tag}` : `${list.length} tags made: ${list[0].tag} to ${list.at(-1).tag}`); if (form.parent) setOpen((o) => new Set([...o, form.parent._id])); load() }} />}
    </section>
  )
}

/** Add a component (assembly) to a project, or a part into an assembly: from the store, or registered on its own. */
export function AddModal({ client, project, parent, component, preset, onClose, onSaved, onError }) {
  const [mode, setMode] = useState(component ? 'own' : 'stock')
  const [stock, setStock] = useState(null)
  const [sq, setSq] = useState('')
  const [pick, setPick] = useState(null)
  const [f, setF] = useState({ kind: component ? 'assembly' : 'unit', assemblyType: preset || 'Panel', name: preset || '', quantity: '', unit: 'pcs', make: '', model: '', serial: '', location: '', notes: '' })
  const [take, setTake] = useState({ quantity: '1', mode: 'unit', serials: '' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  useEffect(() => { if (mode === 'stock' && !stock) client.get('/inventory').then((r) => setStock(r.items), onError) }, [mode, stock, client, onError])
  const shown = useMemo(() => {
    const w = sq.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (stock || []).filter((s) => !w.length || w.every((x) => [s.ref, s.name, s.type, s.make, s.model].join(' ').toLowerCase().includes(x))).slice(0, 60)
  }, [stock, sq])
  const choose = (s) => { setPick(s); setTake({ quantity: '1', mode: s.tracking || 'unit', serials: '' }) }
  const where = parent ? `${parent.name} (${parent.tag})` : project ? project.ref : 'the store'
  const n = Number(take.quantity)
  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const place = parent ? { parentId: parent._id } : { projectId: project?._id }
      const body = mode === 'stock'
        ? { ...place, fromStock: { itemId: pick._id, quantity: n, mode: take.mode, serials: take.serials } }
        : { ...place, ...f, kind: component ? 'assembly' : f.kind }
      const r = await client.post('/assets', body)
      onSaved(r.assets)
    } catch (err) { onError(err) } finally { setBusy(false) }
  }
  return (
    <Modal title={component ? `Add a component to ${project.ref}` : `Add to ${where}`} onClose={onClose} wide>
      {!component && (
        <div className="seg-ctl a-seg" role="tablist">
          <button type="button" className={mode === 'stock' ? 'on' : ''} onClick={() => setMode('stock')}>From the store</button>
          <button type="button" className={mode === 'own' ? 'on' : ''} onClick={() => setMode('own')}>Not in the store</button>
        </div>
      )}
      <form onSubmit={save}>
        {mode === 'stock' && !pick && (
          <div className="a-pick">
            <div className="search"><Icon.search /><input autoFocus value={sq} onChange={(e) => setSq(e.target.value)} placeholder="Search the store: relay, M6 bolt, EE-4…" /></div>
            <div className="a-pick-list">
              {!stock ? <p className="loading">Loading the store…</p> : !shown.length ? <p className="empty-s">Nothing in the store matches. Add it in the inventory app first, or use “Not in the store”.</p>
                : shown.map((s) => (
                  <button type="button" key={s._id} className="a-pick-row" onClick={() => choose(s)} disabled={!s.quantity}>
                    <span><b>{s.name}</b><small>{[s.ref, GROUP[s.category], [s.make, s.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</small></span>
                    <em className={s.quantity ? '' : 'none'}>{s.quantity ? `${s.quantity} ${s.unit} in store` : 'none left'}</em>
                  </button>
                ))}
            </div>
          </div>
        )}
        {mode === 'stock' && pick && (
          <div className="a-take">
            <div className="a-picked"><span><b>{pick.name}</b><small>{pick.ref} · {pick.quantity} {pick.unit} in the store</small></span><button type="button" className="link-btn sm" onClick={() => setPick(null)}>Change</button></div>
            <div className="form-grid">
              <label><span className="mono">How many</span><input type="number" min="1" max={pick.quantity} step="1" value={take.quantity} onChange={(e) => setTake({ ...take, quantity: e.target.value })} autoFocus required /></label>
              <label><span className="mono">Tags</span>
                <select value={take.mode} onChange={(e) => setTake({ ...take, mode: e.target.value })}>
                  <option value="unit">One tag for each piece</option>
                  <option value="lot">One tag for the whole lot</option>
                </select>
              </label>
              {take.mode === 'unit' && n > 0 && n <= 200 && <label className="span2"><span className="mono">Serial numbers <small className="muted">(optional, one per line, in order)</small></span><textarea rows={Math.min(Math.max(n, 2), 6)} value={take.serials} onChange={(e) => setTake({ ...take, serials: e.target.value })} placeholder={'D23B0711\nD23B0712'} /></label>}
            </div>
            <p className="a-explain">
              {n > 0 && n <= pick.quantity ? (take.mode === 'unit'
                ? <>Makes <b>{plural(n, 'tag')}</b>, one for each piece, inside {where}. The store goes from {pick.quantity} to {pick.quantity - n}.</>
                : <>Makes <b>1 tag</b> for {n} {pick.unit} of {pick.name}, inside {where}. The store goes from {pick.quantity} to {pick.quantity - n}.</>)
                : n > pick.quantity ? <span className="bad-text">Only {pick.quantity} in the store.</span> : null}
              {take.mode === 'unit' && n > 200 && <span className="bad-text"> Up to 200 single tags at a time: use one tag for the lot.</span>}
            </p>
          </div>
        )}
        {mode === 'own' && (
          <div className="form-grid">
            {component ? (
              <>
                <label><span className="mono">Component</span><select value={f.assemblyType} onChange={(e) => setF((x) => ({ ...x, assemblyType: e.target.value, name: !x.name || ASSEMBLY_TYPES.includes(x.name) ? e.target.value : x.name }))}>{ASSEMBLY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label><span className="mono">Name</span><input value={f.name} onChange={set('name')} required autoFocus placeholder="e.g. Main control panel" /></label>
              </>
            ) : (
              <>
                <label><span className="mono">What is it</span>
                  <select value={f.kind} onChange={set('kind')}><option value="unit">A single piece</option><option value="lot">A lot (counted, one tag)</option><option value="assembly">An assembly (holds parts)</option></select>
                </label>
                <label><span className="mono">Name</span><input value={f.name} onChange={set('name')} required autoFocus placeholder={f.kind === 'lot' ? 'e.g. Cable ties 200 mm' : f.kind === 'assembly' ? 'e.g. Joint J4' : 'e.g. Fluke multimeter'} /></label>
                {f.kind === 'assembly' && <label><span className="mono">Type</span><select value={f.assemblyType} onChange={set('assemblyType')}>{ASSEMBLY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>}
                {f.kind === 'lot' && <label><span className="mono">Quantity</span><span className="a-qty"><input type="number" min="0" step="any" value={f.quantity} onChange={set('quantity')} required /><input value={f.unit} onChange={set('unit')} aria-label="Unit" /></span></label>}
              </>
            )}
            <label><span className="mono">Make</span><input value={f.make} onChange={set('make')} /></label>
            <label><span className="mono">Model</span><input value={f.model} onChange={set('model')} /></label>
            <label><span className="mono">Serial number</span><input value={f.serial} onChange={set('serial')} /></label>
            <label><span className="mono">Location</span><input value={f.location} onChange={set('location')} placeholder="Where it is on site" /></label>
            <label className="span2"><span className="mono">Notes</span><textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
          </div>
        )}
        <footer className="modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button>
          <button className="btn primary sm" disabled={busy || (mode === 'stock' && (!pick || !(n > 0) || n > pick.quantity || (take.mode === 'unit' && n > 200)))}>{busy ? 'Saving…' : mode === 'stock' ? 'Take from the store' : component ? 'Add component' : 'Register'}</button></footer>
      </form>
    </Modal>
  )
}

function MoveModal({ client, asset, onClose, onSaved, onError }) {
  const [projects, setProjects] = useState(null)
  const [pid, setPid] = useState(asset.projectId || '')
  const [inside, setInside] = useState(null)
  const [parentId, setParentId] = useState(asset.parentId || '')
  useEffect(() => { client.get('/projects').then((r) => setProjects(r.projects), onError) }, [client, onError])
  useEffect(() => {
    if (!pid) { client.get('/assets', { projectId: 'none', kind: 'assembly' }).then((r) => setInside(r.assets), onError); return }
    client.get(`/projects/${pid}/assets`).then((r) => setInside(r.assets.filter((a) => a.kind === 'assembly')), onError)
  }, [client, pid, onError])
  const save = async (e) => {
    e.preventDefault()
    try { const r = await client.post(`/assets/${asset._id}/move`, parentId ? { parentId } : { projectId: pid || null }); onSaved(r) } catch (err) { onError(err) }
  }
  return (
    <Modal title={`Move ${asset.name}`} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <label className="span2"><span className="mono">Project</span>
          <select value={pid} onChange={(e) => { setPid(e.target.value); setParentId('') }}>
            <option value="">In the store (no project)</option>
            {(projects || []).map((p) => <option key={p._id} value={p._id}>{p.ref} · {p.name}</option>)}
          </select>
        </label>
        <label className="span2"><span className="mono">Inside</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{pid ? 'Directly in the project (a component)' : 'On its own'}</option>
            {(inside || []).filter((a) => a._id !== asset._id).map((a) => <option key={a._id} value={a._id}>{a.name} · {a.tag}</option>)}
          </select>
        </label>
        {asset.kind === 'assembly' && <p className="span2 a-explain">Everything inside {asset.name} moves with it.</p>}
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Move</button></footer>
      </form>
    </Modal>
  )
}

function ReturnModal({ client, asset, inside, onClose, onSaved, onError }) {
  const [qty, setQty] = useState(String(asset.quantity || 1))
  const [note, setNote] = useState('')
  const save = async (e) => {
    e.preventDefault()
    try { const r = await client.post(`/assets/${asset._id}/return`, { quantity: asset.kind === 'lot' ? Number(qty) : undefined, note }); onSaved(r) } catch (err) { onError(err) }
  }
  return (
    <Modal title={`Return ${asset.name} to the store`} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        {asset.kind === 'lot' && <label><span className="mono">How many</span><input type="number" min="0" max={asset.quantity} step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label>}
        <label className={asset.kind === 'lot' ? '' : 'span2'}><span className="mono">Why</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. spare, not used" /></label>
        <p className="span2 a-explain">
          {asset.kind === 'assembly' ? <>All {plural(inside, 'part')} inside go back too. </> : null}
          {asset.itemRef ? <>The quantity goes back into stock line <b>{asset.itemRef}</b>{asset.kind === 'lot' && Number(qty) < asset.quantity ? '' : <> and tag {asset.tag} is retired (kept in the history)</>}.</> : <>It stays registered with tag {asset.tag}, in the store.</>}
        </p>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Return</button></footer>
      </form>
    </Modal>
  )
}

function EditModal({ client, asset, onClose, onSaved, onError }) {
  const [f, setF] = useState({ name: asset.name, make: asset.make || '', model: asset.model || '', serial: asset.serial || '', location: asset.location || '', notes: asset.notes || '', assemblyType: asset.assemblyType || 'Other', quantity: asset.quantity, unit: asset.unit || 'pcs' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const save = async (e) => {
    e.preventDefault()
    const body = { ...f }
    if (asset.kind !== 'assembly') delete body.assemblyType
    if (asset.kind !== 'lot' || asset.itemId) delete body.quantity
    try { const r = await client.patch(`/assets/${asset._id}`, body); onSaved(r.asset) } catch (err) { onError(err) }
  }
  return (
    <Modal title={`Edit ${asset.tag}`} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label><span className="mono">Name</span><input value={f.name} onChange={set('name')} required autoFocus /></label>
        {asset.kind === 'assembly' ? <label><span className="mono">Type</span><select value={f.assemblyType} onChange={set('assemblyType')}>{ASSEMBLY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          : asset.kind === 'lot' && !asset.itemId ? <label><span className="mono">Quantity</span><span className="a-qty"><input type="number" step="any" value={f.quantity} onChange={set('quantity')} /><input value={f.unit} onChange={set('unit')} /></span></label> : <span />}
        <label><span className="mono">Make</span><input value={f.make} onChange={set('make')} /></label>
        <label><span className="mono">Model</span><input value={f.model} onChange={set('model')} /></label>
        <label><span className="mono">Serial number</span><input value={f.serial} onChange={set('serial')} /></label>
        <label><span className="mono">Location</span><input value={f.location} onChange={set('location')} /></label>
        <label className="span2"><span className="mono">Notes</span><textarea rows={3} value={f.notes} onChange={set('notes')} /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">Save</button></footer>
      </form>
    </Modal>
  )
}

/** One asset: where it is (path), what it is, what is inside, what happened to it. */
export function AssetPage({ id, client, can, go, onError, notify, version, onBack }) {
  const [d, setD] = useState(null)
  const [form, setForm] = useState(null)
  const load = useCallback(() => client.get(`/assets/${id}`).then(setD, onError), [client, id, onError])
  useEffect(() => { setD(null); load() }, [load, version])
  if (!d) return <div className="page"><div className="loading">Loading…</div></div>
  const { asset: a, project, path, children, inside, item } = d
  const manage = can('assets.manage')
  const live = a.status === 'active' || a.status === 'faulty'
  const done = (msg) => (r) => { setForm(null); if (msg) notify(typeof msg === 'function' ? msg(r) : msg); load() }
  const print = () => client.download('/assets/labels.pdf', { ids: [a._id, ...(children || []).map((c) => c._id)].join(',') }, `${a.tag}-label.pdf`).then(() => notify('Label saved'), onError)
  const setStatus = async (status) => { try { await client.patch(`/assets/${a._id}`, { status }); notify(status === 'faulty' ? 'Marked faulty' : 'Marked in use'); load() } catch (err) { onError(err) } }
  const del = async () => {
    if (!window.confirm(`Delete ${a.tag}? Use this only for a tag made by mistake: the history goes too.${a.itemRef ? ' The quantity goes back into stock.' : ''}`)) return
    try { await client.del(`/assets/${a._id}`); notify(`${a.tag} deleted`, 'muted'); onBack() } catch (err) { onError(err) }
  }
  const facts = [['Kind', a.kind === 'assembly' ? `Assembly · ${a.assemblyType}` : KIND[a.kind]], ['Quantity', a.kind === 'lot' ? `${a.quantity} ${a.unit}` : ''], ['From stock', item ? `${item.ref} · ${item.name}` : a.itemRef], ['Group', GROUP[a.category]], ['Make', a.make], ['Model', a.model], ['Serial number', a.serial], ['Location', a.location], ['Registered', `${fmtDate(a.createdAt)} by ${a.createdBy}`]].filter(([, v]) => v)

  return (
    <div className="page a-page">
      <button className="link-btn back-link" onClick={onBack}><Icon.left />Back</button>
      <nav className="a-path" aria-label="Where it is">
        {project ? <button onClick={() => go('projects', { id: project._id, tab: 'assets' })}>{project.ref} · {project.name}</button> : <span>{live ? 'In the store' : STATUS[a.status]}</span>}
        {path.map((p) => <span key={p._id} className="a-crumb"><Icon.right /><button onClick={() => go('assets', { id: p._id })}>{p.name}</button></span>)}
        <span className="a-crumb"><Icon.right /><b>{a.name}</b></span>
      </nav>
      <header className="a-hero">
        <div className="a-hero-main">
          <KindIcon kind={a.kind} />
          <div>
            <h1>{a.name}</h1>
            <div className="a-hero-meta"><Tag tag={a.tag} big /><span className={`a-st ${a.status}`}>{STATUS[a.status]}</span>{a.kind === 'lot' && <span className="muted">{a.quantity} {a.unit} under this tag</span>}</div>
          </div>
        </div>
        <div className="toolbar">
          <button className="btn sm" onClick={print}><AIcon.print />Label</button>
          {manage && live && <button className="btn sm" onClick={() => setForm('edit')}><Icon.edit />Edit</button>}
          {manage && live && <button className="btn sm" onClick={() => setForm('move')}><AIcon.move />Move</button>}
          {manage && live && <button className="btn sm" onClick={() => setForm('return')}><AIcon.back />Return to store</button>}
          {manage && live && a.kind === 'assembly' && <button className="btn primary sm" onClick={() => setForm('add')}><Icon.plus />Add part</button>}
        </div>
      </header>

      <div className="a-cols">
        <div className="a-col">
          {a.kind === 'assembly' && (
            <section className="card">
              <header className="card-h"><h3>Inside</h3><span className="muted small">{inside ? `${plural(inside, 'tag')} in all` : ''}</span></header>
              {!children.length ? <p className="empty-s">Nothing inside yet.{manage && live ? ' Add parts from the store.' : ''}</p> : (
                <ul className="a-list">
                  {children.map((c) => (
                    <li key={c._id}><button onClick={() => go('assets', { id: c._id })}><KindIcon kind={c.kind} /><span className="a-name"><b>{c.name}</b><small>{c.kind === 'assembly' ? c.assemblyType : [qtyText(c), c.serial && `S/N ${c.serial}`, c.itemRef].filter(Boolean).join(' · ')}</small></span>{c.status === 'faulty' && <span className="a-st faulty">Faulty</span>}<Tag tag={c.tag} /></button></li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <section className="card">
            <header className="card-h"><h3>History</h3></header>
            <ol className="a-hist">
              {[...(a.history || [])].reverse().map((h, i) => <li key={i}><i className={`h-${h.action}`} /><div><b>{h.note}</b><small>{h.by} · {timeAgo(h.at)}</small></div></li>)}
            </ol>
          </section>
        </div>
        <section className="card a-facts">
          <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {a.notes && <p className="a-notes">{a.notes}</p>}
          {manage && live && <div className="a-side-actions">
            {a.status === 'faulty' ? <button className="link-btn sm" onClick={() => setStatus('active')}>Mark as working again</button> : <button className="link-btn sm" onClick={() => setStatus('faulty')}>Mark as faulty</button>}
            {can('assets.delete') && <button className="link-btn sm danger" onClick={del}>Delete (a mistake)</button>}
          </div>}
        </section>
      </div>

      {form === 'add' && <AddModal client={client} project={project} parent={a} onClose={() => setForm(null)} onError={onError} onSaved={done((list) => (list.length === 1 ? `${list[0].name}: tag ${list[0].tag}` : `${list.length} tags made`))} />}
      {form === 'edit' && <EditModal client={client} asset={a} onClose={() => setForm(null)} onError={onError} onSaved={done('Saved')} />}
      {form === 'move' && <MoveModal client={client} asset={a} onClose={() => setForm(null)} onError={onError} onSaved={done((r) => (r.moved > 1 ? `Moved, with ${r.moved - 1} parts inside` : 'Moved'))} />}
      {form === 'return' && <ReturnModal client={client} asset={a} inside={inside} onClose={() => setForm(null)} onError={onError} onSaved={done((r) => `${plural(r.returned, 'tag')} back in the store`)} />}
    </div>
  )
}
