import { useEffect, useRef, useState } from 'react'
import { Icon, plural, timeAgo } from '../ui'
import { AIcon, AddModal, AssetPage, KindIcon, STATUS, Tag } from '../assets'

/**
 * Assets: find anything by its tag (typed or scanned from a label), search by name or serial,
 * and see what is registered in the store. A project's tree is on the project's Assets tab.
 */
export default function Assets(props) {
  const { client, can, go, params, setParams, onError, notify, version } = props
  if (params.id) return <AssetPage {...props} id={params.id} onBack={() => window.history.back()} />
  return <AssetsHome client={client} can={can} go={go} params={params} setParams={setParams} onError={onError} notify={notify} version={version} />
}

function AssetsHome({ client, can, go, params, setParams, onError, notify, version }) {
  const [q, setQ] = useState(params.q || '')
  const [list, setList] = useState(null)
  const [store, setStore] = useState(null)
  const [hint, setHint] = useState('')
  const [adding, setAdding] = useState(false)
  const input = useRef(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      setParams({ q: q || undefined })
      client.get('/assets', { q, limit: 60, status: q ? 'all' : undefined }).then((r) => setList(r.assets), onError)
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, client]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { client.get('/assets', { projectId: 'none', limit: 100 }).then((r) => setStore(r.assets), onError) }, [client, onError, version])

  // Enter on a tag opens it straight away (a label scanner types the tag and presses Enter).
  const lookup = async (e) => {
    e.preventDefault()
    setHint('')
    if (!/\d/.test(q)) return
    try { const r = await client.get(`/assets/tag/${encodeURIComponent(q.trim())}`); go('assets', { id: r.asset._id }) } catch (err) {
      if (err.status === 400 || err.status === 404) setHint(err.message); else onError(err)
    }
  }
  return (
    <div className="page a-home">
      <header className="page-h">
        <div><span className="mono muted">Every part, with its own tag</span><h1>Assets</h1></div>
        {can('assets.manage') && <button className="btn sm" onClick={() => setAdding(true)}><Icon.plus />Register in the store</button>}
      </header>
      <form className="a-find" onSubmit={lookup}>
        <AIcon.tag />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setHint('') }} placeholder="Type or scan a tag (NX-000123-K), or search a name, serial, stock ref" aria-label="Find an asset" />
        <button className="btn primary sm" disabled={!/\d/.test(q)}>Open tag</button>
      </form>
      {hint && <p className="a-hint">{hint}</p>}
      <p className="muted small a-how">Projects hold components (panel, robot arm, computer), components hold parts, and every part has a tag down to a lot of bolts. Open a project's <b>Assets</b> tab to see and build its tree.</p>

      <section className="card">
        <header className="card-h"><h3>{q ? 'Found' : 'Recently tagged'}</h3>{list && <span className="muted small">{plural(list.length, 'asset')}</span>}</header>
        <AssetList list={list} go={go} />
      </section>
      {!q && (
        <section className="card">
          <header className="card-h"><h3>In the store</h3><span className="muted small">Registered, not on a project</span></header>
          <AssetList list={store} go={go} empty="Nothing registered on its own. Tools and machines you want to track (a multimeter, a VMC) can be registered here." />
        </section>
      )}
      {adding && <AddModal client={client} project={null} parent={null} onClose={() => setAdding(false)} onError={onError} onSaved={(l) => { setAdding(false); notify(`${l[0].name}: tag ${l[0].tag}`); go('assets', { id: l[0]._id }) }} />}
    </div>
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
