import { useEffect, useMemo, useState } from 'react'
import { saveFile } from '../native'
import { Icon, plural } from '../ui'

// Bulk import (super user only): people, clients, projects, robots, equipment and past problems
// from a spreadsheet saved as CSV. The hub checks every row first and changes nothing until "Import".
const KINDS = [
  ['people', 'People', 'Employees, with their role and team', Icon.users],
  ['clients', 'Clients', 'Companies and their contact people', Icon.building],
  ['projects', 'Projects', 'Current and past projects, per client', Icon.folder],
  ['robots', 'Robots', 'Robots already built or installed, with their software version', Icon.robot],
  ['equipment', 'Equipment', 'Conveyors, SPMs, grippers… on each project', Icon.factory],
  ['problems', 'Past problems', 'Problems and how they were solved, so search finds them', Icon.wrench],
]
const STATUS = { create: ['New', 'good'], update: ['Fills in', 'new'], skip: ['Skipped', 'muted'], error: ['Problem', 'bad'] }

/** Reads CSV as Excel and Google Sheets save it: quotes, "" inside quotes, CRLF, a BOM, and , ; or tab. */
export function parseCsv(text) {
  const t = String(text || '').replace(/^﻿/, '')
  const first = t.split(/\r?\n/, 1)[0] || ''
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length])
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0]
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (quoted) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  const clean = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!clean.length) return { headers: [], rows: [] }
  const headers = clean[0].map((h) => h.trim())
  return { headers, rows: clean.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]).filter(([h]) => h))) }
}
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
const toCsv = (headers, rows) => `﻿${[headers.map(csvCell).join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\r\n')}\r\n`
function download(name, text) {
  saveFile(name, new Blob([text], { type: 'text/csv;charset=utf-8' }))
}

