import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessions, useConnectionState } from '../hooks/useGateway'
import { Link } from 'react-router-dom'
import { Button, Input, Select, Table, Card, Empty, Spin } from 'antd'


export function SessionsPage() {
  const { t } = useTranslation()
  const connState = useConnectionState()
  const { sessions, count, loading, refetch } = useSessions(200)
  const [search, setSearch] = useState('')
  const [filterKind, setFilterKind] = useState('')

  if (connState !== 'connected') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">{t('dashboard.not_connected')}</div>
        <Link to="/settings" className="btn btn-primary" style={{ textDecoration: 'none' }}>{t('gateway.go_settings')}</Link>
      </div>
    )
  }

  // Extract unique kinds for filter
  const kinds = useMemo(() => {
    const set = new Set<string>()
    sessions.forEach((s: any) => { if (s.kind) set.add(s.kind) })
    return Array.from(set).sort()
  }, [sessions])

  // Filter sessions
  const filtered = useMemo(() => {
    return sessions.filter((s: any) => {
      const matchSearch = !search ||
        (s.key || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.label || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.kind || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.channel || '').toLowerCase().includes(search.toLowerCase())
      const matchKind = !filterKind || s.kind === filterKind
      return matchSearch && matchKind
    })
  }, [sessions, search, filterKind])

  return (
    <div>
      <div className="page-header">
        <p className="page-header-eyebrow">{t('sessions.eyebrow')}</p>
        <h1>{t('sessions.title')} <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>({count})</span></h1>
        <p className="page-header-desc">{t('sessions.subtitle')}</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          style={{ maxWidth: 300 }}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('sessions.search_placeholder')}
          allowClear
        />
        {kinds.length > 1 && (
          <Select className="form-input" value={filterKind} onChange={e => setFilterKind(e)} style={{ minWidth: 150 }}>
            <Select.Option value="">{t('sessions.all_kinds')}</Select.Option>
            {kinds.map(k => <Select.Option key={k} value={k}>{k}</Select.Option>)}
          </Select>
        )}
        <Button type="text" onClick={refetch} disabled={loading}>🔄 {t('app.retry')}</Button>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{t('app.total', { count: filtered.length })}</span>
      </div>

      <div className="card">
        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>{t('app.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="card-body" style={{ padding: 'var(--space-10)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Empty description={search || filterKind ? t('sessions.no_match') : t('sessions.no_sessions')} />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('sessions.label')}</th>
                  <th>{t('sessions.key')}</th>
                  <th>{t('sessions.agent')}</th>
                  <th>{t('sessions.channel')}</th>
                  <th>{t('sessions.state')}</th>
                  <th>{t('sessions.last_active')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any, i: number) => {
                  const key = s.key || s.sessionKey
                  return (
                    <tr key={key || i}>
                      <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.displayName || s.label || '-'}
                      </td>
                      <td className="mono" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Link to={`/sessions/${encodeURIComponent(key)}`}>{key}</Link>
                      </td>
                      <td>{s.kind || '-'}</td>
                      <td>{s.channel || '-'}</td>
                      <td><span className={`badge badge-${s.active || s.state === 'active' ? 'active' : 'archived'}`}>{s.active ? 'Active' : (s.state || '-')}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                        {(s.updatedAtMs || s.updatedAt || s.lastActive) ? new Date(s.updatedAtMs || s.updatedAt || s.lastActive).toLocaleString() : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
