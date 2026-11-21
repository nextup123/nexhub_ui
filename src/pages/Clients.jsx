import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon, Modal, fmtDay, plural } from '../ui'
import { EQUIP_SHORT, EQUIP_ST } from '../records'
import { PHASE, ProjectCard, ProjectForm, SearchResults, openHit } from './Projects'

/** A client: the company, with any number of projects, each with its robots and equipment. */
function ClientForm({ client, item, onClose, onSaved, onError }) {
  const [f, setF] = useState({
    name: item?.name || '', industry: item?.industry || '', city: item?.city || '', address: item?.address || '', gstin: item?.gstin || '', website: item?.website || '', notes: item?.notes || '',
    contacts: item?.contacts?.length ? item.contacts.map((x) => ({ name: x.name || '', role: x.role || '', phone: x.phone || '', email: x.email || '' })) : [{ name: '', role: '', phone: '', email: '' }],
  })
  const contactsHidden = item && !item.canSeeContacts
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setC = (i, k, v) => setF({ ...f, contacts: f.contacts.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })
  const save = async (e) => {
    e.preventDefault()
    const body = { ...f }
    if (contactsHidden) delete body.contacts
    try { const r = item ? await client.patch(`/clients/${item._id}`, body) : await client.post('/clients', body); onSaved(r.client) } catch (err) { onError(err) }
  }
  return (
    <Modal title={item ? `Edit ${item.name}` : 'New client'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label className="span2"><span className="mono">Company name</span><input value={f.name} onChange={set('name')} required autoFocus placeholder="e.g. Verma CNC Works" /></label>
        <label><span className="mono">Industry</span><input value={f.industry} onChange={set('industry')} placeholder="Auto parts, CNC machining, pharma…" /></label>
        <label><span className="mono">City</span><input value={f.city} onChange={set('city')} /></label>
        <label className="span2"><span className="mono">Address</span><input value={f.address} onChange={set('address')} placeholder="Head office or main plant" /></label>
        <label><span className="mono">GSTIN</span><input value={f.gstin} onChange={set('gstin')} /></label>
        <label><span className="mono">Website</span><input value={f.website} onChange={set('website')} /></label>
        {!contactsHidden && (
          <div className="span2 team-edit">
            <span className="mono muted">People to talk to</span>
            {f.contacts.map((x, i) => (
              <div key={i} className="contact-row">
                <input value={x.name} onChange={(e) => setC(i, 'name', e.target.value)} placeholder="Name" aria-label="Name" />
                <input value={x.role} onChange={(e) => setC(i, 'role', e.target.value)} placeholder="Role, e.g. Plant head" aria-label="Role" />
                <input value={x.phone} onChange={(e) => setC(i, 'phone', e.target.value)} placeholder="Phone" aria-label="Phone" />
                <input type="email" value={x.email} onChange={(e) => setC(i, 'email', e.target.value)} placeholder="Email" aria-label="Email" />
                <button type="button" className="icon-btn" onClick={() => setF({ ...f, contacts: f.contacts.filter((_, j) => j !== i) })} aria-label="Remove this contact"><Icon.close /></button>
              </div>
            ))}
            <button type="button" className="link-btn" onClick={() => setF({ ...f, contacts: [...f.contacts, { name: '', role: '', phone: '', email: '' }] })}><Icon.plus />Add a contact</button>
          </div>
        )}
        <label className="span2"><span className="mono">Notes</span><textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Payment terms, shifts, plant rules, who decides…" /></label>
        <footer className="span2 modal-actions"><span className="grow" /><button type="button" className="btn sm" onClick={onClose}>Cancel</button><button className="btn primary sm">{item ? 'Save' : 'Add client'}</button></footer>
      </form>
    </Modal>
  )
}

function ClientPage({ id, client, can, go, params, setParams, people, onError, notify, onBack, version }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [q, setQ] = useState('')
  const [sq, setSq] = useState('')
  const load = useCallback(() => client.get(`/clients/${id}`).then(setData, onError), [client, id, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { const t = setTimeout(() => setSq(q.trim()), 350); return () => clearTimeout(t) }, [q])
  if (!data) return <div className="page"><div className="loading">Loading…</div></div>
  const { client: c, projects, units, equipment } = data
  const active = projects.filter((p) => p.status !== 'closed')
  const openIssues = projects.reduce((n, p) => n + (p.counts?.openIssues || 0), 0)
  const versions = [...new Set(units.map((u) => u.software?.version).filter(Boolean))]

  return (
    <div className="page client-page">
      <button className="link-btn back-link" onClick={onBack}><Icon.left />All clients</button>
      <header className="unit-h">
        <div>
          <span className="mono muted">{c.ref}{c.industry ? ` · ${c.industry}` : ''}</span>
          <h1>{c.name}</h1>
          <p className="muted">{[c.city, c.address].filter(Boolean).join(' · ') || 'No address yet'}</p>
        </div>
        <div className="proj-h-side">
          {can('projects.manage') && <button className="btn sm" onClick={() => setForm('project')}><Icon.plus />New project</button>}
          {c.canEdit && <button className="btn sm" onClick={() => setForm('client')}><Icon.edit />Edit</button>}
        </div>
      </header>

      <div className="proj-stats">
        <div><b>{projects.length}</b><span>{projects.length === 1 ? 'project' : 'projects'}, {active.length} active</span></div>
        <div><b>{units.length}</b><span>{units.length === 1 ? 'robot' : 'robots'}</span></div>
        <div><b>{equipment.length}</b><span>pieces of equipment</span></div>
        <div className={openIssues ? 'hot' : ''}><b>{openIssues}</b><span>open {openIssues === 1 ? 'problem' : 'problems'}</span></div>
      </div>

      <div className="search small client-search"><Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${c.name}’s problems, visits and notes: an error code, a part…`} aria-label="Search this client’s records" />{q && <button className="icon-btn" onClick={() => setQ('')} aria-label="Clear"><Icon.close /></button>}</div>
      {sq ? (
        <SearchResults client={client} q={sq} kind={params.kind} onlyOpen={params.open === 'true'} clientId={id} onError={onError}
          setKind={(k) => setParams({ ...params, kind: k })} setOnlyOpen={(v) => setParams({ ...params, open: v ? 'true' : undefined })} onOpen={(h) => openHit(go, h)} />
      ) : (
        <div className="unit-grid proj-grid">
          <div className="proj-col">
            <section className="card">
              <header className="card-h"><h3><Icon.folder />Projects</h3></header>
              {projects.length === 0 ? <p className="empty-s">No projects yet.</p> : (
                <div className="proj-cards tight">{projects.map((p) => <ProjectCard key={p._id} p={p} hideClient onOpen={() => go('projects', { id: p._id })} />)}</div>
              )}
            </section>
            <section className="card">
              <header className="card-h"><h3><Icon.robot />Robots at {c.name}</h3>{versions.length > 0 && <span className="muted small">Software: {versions.join(', ')}</span>}</header>
              {units.length === 0 ? <p className="empty-s">No robots on its projects yet.</p> : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Serial</th><th>Model</th><th>Project</th><th>Installed</th><th>Software</th><th>Status</th></tr></thead>
                    <tbody>
                      {units.map((u) => (
                        <tr key={u._id} className={can('production.view') ? 'click' : ''} onClick={() => can('production.view') && go('production', { id: u._id })}>
                          <td className="mono">{u.serial}</td>
                          <td>{u.model}{u.colour ? <span className="muted"> · {u.colour}</span> : null}</td>
                          <td><button className="link-btn inline" onClick={(e) => { e.stopPropagation(); go('projects', { id: u.project._id }) }}>{u.project.ref}</button> <span className="muted">{u.project.name}</span></td>
                          <td>{u.installedOn ? fmtDay(u.installedOn, { day: 'numeric', month: 'short', year: 'numeric' }) : <span className="dim">–</span>}</td>
                          <td>{u.software?.version ? <span className="tag mono sw-tag">v{u.software.version}</span> : <span className="dim">–</span>}</td>
                          <td><span className={`phase ph-${u.phase}`}>{PHASE[u.phase]}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="card">
              <header className="card-h"><h3><Icon.factory />Equipment</h3></header>
              {equipment.length === 0 ? <p className="empty-s">No conveyors, SPMs or other equipment listed on its projects.</p> : (
                <ul className="equip-list">
                  {equipment.map((q2) => (
                    <li key={q2._id} className={q2.status === 'removed' ? 'gone' : ''}>
                      <span className={`eq-kind k-${q2.kind}`}>{EQUIP_SHORT[q2.kind] || q2.kind}</span>
                      <span className="eq-main"><b>{q2.name}</b><small>{[q2.make, q2.model].filter(Boolean).join(' · ') || '–'} · <button className="link-btn inline" onClick={() => go('projects', { id: q2.project._id })}>{q2.project.ref}</button></small></span>
                      <span className="eq-side muted small">{q2.status !== 'installed' ? EQUIP_ST[q2.status] : q2.installedOn ? fmtDay(q2.installedOn, { month: 'short', year: 'numeric' }) : ''}</span>
                      <span />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <div className="unit-side">
            <section className="card">
              <header className="card-h"><h3><Icon.users />People to talk to</h3></header>
              {(c.contacts || []).length === 0 ? <p className="empty-s">No contacts yet.</p> : (
                <ul className="people-mini contacts">
                  {c.contacts.map((x, i) => (
                    <li key={i}><span><b>{x.name || '–'}</b><small>{x.role || 'Contact'}</small>
                      {c.canSeeContacts && x.phone && <a href={`tel:${x.phone.replace(/[^\d+]/g, '')}`}><Icon.phone />{x.phone}</a>}
                      {c.canSeeContacts && x.email && <a href={`mailto:${x.email}`}><Icon.mail />{x.email}</a>}</span></li>
                  ))}
                </ul>
              )}
              {!c.canSeeContacts && <p className="muted small">Phone numbers and emails are shown to leads and to the teams of this client’s projects.</p>}
            </section>
            <section className="card">
              <header className="card-h"><h3>Details</h3></header>
              <dl className="facts one">
                <div><dt><Icon.building />Industry</dt><dd>{c.industry || '–'}</dd></div>
                <div><dt><Icon.pin />Address</dt><dd>{[c.address, c.city].filter(Boolean).join(', ') || '–'}</dd></div>
                {c.gstin && <div><dt>GSTIN</dt><dd className="mono">{c.gstin}</dd></div>}
                {c.website && <div><dt>Website</dt><dd><a href={/^https?:/.test(c.website) ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer">{c.website}</a></dd></div>}
                <div><dt><Icon.calendar />Client since</dt><dd>{fmtDay(projects.map((p) => p.startDate).filter(Boolean).sort()[0] || c.createdAt.slice(0, 10), { month: 'long', year: 'numeric' })}</dd></div>
              </dl>
              {c.notes && <p className="pre proj-desc">{c.notes}</p>}
            </section>
            {can('clients.delete') && projects.length === 0 && <button className="link-btn danger" onClick={() => client.del(`/clients/${id}`).then(() => { notify(`${c.name} deleted`, 'muted'); onBack() }, onError)}><Icon.trash />Delete this client</button>}
          </div>
        </div>
      )}
      {form === 'client' && <ClientForm client={client} item={c} onError={onError} onClose={() => setForm(null)} onSaved={() => { setForm(null); notify('Client saved'); load() }} />}
      {form === 'project' && <ProjectForm client={client} people={people} presetClientId={c._id} onError={onError} onClose={() => setForm(null)} onSaved={(p) => { setForm(null); notify(`${p.ref} created`); go('projects', { id: p._id }) }} />}
    </div>
  )
}

export default function Clients({ client, user, can, params, setParams, go, onError, notify, version }) {
  const [list, setList] = useState(null)
  const [people, setPeople] = useState([])
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => client.get('/clients').then((r) => setList(r.clients), onError), [client, onError])
  useEffect(() => { load() }, [load, version])
  useEffect(() => { if (can('projects.manage')) client.get('/users').then((r) => setPeople(r.users.filter((p) => p.active !== false && p.role !== 'hr')), () => {}) }, [client, can])
  const shown = useMemo(() => {
    const w = q.trim().toLowerCase()
    return (list || []).filter((c) => !w || [c.name, c.ref, c.industry, c.city].join(' ').toLowerCase().includes(w))
  }, [list, q])

  if (params.id) {
    return <ClientPage key={params.id} id={params.id} client={client} user={user} can={can} go={go} params={params} setParams={setParams} people={people} onError={onError} notify={notify} version={version} onBack={() => { setParams({}); load() }} />
  }
  const robots = (list || []).reduce((n, c) => n + (c.counts?.robots || 0), 0)
  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">Clients</span><h1>{list ? <>{plural(list.length, 'client')}<span className="muted">, {plural(robots, 'robot')} on site.</span></> : 'Clients'}</h1></div>
        {can('clients.manage') && <button className="btn primary" onClick={() => setCreating(true)}><Icon.plus />New client</button>}
      </header>
      <div className="search"><Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a client by name, industry or city" aria-label="Find a client" /></div>
      {!list ? <div className="loading">Loading…</div> : shown.length === 0 ? (
        <div className="card empty"><Icon.building /><b>{list.length ? 'No client matches' : 'No clients yet'}</b><span className="muted">{list.length ? 'Try another name.' : 'Clients are made when a project names a customer, or add one with “New client”.'}</span></div>
      ) : (
        <div className="client-cards">
          {shown.map((c) => (
            <button key={c._id} className="ccard" onClick={() => setParams({ id: c._id })}>
              <span className="pc-top"><span className="mono muted">{c.ref}</span>{c.counts?.active ? <span className="pill tone-good"><i />{c.counts.active} active</span> : null}</span>
              <b className="pc-name">{c.name}</b>
              <span className="pc-cust">{[c.industry, c.city].filter(Boolean).join(' · ') || '–'}</span>
              <span className="cc-counts"><span><b>{c.counts?.projects || 0}</b> {c.counts?.projects === 1 ? 'project' : 'projects'}</span><span><b>{c.counts?.robots || 0}</b> {c.counts?.robots === 1 ? 'robot' : 'robots'}</span></span>
            </button>
          ))}
        </div>
      )}
      {creating && <ClientForm client={client} onError={onError} onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); notify(`${c.name} added`); load(); setParams({ id: c._id }) }} />}
    </div>
  )
}