export default function Import({ client, onError, notify }) {
  const [templates, setTemplates] = useState(null)
  const [kind, setKind] = useState('people')
  const [file, setFile] = useState(null) // { name, headers, rows }
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState('all')
  useEffect(() => { client.get('/import/templates').then((r) => setTemplates(r.templates), onError) }, [client, onError])
  const tpl = templates?.[kind]
  const reset = () => { setFile(null); setPaste(''); setResult(null); setShow('all') }

  const readFile = (f) => {
    if (!f) return
    if (/\.xlsx?$/i.test(f.name)) { onError(new Error('Save the sheet as CSV first: in Excel, File → Save As → CSV UTF-8. In Google Sheets, File → Download → CSV.')); return }
    const r = new FileReader()
    r.onload = () => { const p = parseCsv(r.result); setFile({ name: f.name, ...p }); setResult(null) }
    r.readAsText(f)
  }
  const usePaste = () => { const p = parseCsv(paste); setFile({ name: 'Pasted rows', ...p }); setResult(null) }

  const run = async (dryRun) => {
    setBusy(true)
    try {
      const r = await client.post(`/import/${kind}`, { rows: file.rows, dryRun })
      setResult(r); setShow(r.summary.error ? 'error' : 'all')
      if (!dryRun) notify(`Imported: ${r.summary.create} new, ${r.summary.update} filled in`)
    } catch (err) { onError(err) } finally { setBusy(false) }
  }
  const shown = useMemo(() => (result ? result.results.filter((x) => show === 'all' || x.status === show) : []), [result, show])
  const passwords = result && !result.dryRun ? result.results.filter((x) => x.temporaryPassword) : []
  const unknown = result?.columns?.filter((c) => !c.column) || []
  const missing = tpl && file ? tpl.required.filter((c) => !(result?.columns || []).some((x) => x.column === c) && !file.headers.some((h) => h.toLowerCase().replace(/[^a-z0-9]/g, '') === c.toLowerCase())) : []

  return (
    <div className="page import-page">
      <header className="page-h">
        <div><span className="mono muted">Super user · Bulk import</span><h1>Add data in bulk<span className="muted">, from a spreadsheet.</span></h1></div>
      </header>

      <section className="card">
        <header className="card-h"><h3><span className="step-n">1</span>What are you adding?</h3><span className="muted small">Best order: people, clients, projects, robots, equipment, problems.</span></header>
        <div className="kind-pick">
          {KINDS.map(([k, label, sub, Ico]) => (
            <button key={k} className={`kind${kind === k ? ' on' : ''}`} onClick={() => { setKind(k); reset() }}>
              <Ico /><b>{label}</b><small>{sub}</small>
            </button>
          ))}
        </div>
      </section>

      {tpl && (
        <section className="card">
          <header className="card-h"><h3><span className="step-n">2</span>Fill in the template</h3>
            <button className="btn sm" onClick={() => download(`nextup-${kind}-template.csv`, toCsv(tpl.columns, [tpl.example]))}><Icon.download />Download the {KINDS.find((x) => x[0] === kind)[1].toLowerCase()} template</button></header>
          <p className="muted">{tpl.help}</p>
          <div className="cols">{tpl.columns.map((c) => <span key={c} className={`tag mono${tpl.required.includes(c) ? ' req' : ''}`}>{c}{tpl.required.includes(c) ? ' *' : ''}</span>)}</div>
          <p className="muted small">* needed on every row. Column names can be loose (“Employee name”, “Mobile”, “Date of joining” work). Dates can be 2025-03-02, 02/03/2025 (day first) or 2 Mar 2025. Delete the example row before importing.</p>
        </section>
      )}

      {tpl && (
        <section className="card">
          <header className="card-h"><h3><span className="step-n">3</span>Upload it</h3>{file && <button className="link-btn" onClick={reset}>Start again</button>}</header>
          {!file ? (
            <div className="upload-grid">
              <label className="drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); readFile(e.dataTransfer.files[0]) }}>
                <Icon.download /><b>Choose a CSV file</b><small className="muted">or drop it here</small>
                <input type="file" accept=".csv,.txt,.tsv,text/csv" onChange={(e) => readFile(e.target.files[0])} />
              </label>
              <div className="paste">
                <textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'Or paste rows copied from the sheet, with the header row:\n' + tpl.columns.slice(0, 4).join('\t')} />
                <button className="btn sm" disabled={!paste.trim()} onClick={usePaste}>Use these rows</button>
              </div>
            </div>
          ) : (
            <>
              <p><b>{file.name}</b> <span className="muted">· {plural(file.rows.length, 'row')} · {plural(file.headers.length, 'column')}</span></p>
              {file.rows.length > 3000 && <p className="form-error">Up to 3000 rows at a time: split the file.</p>}
              {missing.length > 0 && !result && <p className="form-error">No column for {missing.join(', ')}. Check the header row.</p>}
              <div className="tbl-wrap preview">
                <table className="tbl">
                  <thead><tr><th>#</th>{file.headers.map((h) => { const m = result?.columns?.find((c) => c.header === h); return <th key={h} className={m && !m.column ? 'ignored' : ''} title={m ? (m.column ? `Goes to ${m.column}` : 'Not used') : ''}>{h}{m?.column && m.column.toLowerCase() !== h.toLowerCase().replace(/[^a-z0-9]/g, '') ? <small> → {m.column}</small> : null}</th> })}</tr></thead>
                  <tbody>{file.rows.slice(0, 6).map((r, i) => <tr key={i}><td className="muted">{i + 1}</td>{file.headers.map((h) => <td key={h}>{r[h]}</td>)}</tr>)}</tbody>
                </table>
              </div>
              {file.rows.length > 6 && <p className="muted small">…and {plural(file.rows.length - 6, 'more row')}.</p>}
              {unknown.length > 0 && <p className="muted small">Not used: {unknown.map((c) => c.header).join(', ')}.</p>}
              <div className="modal-actions">
                <button className="btn" disabled={busy || !file.rows.length || file.rows.length > 3000} onClick={() => run(true)}><Icon.check />{busy && !result ? 'Checking…' : 'Check every row'}</button>
                {result?.dryRun && <button className="btn primary" disabled={busy || !(result.summary.create + result.summary.update)} onClick={() => run(false)}>{busy ? 'Importing…' : `Import ${plural(result.summary.create + result.summary.update, 'row')}`}</button>}
                <span className="muted small">Checking changes nothing. Rows already in the hub are skipped or only have their empty fields filled in.</span>
              </div>
            </>
          )}
        </section>
      )}

      {result && (
        <section className="card">
          <header className="card-h"><h3><span className="step-n">4</span>{result.dryRun ? 'What would happen' : 'Done'}</h3></header>
          <div className="imp-sum">
            {Object.entries(STATUS).map(([k, [label, tone]]) => (
              <button key={k} className={`imp-n tone-${tone}${show === k ? ' on' : ''}`} onClick={() => setShow(show === k ? 'all' : k)}><b>{result.summary[k]}</b><span>{label}</span></button>
            ))}
          </div>
          {passwords.length > 0 && (
            <div className="banner warn">
              <Icon.key /><span><b>Temporary passwords for {plural(passwords.length, 'person', 'people')}.</b> Shown only now. Give each one privately; they choose their own at first sign-in.</span>
              <button className="btn sm" onClick={() => download('nextup-temporary-passwords.csv', toCsv(['name', 'email', 'temporaryPassword'], passwords.map((x) => ({ name: x.ref, email: x.email, temporaryPassword: x.temporaryPassword }))))}><Icon.download />Download (CSV)</button>
            </div>
          )}
          <div className="tbl-wrap">
            <table className="tbl imp-res">
              <thead><tr><th>Row</th><th>Result</th><th>What</th><th>Details</th>{passwords.length > 0 && <th>Temporary password</th>}</tr></thead>
              <tbody>
                {shown.slice(0, 500).map((x) => (
                  <tr key={x.row} className={`st-${x.status}`}>
                    <td className="muted mono">{x.row + 1}</td>
                    <td><span className={`pill tone-${STATUS[x.status][1]}`}><i />{STATUS[x.status][0]}</span></td>
                    <td>{x.ref || ''}{x.email ? <small className="block muted">{x.email}</small> : null}</td>
                    <td>{x.message}</td>
                    {passwords.length > 0 && <td className="mono">{x.temporaryPassword || ''}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > 500 && <p className="muted small">First 500 shown.</p>}
          {result.summary.error > 0 && (
            <button className="btn sm" onClick={() => {
              const bad = result.results.filter((x) => x.status === 'error')
              download(`nextup-${kind}-to-fix.csv`, toCsv([...file.headers, 'problem'], bad.map((x) => ({ ...file.rows[x.row - 1], problem: x.message }))))
            }}><Icon.download />Download the {plural(result.summary.error, 'row')} to fix</button>
          )}
          <p className="muted small">Row numbers are the lines of the file (line 1 is the header).</p>
          {!result.dryRun && <div className="modal-actions"><button className="btn sm" onClick={reset}>Import another file</button></div>}
        </section>
      )}
    </div>
  )
}
