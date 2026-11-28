// What the start-up screen loads: the main pages for this person's role, plus what they opened
// recently on this device. Keys are exact request paths, the same ones the pages ask for.
import { addDaysStr, todayStr } from './ui'

const STORE = 'nx-prefetch'
const MAX = 40

const q = (o) => `?${new URLSearchParams(o)}`
const today = () => todayStr()
// [request, permission needed (or none)]. Keep in step with what each page asks for first.
export const BASELINE = [
  ['/home'],
  ['/attendance/today'],
  ['/units/summary', 'production.view'],
  [() => `/calendar${q({ from: today(), to: addDaysStr(today(), 21) })}`],
  ['/projects', 'projects.view'],
  ['/users', 'projects.view'],
  ['/clients', 'clients.view'],
  ['/units', 'production.view'],
  ['/production/templates', 'production.view'],
  ['/bugs?status=open&limit=100', 'bugs.view'],
  ['/contact-submissions?status=inbox&limit=6', 'enquiries.view'],
  [() => `/contact-submissions/summary${q({ days: 30, tzOffset: new Date().getTimezoneOffset() })}`, 'enquiries.view'],
  [() => `/attendance/month${q({ month: today().slice(0, 7) })}`],
  [() => `/leave/balance${q({ year: today().slice(0, 4) })}`],
  ['/leave?scope=mine'],
  ['/leave?scope=approvals', ['leave.approve_all', 'leave.approve_team']],
  [() => `/leave${q({ scope: 'team', status: 'approved,pending', year: today().slice(0, 4) })}`, ['leave.approve_all', 'leave.approve_team']],
  [() => `/holidays${q({ year: today().slice(0, 4) })}`],
  ['/users?all=true'],
  [() => { const month = today().slice(0, 7); const [y, m] = month.split('-').map(Number); const start = addDaysStr(`${month}-01`, -((new Date(y, m - 1, 1).getDay() + 6) % 7)); return `/calendar${q({ from: start, to: addDaysStr(start, 41) })}` }],
  ['/inventory', 'assets.view'],
  ['/inventory/projects', 'assets.manage'],
  ['/assets?projectId=none&limit=100', 'assets.view'],
  ['/units?project=none', 'projects.manage'],
]

export function startupKeys(user, can) {
  const base = BASELINE.filter(([, need]) => !need || [].concat(need).some(can)).map(([k]) => (typeof k === 'function' ? k() : k))
  let recent = []
  try { recent = JSON.parse(localStorage.getItem(`${STORE}:${user?._id}`) || '[]') } catch { /* none */ }
  return [...new Set([...base, ...recent])].slice(0, MAX + base.length)
}

export function rememberKeys(userId, keys) {
  try {
    const old = JSON.parse(localStorage.getItem(`${STORE}:${userId}`) || '[]')
    const next = [...new Set([...keys, ...old])].filter((k) => !/^\/auth\//.test(k)).slice(0, MAX)
    localStorage.setItem(`${STORE}:${userId}`, JSON.stringify(next))
  } catch { /* private mode */ }
}

/**
 * Everything at once, for the start-up screen: first the main pages, then every project, client and
 * robot page (and each project's asset tree), so nothing has to load later. onProgress(done, total).
 */
export async function prefetchAll(client, user, can, onProgress = () => {}) {
  // The main pages fill the bar to 55 %, the detail pages the rest.
  const run = async (keys, from, to) => {
    let done = 0
    let i = 0
    const tick = () => onProgress(from + (to - from) * (keys.length ? done / keys.length : 1))
    tick()
    const worker = async () => {
      while (i < keys.length) {
        const k = keys[i++]
        try { await client.get(k) } catch { /* a page the role cannot open, or a slow hub: the page loads it later */ }
        done += 1
        tick()
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker))
  }
  await run(startupKeys(user, can), 0, 0.55)
  const got = async (k) => { try { return await client.get(k) } catch { return null } }
  const [projects, clients, units] = await Promise.all([
    can('projects.view') ? got('/projects') : null,
    can('clients.view') ? got('/clients') : null,
    can('production.view') ? got('/units') : null,
  ])
  const more = []
  ;(projects?.projects || []).slice(0, 60).forEach((p) => {
    more.push(`/projects/${p._id}`)
    if (can('assets.view')) more.push(`/projects/${p._id}/assets`)
  })
  ;(clients?.clients || []).slice(0, 40).forEach((c) => more.push(`/clients/${c._id}`))
  ;(units?.units || []).slice(0, 60).forEach((u) => more.push(`/units/${u._id}`))
  const have = new Set(client.keys())
  await run(more.filter((k) => !have.has(k)), 0.55, 1)
}
