import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, plural, timeAgo } from '../ui'
import { AIcon, AddModal, AssetPage, AssignModal, GROUPS, KindIcon, STATUS, Tag } from '../assets'

/**
 * Assets: the whole inventory in front of you. Tick what a project needs (CPU, mouse, servo drives, bolts…)
 * and "Assign to project" moves it out of the store in one go, each piece with its tag.
 * The "Find a tag" tab opens any tag. A project's tree is on its Assets tab.
 */
export default function Assets(props) {
  const { params } = props
  if (params.id) return <AssetPage {...props} id={params.id} onBack={() => window.history.back()} />
  return <AssetsHome {...props} />
}

const GROUP_NAME = Object.fromEntries(GROUPS)

function AssetsHome({ client, can, go, params, setParams, onError, notify, version }) {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState(params.q || '')
  const [cat, setCat] = useState(params.cat || '')
  const [sel, setSel] = useState(() => new Map())
  const [assign, setAssign] = useState(false)
  const [tab, setTab] = useState('store')
  const [tagQ, setTagQ] = useState('')
  const manage = can('assets.manage')
  useEffect(() => { client.get('/inventory').then((r) => setItems(r.items), onError) }, [client, onError, version])
  useEffect(() => { setParams({ q: q || undefined, cat: cat || undefined }) }, [q, cat]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { '': items?.length || 0 }
    ;(items || []).forEach((i) => { c[i.category] = (c[i.category] || 0) + 1 })
    return c
  }, [items])
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return (items || []).filter((s) => (!cat || s.category === cat) && (!w.length || w.every((x) => [s.ref, s.name, s.type, s.make, s.model, s.location].join(' ').toLowerCase().includes(x))))
  }, [items, q, cat])
  const toggle = (s) => setSel((m) => { const n = new Map(m); if (n.has(s._id)) n.delete(s._id); else n.set(s._id, '1'); return n })
  const pickable = shown.filter((s) => s.quantity)
  const allOn = pickable.length > 0 && pickable.every((s) => sel.has(s._id))
  const toggleAll = () => setSel((m) => { const n = new Map(m); pickable.forEach((s) => (allOn ? n.delete(s._id) : n.has(s._id) || n.set(s._id, '1'))); return n })
  const totals = useMemo(() => (items || []).reduce((a, i) => ({ store: a.store + (i.quantity || 0), out: a.out + (i.inProjects || 0) }), { store: 0, out: 0 }), [items])

  return (
    <div className="page a-home">
      <header className="page-h">
        <div><span className="mono muted">Everything in the store, and where it went</span><h1>Assets</h1></div>
        {manage && <button className="btn primary" onClick={() => setAssign(true)}><Icon.arrow />Assign to project{sel.size ? ` · ${sel.size}` : ''}</button>}
      </header>

      <div className="seg-ctl a-tabs" role="tablist">
        <button className={tab === 'store' ? 'on' : ''} onClick={() => setTab('store')}>Store{items ? ` · ${items.length}` : ''}</button>
        <button className={tab === 'tags' ? 'on' : ''} onClick={() => { setTagQ(''); setTab('tags') }}>Find a tag</button>
      </div>

      {tab === 'store' ? (
        <section className="card st-card">
          <div className="st-top">
            <div className="search"><Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: monitor, servo, M6, EE-4…" aria-label="Search the store" /></div>
            {items && <p className="muted small">{totals.store} pieces in the store · {totals.out} out in projects</p>}
          </div>
          <div className="as-chips st-chips">
            {GROUPS.map(([k, l]) => <button key={k} className={cat === k ? 'on' : ''} onClick={() => setCat(k)}>{l}{items ? <small> {counts[k] || 0}</small> : null}</button>)}
          </div>
          {!items ? <p className="loading">Loading the store…</p> : !items.length ? (
            <p className="empty-s">The store is empty. Add things in the inventory app (or the Inventory page) and they show up here.</p>
          ) : (
            <div className="st-table" role="table">
              <div className="st-row st-h" role="row">
                {manage ? <label className="st-c"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Pick all shown" /></label> : <span />}
                <span>Item</span><span className="st-n">In store</span><span className="st-n">In projects</span>
              </div>
              {!shown.length && <p className="empty-s">Nothing matches.</p>}
              {shown.map((s) => (
                <div key={s._id} className={`st-row${sel.has(s._id) ? ' on' : ''}`} role="row">
                  {manage ? <label className="st-c"><input type="checkbox" checked={sel.has(s._id)} onChange={() => toggle(s)} disabled={!s.quantity && !sel.has(s._id)} aria-label={`Pick ${s.name}`} /></label> : <span />}
                  <span className="st-name" onClick={() => manage && s.quantity && toggle(s)}><b>{s.name}</b><small>{[s.ref, GROUP_NAME[s.category], [s.make, s.model].filter(Boolean).join(' '), s.location].filter(Boolean).join(' · ')}</small></span>
                  <span className={`st-n${!s.quantity ? ' zero' : s.low ? ' low' : ''}`}>{s.quantity} <small>{s.unit}</small></span>
                  <span className="st-n">{s.inProjects ? <button className="link-btn" title="See the tags" onClick={() => { setTagQ(s.ref); setTab('tags') }}>{s.inProjects}</button> : <span className="muted">–</span>}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <TagFinder key={tagQ} initial={tagQ} client={client} go={go} onError={onError} notify={notify} manage={manage} version={version} />
      )}

      {manage && sel.size > 0 && tab === 'store' && (
        <div className="st-bar" role="status">
          <span><b>{plural(sel.size, 'item')}</b> picked</span>
          <button className="btn sm" onClick={() => setSel(new Map())}>Clear</button>
          <button className="btn primary sm" onClick={() => setAssign(true)}><Icon.arrow />Assign to project</button>
        </div>
      )}
      {assign && <AssignModal client={client} selected={sel} items={items} onClose={() => setAssign(false)} onError={onError}
        onSaved={(r) => { setAssign(false); setSel(new Map()); notify(`${plural(r.pieces, 'piece')} moved to ${r.project.ref}${r.parent ? ` › ${r.parent.name}` : ''}`); client.get('/inventory').then((x) => setItems(x.items), onError) }} />}
    </div>
  )
}

/** Find anything by its tag (typed or scanned from a label), or search names, serials and stock refs. */
function TagFinder({ client, go, onError, notify, manage, version, initial }) {
  const [q, setQ] = useState(initial)
  const [list, setList] = useState(null)
  const [store, setStore] = useState(null)
  const [hint, setHint] = useState('')
  const [adding, setAdding] = useState(false)
  const input = useRef(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const t = setTimeout(() => client.get('/assets', { q, limit: 60, status: q ? 'all' : undefined }).then((r) => setList(r.assets), onError), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, client, onError, version])
  useEffect(() => { client.get('/assets', { projectId: 'none', limit: 100 }).then((r) => setStore(r.assets), onError) }, [client, onError, version])
  const lookup = async (e) => {
    e.preventDefault()
    setHint('')
    if (!/\d/.test(q)) return
    try { const r = await client.get(`/assets/tag/${encodeURIComponent(q.trim())}`); go('assets', { id: r.asset._id }) } catch (err) {
      if (err.status === 400 || err.status === 404) setHint(err.message); else onError(err)
    }
  }
  return (
    <>
      <form className="a-find" onSubmit={lookup}>
        <AIcon.tag />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setHint('') }} placeholder="Type or scan a tag (NX-000123-K), or search a name or serial" aria-label="Find an asset" />
        <button className="btn primary sm" disabled={!/\d/.test(q)}>Open tag</button>
      </form>
      {hint && <p className="a-hint">{hint}</p>}
      <section className="card">
        <header className="card-h"><h3>{q ? 'Found' : 'Recently tagged'}</h3>{list && <span className="muted small">{plural(list.length, 'tag')}</span>}</header>
        <AssetList list={list} go={go} />
      </section>
      {store && (store.length > 0 || manage) && (
        <section className="card">
          <header className="card-h"><h3>Registered on their own</h3>{manage && <button className="btn sm" onClick={() => setAdding(true)}><Icon.plus />Register a tool or machine</button>}</header>
          <AssetList list={store} go={go} empty="Tools and machines you want to track one by one (a multimeter, a VMC) can be registered here with their own tag." />
        </section>
      )}
      {adding && <AddModal client={client} project={null} parent={null} onClose={() => setAdding(false)} onError={onError} onSaved={(l) => { setAdding(false); notify(`${l[0].name}: tag ${l[0].tag}`); go('assets', { id: l[0]._id }) }} />}
    </>
  )
}

function AssetList({ list, go, empty = 'Nothing here.' }) {
  if (!list) return <p className="loading">Loading…</p>
  if (!list.length) return <p className="empty-s">{empty}</p>
  return (
    <ul className="a-list">
      {list.map((a) => (
        <li key={a._id}>
          <button onClick={() => go('assets', { id: a._id })}>
            <KindIcon kind={a.kind} />
            <span className="a-name"><b>{a.name}</b><small>{[a.project ? `${a.project.ref} · ${a.project.name}` : 'Store', a.kind === 'lot' ? `${a.quantity} ${a.unit}` : '', a.serial && `S/N ${a.serial}`, timeAgo(a.createdAt)].filter(Boolean).join(' · ')}</small></span>
            {a.status !== 'active' && <span className={`a-st ${a.status}`}>{STATUS[a.status]}</span>}
            <Tag tag={a.tag} />
          </button>
        </li>
      ))}
    </ul>
  )
}
