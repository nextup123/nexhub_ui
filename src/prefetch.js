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
