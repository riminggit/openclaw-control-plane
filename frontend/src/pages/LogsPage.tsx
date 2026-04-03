import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { logsApi } from '../api/modules/logs';
import { useLogs, useConnectionState } from '../hooks/useGateway';
import { Button, Input, Checkbox, Radio, Tag } from 'antd';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

type LogSource = 'gateway' | 'error' | 'backend';
type ViewMode = 'raw' | 'json';

const SOURCES: { key: LogSource; labelKey: string }[] = [
  { key: 'gateway', labelKey: 'logs.source_gateway' },
  { key: 'error', labelKey: 'logs.source_error' },
  { key: 'backend', labelKey: 'logs.source_backend' },
];

export function LogsPage() {
  const { t } = useTranslation();
  const connState = useConnectionState();
  const [source, setSource] = useState<LogSource>('gateway');
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [wordWrap, setWordWrap] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Gateway useLogs hook — fetches via WebSocket RPC or REST fallback
  const {
    logLines: gatewayLogs,
    loading: gatewayLoading,
    refetch,
  } = useLogs(source, liveMode ? 1000 : 500);

  // Sync gateway logs to local state when in live mode
  useEffect(() => {
    if (connState === 'connected' && source === 'gateway' && liveMode) {
      setLines(gatewayLogs);
    }
  }, [connState, source, liveMode, gatewayLogs]);

  // Fallback fetch via REST API
  const fetchLogs = useCallback(async () => {
    if (liveMode && connState === 'connected' && source === 'gateway') return;
    try {
      setLoading(true);
      const raw = await logsApi.tail(source, 500);
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      setLines(text.split('\n'));
    } catch {
      setLines(['[Error fetching logs]']);
    } finally {
      setLoading(false);
    }
  }, [source, liveMode, connState]);

  useEffect(() => {
    if (!liveMode) fetchLogs();
  }, [fetchLogs, liveMode]);

  useEffect(() => {
    if (viewMode === 'raw') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, viewMode]);

  // Auto-refresh via polling (when not in live mode)
  useEffect(() => {
    if (!autoRefresh || liveMode) return;
    const id = setInterval(fetchLogs, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs, liveMode]);

  const filtered = search
    ? lines.filter(l => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  const getLineColor = (line: string): string => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('exception'))
      return 'var(--status-red)';
    if (lower.includes('warn') || lower.includes('warning')) return 'var(--status-yellow)';
    if (lower.includes('info')) return 'var(--status-blue)';
    return 'var(--text-secondary)';
  };

  const getLogTag = (line: string): ReactNode => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal')) return <Tag color='red'>ERROR</Tag>;
    if (lower.includes('warn') || lower.includes('warning')) return <Tag color='orange'>WARN</Tag>;
    if (lower.includes('info')) return <Tag color='blue'>INFO</Tag>;
    if (lower.includes('debug')) return <Tag>DEBUG</Tag>;
    return null;
  };

  const tryFormatJson = (line: string): string => {
    try {
      const obj = JSON.parse(line);
      return JSON.stringify(obj, null, 2);
    } catch {
      return line;
    }
  };

  const handleExport = () => {
    const content =
      viewMode === 'json' ? filtered.map(tryFormatJson).join('\n\n') : filtered.join('\n');
    const ext = viewMode === 'json' ? '.json' : '.log';
    const blob = new Blob([content], {
      type: viewMode === 'json' ? 'application/json' : 'text/plain',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-${source}-${new Date().toISOString().slice(0, 19)}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className='page-container'
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}
    >
      <div className='page-header' style={{ flexShrink: 0 }}>
        <div>
          <div className='page-eyebrow'>{t('logs.eyebrow')}</div>
          <h1 className='page-title'>{t('logs.title')}</h1>
          <p className='page-subtitle'>{t('logs.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          {connState === 'connected' ? (
            <Tag color='green'>Gateway Connected</Tag>
          ) : (
            <Tag color='orange'>REST Mode</Tag>
          )}
          {liveMode && <Tag color='blue'>LIVE</Tag>}
        </div>
      </div>

      {/* Source tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          padding: 3,
          flexShrink: 0,
        }}
      >
        {SOURCES.map(s => (
          <Button
            key={s.key}
            onClick={() => setSource(s.key)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: source === s.key ? 'var(--accent)' : 'transparent',
              color: source === s.key ? '#fff' : 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
            }}
          >
            {t(s.labelKey)}
          </Button>
        ))}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          alignItems: 'center',
          marginTop: 'var(--space-3)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 200px', minWidth: 200, position: 'relative' }}>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('logs.search_placeholder')}
            style={{ paddingLeft: 32 }}
          />
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          >
            🔍
          </span>
        </div>
        <Radio.Group
          value={viewMode}
          onChange={e => setViewMode(e.target.value)}
          optionType='button'
          buttonStyle='solid'
          size='small'
        >
          <Radio.Button value='raw'>Raw</Radio.Button>
          <Radio.Button value='json'>JSON</Radio.Button>
        </Radio.Group>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <Checkbox checked={wordWrap} onChange={(v: any) => setWordWrap(v.target.checked)} />
          {t('logs.word_wrap')}
        </label>
        {connState === 'connected' && source === 'gateway' && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              color: liveMode ? 'var(--accent)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              fontWeight: liveMode ? 600 : 400,
            }}
          >
            <Checkbox checked={liveMode} onChange={(v: any) => setLiveMode(v.target.checked)} />
            🔴 Live
          </label>
        )}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            cursor: 'pointer',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}
        >
          <Checkbox checked={autoRefresh} onChange={(v: any) => setAutoRefresh(v.target.checked)} />
          {t('logs.auto_refresh')}
        </label>
        <Button type='text' onClick={refetch} disabled={loading || gatewayLoading}>
          🔄 {t('logs.refresh')}
        </Button>
        <Button type='text' onClick={handleExport}>
          📥 {t('logs.export')}
        </Button>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'center',
          padding: 'var(--space-1) var(--space-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <span>{filtered.length} lines</span>
        {search && <span>filtered from {lines.length}</span>}
      </div>

      {/* Log content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: '#0a0a0a',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          overflowY: 'auto',
          overflowX: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
          padding: 'var(--space-3)',
        }}
      >
        {(loading || gatewayLoading) && lines.length === 0 ? (
          <div
            style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}
          >
            {t('app.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-8)' }}
          >
            {t('logs.no_logs')}
          </div>
        ) : viewMode === 'json' ? (
          <pre style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {filtered.map((line, i) => {
              const formatted = tryFormatJson(line);
              const tag = getLogTag(line);
              return (
                <div
                  key={i}
                  style={{
                    color: getLineColor(line),
                    marginBottom: 8,
                    padding: 'var(--space-2)',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 'var(--radius-sm)',
                    whiteSpace: 'pre-wrap',
                    wordBreak: wordWrap ? 'break-all' : 'normal',
                  }}
                >
                  {tag} {formatted || '\u00A0'}
                </div>
              );
            })}
          </pre>
        ) : (
          filtered.map((line, i) => (
            <div
              key={i}
              style={{
                color: getLineColor(line),
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                wordBreak: wordWrap ? 'break-all' : 'normal',
              }}
            >
              {line || '\u00A0'}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {/* Not connected hint */}
      {connState !== 'connected' && (
        <div
          style={{
            marginTop: 'var(--space-3)',
            padding: 'var(--space-3)',
            background: 'var(--status-yellow-bg, rgba(255,193,7,0.1))',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          ⚠️ {t('logs.not_connected', 'Not connected to Gateway. Using REST fallback.')}{' '}
          <Link to='/settings' style={{ color: 'var(--accent)', marginLeft: 'var(--space-2)' }}>
            {t('gateway.go_settings')}
          </Link>
        </div>
      )}
    </div>
  );
}
