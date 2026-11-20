import { useEffect, useState } from 'react'
import { Avatar, Icon, STATUS, STATUS_ORDER, StatusPill, fmtDateTime, timeAgo } from './ui'

export default function Detail({ id, client, onError, onUpdated, onRemoved, onClose, onOpen, toast, version }) {
  const [doc, setDoc] = useState(null)
  const [related, setRelated] = useState([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let live = true
    client.get(id).then(async (r) => {
      if (!live) return
      setDoc(r.submission)
      setRelated(r.related)
      // Opening an enquiry marks it read.
      if (!r.submission.readAt) {
        const u = await client.patch(id, { read: true })
        if (live) { setDoc(u.submission); onUpdated(u.submission) }
      }
    }).catch((err) => { if (live) onError(err) })
    return () => { live = false }
  }, [id, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body, message) => {
    setSaving(true)
    try {
      const u = await client.patch(id, body)
      setDoc(u.submission)
      onUpdated(u.submission)
      if (message) toast({ text: message, tone: 'good' })
    } catch (err) { onError(err) } finally { setSaving(false) }
  }

  const addNote = async (e) => {
    e.preventDefault()
    if (!note.trim()) return
    try {
      const { note: n } = await client.note(id, note.trim())
      setDoc((d) => ({ ...d, notes: [...(d.notes || []), n] }))
      setNote('')
    } catch (err) { onError(err) }
  }

  const remove = async () => {
    try {
      await client.remove(id)
      toast({ text: `${doc.ref} deleted`, tone: 'muted' })
      onRemoved(id)
    } catch (err) { onError(err) }
  }

  if (!doc) return <div className="detail"><div className="loading">Loading…</div></div>

  const first = doc.name.split(' ')[0]
  const subject = `Your enquiry to Nextup Robotics (${doc.ref})`
  const body = `Hi ${first},\n\nThank you for contacting Nextup Robotics about ${doc.product && doc.product !== 'Not sure yet' ? `the ${doc.product}` : 'automating your process'}.\n\n\n\nBest regards,\nNextup Robotics\n\n> ${doc.message.split('\n').join('\n> ')}`
  const mailto = doc.email && `mailto:${doc.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const phoneDigits = (doc.phone || '').replace(/\D/g, '')
  const wa = phoneDigits && `https://wa.me/${phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits}?text=${encodeURIComponent(`Hi ${first}, this is Nextup Robotics about your enquiry ${doc.ref}.`)}`
  const timeline = [
    ...(doc.statusHistory || []).map((h) => ({ at: h.at, kind: 'status', h })),
    ...(doc.notes || []).map((n) => ({ at: n.at, kind: 'note', n })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  return (
    <article className="detail">
      <header className="detail-h">
        <button className="icon-btn back" onClick={onClose} aria-label="Back to the list"><Icon.back /></button>
        <span className="mono muted">{doc.ref}</span>
        <div className="detail-tools">
          <button className={`icon-btn${doc.starred ? ' starred' : ''}`} onClick={() => patch({ starred: !doc.starred })} aria-label={doc.starred ? 'Unstar' : 'Star'} title="Star"><Icon.star on={doc.starred} /></button>
          <button className="icon-btn" onClick={() => patch({ read: false }, 'Marked unread')} title="Mark unread" aria-label="Mark unread"><Icon.mail /></button>
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} title="Delete" aria-label="Delete"><Icon.trash /></button>
          <button className="icon-btn close" onClick={onClose} aria-label="Close"><Icon.close /></button>
        </div>
      </header>

      {confirmDelete && (
        <div className="confirm" role="alertdialog">
          <span>Delete {doc.ref} from {doc.name} for good? This cannot be undone.</span>
          <button className="btn danger sm" onClick={remove}>Delete</button>
          <button className="btn sm" onClick={() => setConfirmDelete(false)}>Keep it</button>
        </div>
      )}

      <div className="who">
        <Avatar name={doc.name} size={56} />
        <div>
          <h2>{doc.name}</h2>
          <p className="muted">{doc.company || 'No company given'} · {fmtDateTime(doc.createdAt)} <span className="dim">({timeAgo(doc.createdAt)})</span></p>
        </div>
      </div>

      <div className="actions">
        {mailto && <a className="btn primary" href={mailto} onClick={() => doc.status === 'new' && patch({ status: 'in_progress' })}><Icon.mail />Reply by email</a>}
        {wa && <a className="btn" href={wa} target="_blank" rel="noreferrer"><Icon.chat />WhatsApp</a>}
        {doc.phone && <a className="btn" href={`tel:${doc.phone.replace(/[^\d+]/g, '')}`}><Icon.phone />Call</a>}
      </div>

      <div className="status-row">
        <span className="mono muted">Status</span>
        <div className="seg-ctl" role="radiogroup" aria-label="Status">
          {STATUS_ORDER.map((s) => (
            <button key={s} role="radio" aria-checked={doc.status === s} className={`tone-${STATUS[s].tone}${doc.status === s ? ' on' : ''}`} disabled={saving}
              onClick={() => doc.status !== s && patch({ status: s }, `${doc.ref} marked ${STATUS[s].label.toLowerCase()}`)}>
              <i className={`dot tone-${STATUS[s].tone}`} />{STATUS[s].label}
            </button>
          ))}
        </div>
      </div>

      <dl className="facts">
        <div><dt><Icon.mail />Email</dt><dd>{doc.email ? <a href={`mailto:${doc.email}`}>{doc.email}</a> : <span className="dim">Not given</span>}</dd></div>
        <div><dt><Icon.phone />Phone</dt><dd>{doc.phone ? <a href={`tel:${doc.phone.replace(/[^\d+]/g, '')}`}>{doc.phone}</a> : <span className="dim">Not given</span>}</dd></div>
        <div><dt><Icon.robot />Interested in</dt><dd>{doc.product || <span className="dim">Not given</span>}</dd></div>
        <div><dt><Icon.factory />Industry</dt><dd>{doc.industry || <span className="dim">Not given</span>}</dd></div>
      </dl>

      <section className="message">
        <span className="mono muted">What they want to automate</span>
        <p>{doc.message}</p>
        {(doc.source?.page || doc.source?.referrer) && (
          <small className="dim">Sent from {doc.source.page || 'the contact page'}{doc.source.referrer ? `, arrived via ${doc.source.referrer.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}` : ''}</small>
        )}
      </section>

      {related.length > 0 && (
        <section className="related">
          <span className="mono muted">Also sent by {first}</span>
          <div>{related.map((r) => <button key={r._id} className="chip" onClick={() => onOpen(r._id)}>{r.ref} · {timeAgo(r.createdAt)} <StatusPill status={r.status} /></button>)}</div>
        </section>
      )}

      <section className="activity">
        <span className="mono muted">Activity and notes</span>
        <ol>
          {timeline.map((t, i) => t.kind === 'status' ? (
            <li key={i} className="ev">
              <i className={`dot tone-${STATUS[t.h.status]?.tone || 'muted'}`} />
              <span>{t.h.status === 'new' ? 'Received from the website' : <>Marked <b>{STATUS[t.h.status]?.label.toLowerCase()}</b> by {t.h.by}</>}</span>
              <time className="dim" title={fmtDateTime(t.at)}>{timeAgo(t.at)}</time>
            </li>
          ) : (
            <li key={i} className="note">
              <Avatar name={t.n.author} size={26} />
              <div><b>{t.n.author}</b> <time className="dim" title={fmtDateTime(t.at)}>{timeAgo(t.at)}</time><p>{t.n.text}</p></div>
            </li>
          ))}
        </ol>
        <form className="note-form" onSubmit={addNote}>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note (the customer never sees it)…" rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(e) }} />
          <button className="btn sm" disabled={!note.trim()}>Add note</button>
        </form>
      </section>
    </article>
  )
}
