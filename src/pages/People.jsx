import { useCallback, useEffect, useMemo, useState } from 'react'
import { Avatar, Icon, Modal, RoleBadge, ROLE_LABEL, fmtDay, isTop, timeAgo } from '../ui'

const ROLE_HELP = {
  founder: 'Everything, including deleting enquiries and robots',
  hr: 'Everything a founder can do: people, attendance, leave, projects, deletes, and giving lead powers',
  lead: 'Runs a team: production, bug triage, website enquiries, the team’s leave',
  employee: 'Own attendance and leave, calendar, production stages given to them, bug reports',
}

function PersonForm({ client, me, can, person, teams, onClose, onSaved, onError }) {
  const [f, setF] = useState(person
    ? { name: person.name, email: person.email, phone: person.phone, role: person.role, team: person.team, title: person.title, active: person.active, hr: { employeeId: '', joinedOn: '', emergencyContact: '', ...(person.hr || {}) } }
    : { name: '', email: '', phone: '', role: 'employee', team: '', title: '', active: true, hr: { employeeId: '', joinedOn: '', emergencyContact: '' } })
  const [temp, setTemp] = useState(null)
  const roles = Object.keys(ROLE_LABEL).filter((r) => isTop(me) || r !== 'founder')
  const save = async (e) => {
    e.preventDefault()
    try {
      const body = { ...f, hr: { ...f.hr, joinedOn: f.hr.joinedOn || '' } }
      if (person) { await client.patch(`/users/${person._id}`, body); onSaved(`${f.name} updated`) } else { const r = await client.post('/users', body); setTemp({ name: r.user.name, email: r.user.email, password: r.temporaryPassword }) }
    } catch (err) { onError(err) }
  }
  const reset = async () => {
    try { const r = await client.post(`/users/${person._id}/password`); setTemp({ name: person.name, email: person.email, password: r.temporaryPassword, reset: true }) } catch (err) { onError(err) }
  }
  const [busy, setBusy] = useState(false)
  const setLeadPowers = async (grant) => {
    setBusy(true)
    try {
      await client.post(`/users/${person._id}/lead-powers`, { grant })
      onSaved(grant ? `${person.name} now has lead powers` : `Lead powers taken back from ${person.name}`)
    } catch (err) { onError(err) } finally { setBusy(false) }
  }
  if (temp) {
    return (
      <Modal title={temp.reset ? 'New temporary password' : `${temp.name} can sign in now`} onClose={() => onSaved(temp.reset ? 'Password reset' : `${temp.name} added`)}>
        <div className="temp">
          <p>Give {temp.name.split(' ')[0]} these details. They choose their own password the first time they sign in. This password is shown only once.</p>
          <dl><div><dt className="mono">Email</dt><dd>{temp.email}</dd></div><div><dt className="mono">Temporary password</dt><dd className="mono big">{temp.password}</dd></div></dl>
          <footer className="modal-actions"><span className="grow" /><button className="btn sm" onClick={() => navigator.clipboard?.writeText(`${temp.email}\n${temp.password}`)}>Copy</button><button className="btn primary sm" onClick={() => onSaved(temp.reset ? 'Password reset' : `${temp.name} added`)}>Done</button></footer>
        </div>
      </Modal>
    )
  }
  const self = person && person._id === me._id
  return (
    <Modal title={person ? `Edit ${person.name}` : 'Add a person'} onClose={onClose} wide>
      <form className="form-grid" onSubmit={save}>
        <label><span className="mono">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required autoFocus /></label>
        <label><span className="mono">Work email (to sign in)</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
        <label><span className="mono">Role</span>
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} disabled={self}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </label>
        <label><span className="mono">Team</span><input list="teams" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })} placeholder="Production, Software, Sales…" /><datalist id="teams">{teams.map((t) => <option key={t} value={t} />)}</datalist></label>
        <p className="span2 role-help"><RoleBadge role={f.role} /> {ROLE_HELP[f.role]}{f.role === 'lead' ? `. Leads look after everyone in the same team${f.team ? ` (${f.team})` : ''}.` : ''}</p>
        {person && !self && person.role === 'employee' && f.role === 'employee' && can('users.grant_lead') && (
          <div className="span2 lead-powers">
            <div className="lp-row"><b>Lead powers</b><RoleBadge role="employee" leadPowers={!!person.leadPowers} /></div>
            <p>{person.leadPowers
              ? `${person.name.split(' ')[0]} can do everything a lead can: create and run projects, clients, production and assets, and look after the ${person.team || 'same'} team’s attendance and leave. Given by ${person.leadPowers.by || 'a founder'}${person.leadPowers.at ? ` on ${fmtDay(String(person.leadPowers.at).slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}.`
              : `For someone who leads a team but stays an Employee. They get everything a lead can do (create projects, full access to assets and resources, their team’s attendance and leave) until you take it back.`}</p>
            <div className="lp-row">
              {person.leadPowers
                ? <button type="button" className="btn sm" disabled={busy} onClick={() => setLeadPowers(false)}>Take back lead powers</button>
                : <button type="button" className="btn primary sm" disabled={busy} onClick={() => setLeadPowers(true)}>Give lead powers</button>}
            </div>
          </div>
        )}
        <label><span className="mono">Job title</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <label><span className="mono">Phone</span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <div className="span2 hr-block">
          <span className="mono muted">HR records <small>(seen by HR, founders and the person)</small></span>
          <div className="form-grid compact">
            <label><span className="mono">Employee id</span><input value={f.hr.employeeId || ''} onChange={(e) => setF({ ...f, hr: { ...f.hr, employeeId: e.target.value } })} /></label>
            <label><span className="mono">Joined on</span><input type="date" value={f.hr.joinedOn || ''} onChange={(e) => setF({ ...f, hr: { ...f.hr, joinedOn: e.target.value } })} /></label>
            <label className="span2"><span className="mono">Emergency contact</span><input value={f.hr.emergencyContact || ''} onChange={(e) => setF({ ...f, hr: { ...f.hr, emergencyContact: e.target.value } })} placeholder="Name, relation, phone" /></label>
          </div>
        </div>
        <footer className="span2 modal-actions">
          {person && !self && <button type="button" className="btn sm" onClick={() => setF({ ...f, active: !f.active })}>{f.active ? 'Switch off account' : 'Switch account back on'}</button>}
          {person && <button type="button" className="btn sm" onClick={reset}><Icon.key />Reset password</button>}
          <span className="grow" />
          {!f.active && <span className="bad-text small">Will be signed out and hidden from lists</span>}
          <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
          <button className="btn primary sm">{person ? 'Save' : 'Add and get password'}</button>
        </footer>
      </form>
    </Modal>
  )
}

export default function People({ client, user, can, onError, notify, version }) {
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [showOff, setShowOff] = useState(false)
  const manage = can('users.manage')
  const load = useCallback(() => client.get('/users', { all: manage ? 'true' : undefined }).then((r) => setList(r.users), onError), [client, manage, onError])
  useEffect(() => { load() }, [load, version])
  const teams = useMemo(() => [...new Set((list || []).map((p) => p.team).filter(Boolean))].sort(), [list])
  const shown = (list || []).filter((p) => (showOff || p.active) && (!q || [p.name, p.email, p.team, p.title, p.role].some((x) => String(x || '').toLowerCase().includes(q.toLowerCase()))))
  const byTeam = teams.map((t) => [t, shown.filter((p) => p.team === t)]).concat([['No team', shown.filter((p) => !p.team)]]).filter(([, l]) => l.length)
  const counts = Object.keys(ROLE_LABEL).map((r) => [r, (list || []).filter((p) => p.active && p.role === r).length])
  const powered = (list || []).filter((p) => p.active && p.role === 'employee' && p.leadPowers).length

  return (
    <div className="page">
      <header className="page-h">
        <div><span className="mono muted">{manage ? 'People' : 'Directory'}</span><h1>{list ? list.filter((p) => p.active).length : '…'} people <span className="muted">at Nextup.</span></h1></div>
        {manage && <button className="btn primary" onClick={() => setForm({})}><Icon.plus />Add a person</button>}
      </header>
      <div className="toolbar between">
        <div className="toolbar">
          <div className="search small"><Icon.search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, team, role…" aria-label="Search people" /></div>
          {manage && <button className={`chip${showOff ? ' on' : ''}`} onClick={() => setShowOff(!showOff)}>Show switched-off accounts</button>}
        </div>
        <div className="role-counts">{counts.map(([r, n]) => <span key={r}><RoleBadge role={r} /> {n}</span>)}{powered > 0 && <span><span className="role role-lead">+ Lead powers</span> {powered}</span>}</div>
      </div>
      {!list ? <div className="loading">Loading…</div> : byTeam.map(([team, people]) => (
        <section key={team} className="team-block">
          <h3 className="team-h">{team} <span className="mono muted">{people.length}</span></h3>
          <div className="pgrid">
            {people.map((p) => (
              <article key={p._id} className={`pcard${p.active ? '' : ' off'}`}>
                <Avatar name={p.name} size={46} />
                <div className="pc-main">
                  <b>{p.name}{p._id === user._id && <span className="muted"> (you)</span>}</b>
                  <small>{p.title || '–'}</small>
                  <RoleBadge role={p.role} leadPowers={!!p.leadPowers} />
                </div>
                <div className="pc-contact">
                  <a href={`mailto:${p.email}`}><Icon.mail />{p.email}</a>
                  {p.phone && <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`}><Icon.phone />{p.phone}</a>}
                  {p.hr?.joinedOn && <span className="muted small">Joined {fmtDay(p.hr.joinedOn, { month: 'short', year: 'numeric' })}{p.hr.employeeId ? ` · ${p.hr.employeeId}` : ''}</span>}
                  {manage && <span className="muted small">{!p.active ? 'Switched off' : p.mustChangePassword ? 'Has not signed in yet' : p.lastLoginAt ? `Last signed in ${timeAgo(p.lastLoginAt)}` : ''}</span>}
                </div>
                {manage && (p.role !== 'founder' || isTop(user)) && <button className="icon-btn pc-edit" onClick={() => setForm({ person: p })} aria-label={`Edit ${p.name}`}><Icon.settings /></button>}
              </article>
            ))}
          </div>
        </section>
      ))}
      {form && <PersonForm client={client} me={user} can={can} person={form.person} teams={teams} onError={onError} onClose={() => setForm(null)} onSaved={(msg) => { setForm(null); notify(msg); load() }} />}
    </div>
  )
}
