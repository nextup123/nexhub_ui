import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, Icon, STATUS, StatusPill, timeAgo, useTick } from './ui'
import Detail from './Detail'

// The choices on the website's contact form (src/data/products.js and content.js there).
const PRODUCTS = ['NexC5', 'NexR10', 'NexR20', 'Custom automation', 'Not sure yet']
const INDUSTRIES = ['Metal fabrication and casting', 'Automotive and auto components', 'Coating and finishing', 'CNC machining', 'Glass processing', 'General manufacturing', 'Other']
const RANGES = { '': 'Any time', 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' }
const TITLES = { inbox: 'All enquiries', open: 'Waiting for a reply' }

export default function Inbox({ client, params, go, version, onError, onChanged, toast }) {
  useTick()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState(params.q || '')
  const searchRef = useRef(null)
  const listRef = useRef(null)
  const page = Number(params.page) || 1
  const set = useCallback((patch) => go('inbox', { ...params, page: undefined, ...patch }), [go, params])

  const filters = {
    status: params.status || 'inbox',
    product: params.product, industry: params.industry,
    starred: params.starred, unread: params.unread, q: params.q,
    from: params.range ? new Date(Date.now() - Number(params.range) * 864e5).toISOString() : undefined,
    sort: params.sort, page, limit: 40,
  }
  const key = JSON.stringify(filters)

  const load = useCallback(async () => {
    setBusy(true)
    try { setData(await client.list(JSON.parse(key))) } catch (err) { onError(err) } finally { setBusy(false) }
  }, [client, key, onError])
  useEffect(() => { load() }, [load, version])

  // Search as you type, after a short pause.
  useEffect(() => {
    if ((params.q || '') === q) return undefined
    const t = setTimeout(() => set({ q }), 300)
    return () => clearTimeout(t)
  }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const list = data?.submissions || []
  const open = (id) => set({ id, page: params.page })
  const selectedIndex = list.findIndex((s) => s._id === params.id)

  // Keyboard: j / k to move, / to search, Esc to close.
  useEffect(() => {
    const onKey = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return }
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape' && params.id) set({ id: undefined, page: params.page })
      if ((e.key === 'j' || e.key === 'ArrowDown') && list.length) { e.preventDefault(); open(list[Math.min(list.length - 1, selectedIndex + 1)]._id) }
      if ((e.key === 'k' || e.key === 'ArrowUp') && list.length) { e.preventDefault(); open(list[Math.max(0, selectedIndex - 1)]._id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  useEffect(() => { listRef.current?.querySelector('.row.sel')?.scrollIntoView({ block: 'nearest' }) }, [params.id])

  // Keep the row in step when the detail pane changes something.
  const updated = useCallback((doc) => {
    setData((d) => d && ({ ...d, submissions: d.submissions.map((s) => (s._id === doc._id ? { ...s, ...doc } : s)) }))
    onChanged()
  }, [onChanged])
  const removed = useCallback((id) => {
    setData((d) => d && ({ ...d, total: d.total - 1, submissions: d.submissions.filter((s) => s._id !== id) }))
    set({ id: undefined, page: params.page })
    onChanged()
  }, [onChanged, set, params.page])

  const title = params.starred === 'true' ? 'Starred' : TITLES[filters.status] || STATUS[filters.status]?.label || 'Enquiries'
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const filtered = params.product || params.industry || params.range || params.q || params.unread

  return (
    <div className={`inbox${params.id ? ' has-detail' : ''}`}>
      <section className="list-pane">
        <header className="list-h">
          <div className="list-title">
            <h1>{title}</h1>
            <span className="mono muted">{data ? `${data.total} ${data.total === 1 ? 'enquiry' : 'enquiries'}` : '…'}{busy && data ? ' · updating' : ''}</span>
          </div>
          <div className="search">
            <Icon.search />
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, email, message…  ( / )" aria-label="Search" />
          </div>
          <div className="filters">
            <select value={params.product || ''} onChange={(e) => set({ product: e.target.value })} aria-label="Product">
              <option value="">All products</option>{PRODUCTS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={params.industry || ''} onChange={(e) => set({ industry: e.target.value })} aria-label="Industry">
              <option value="">All industries</option>{INDUSTRIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <select value={params.range || ''} onChange={(e) => set({ range: e.target.value })} aria-label="Date range">
              {Object.entries(RANGES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className={`chip${params.unread === 'true' ? ' on' : ''}`} onClick={() => set({ unread: params.unread === 'true' ? undefined : 'true' })}>Unread</button>
            <button className="chip" onClick={() => set({ sort: params.sort === 'oldest' ? undefined : 'oldest' })}>{params.sort === 'oldest' ? 'Oldest first' : 'Newest first'}</button>
            {filtered && <button className="chip clear" onClick={() => { setQ(''); go('inbox', { status: params.status, starred: params.starred }) }}>Clear filters</button>}
            <button className="chip end" onClick={() => client.exportCsv({ ...filters, page: undefined, limit: undefined }).catch(onError)} title="Download what is listed as a spreadsheet (CSV)"><Icon.download />Export CSV</button>
          </div>
        </header>

        <div className="rows" ref={listRef}>
          {!data ? <div className="loading">Loading…</div> : list.length === 0 ? (
            <div className="empty">
              <Icon.inbox />
              <b>{filtered ? 'Nothing matches these filters' : 'No enquiries here yet'}</b>
              <span className="muted">{filtered ? 'Try clearing the search or filters.' : 'New messages from the website’s contact page show up here.'}</span>
            </div>
          ) : list.map((s) => (
            <button key={s._id} className={`row${s._id === params.id ? ' sel' : ''}${s.readAt ? '' : ' unread'}`} onClick={() => open(s._id)}>
              <Avatar name={s.name} size={38} />
              <span className="row-main">
                <span className="row-top">
                  <b>{s.name}</b>
                  {s.company && <span className="row-co">{s.company}</span>}
                  <span className="row-time">{timeAgo(s.createdAt)}</span>
                </span>
                <span className="row-msg">{s.message}</span>
                <span className="row-meta">
                  <StatusPill status={s.status} />
                  {s.product && <span className="tag">{s.product}</span>}
                  {s.industry && <span className="tag ghost">{s.industry}</span>}
                  {s.starred && <span className="star-on" aria-label="Starred"><Icon.star on /></span>}
                  <span className="mono muted ref">{s.ref}</span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {data && pages > 1 && (
          <footer className="pager">
            <button className="chip" disabled={page <= 1} onClick={() => set({ page: page - 1 })}>Previous</button>
            <span className="mono muted">Page {page} of {pages}</span>
            <button className="chip" disabled={page >= pages} onClick={() => set({ page: page + 1 })}>Next</button>
          </footer>
        )}
      </section>

      <section className="detail-pane">
        {params.id
          ? <Detail key={params.id} version={version} id={params.id} client={client} onError={onError} onUpdated={updated} onRemoved={removed} toast={toast}
              onClose={() => set({ id: undefined, page: params.page })} onOpen={(id) => set({ id })} />
          : <div className="empty detail-empty"><Icon.mail /><b>Pick an enquiry to read it</b><span className="muted">Use <kbd>j</kbd> and <kbd>k</kbd> to move through the list.</span></div>}
      </section>
    </div>
  )
}
