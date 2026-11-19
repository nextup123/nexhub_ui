import { useCallback, useEffect, useState } from 'react'
import Overview from '../Overview'
import Inbox from '../Inbox'
import { Icon, STATUS, STATUS_ORDER } from '../ui'

// Website enquiries: the overview and the inbox, with status tabs. Founders and leads only.
export default function Enquiries({ client, params, setParams, onError, notify, version, refreshBadges }) {
  const [summary, setSummary] = useState(null)
  const enq = client.enquiries
  const load = useCallback(() => enq.summary(30).then(setSummary, onError), [enq, onError])
  useEffect(() => { load() }, [load, version])

  // The overview and inbox were written with go('overview' | 'inbox', params).
  const go = useCallback((view, p = {}) => setParams(view === 'overview' ? {} : { tab: 'inbox', ...p, tab_: undefined }), [setParams])
  const tab = params.tab === 'inbox' ? 'inbox' : 'overview'
  const status = params.status || 'inbox'
  const counts = summary?.byStatus || {}
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'inbox', label: 'All', count: summary?.total },
    ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS[s].label, count: counts[s], tone: STATUS[s].tone })),
    { key: 'starred', label: 'Starred', icon: <Icon.star /> },
  ]
  const active = tab === 'overview' ? 'overview' : params.starred === 'true' ? 'starred' : status
  const pick = (k) => (k === 'overview' ? go('overview') : k === 'starred' ? go('inbox', { status: 'inbox', starred: 'true' }) : go('inbox', { status: k }))

  return (
    <div className="enq">
      <div className="subtabs">
        {tabs.map((t) => (
          <button key={t.key} className={active === t.key ? 'on' : ''} onClick={() => pick(t.key)}>
            {t.tone && <i className={`dot tone-${t.tone}`} />}{t.icon}{t.label}{t.count ? <em className={t.key === 'new' ? 'hot' : ''}>{t.count}</em> : null}
          </button>
        ))}
      </div>
      <div className="enq-body">
        {tab === 'overview'
          ? <Overview summary={summary} client={enq} version={version} onError={onError} go={go} />
          : <Inbox client={enq} params={{ ...params, status }} go={(v, p) => go(v, p)} version={version} onError={onError}
              onChanged={() => { load(); refreshBadges() }} toast={(t) => notify(t.text, t.tone)} />}
      </div>
    </div>
  )
}
