import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConnectionState } from '../hooks/useGateway';
import { gatewayClient } from '../lib/gateway-client';
import { Button, Input, Select, Card, Empty, Spin, Tag, Collapse, Descriptions } from 'antd';
import type { ReactNode } from 'react';

/** Render message content block with rich visualization */
function ContentBlock({ block, expanded }: { block: any; expanded: boolean }): ReactNode {
  if (!block) return null;

  if (block.type === 'text' && block.text) {
    return (
      <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{block.text}</pre>
    );
  }

  if (block.type === 'toolCall') {
    const args = block.arguments || block.input || {};
    return (
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <Tag color='purple'>🔧 TOOL</Tag>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {block.name || block.tool_name || 'tool'}
          </span>
          {block.id && (
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              #{block.id.slice(0, 8)}
            </span>
          )}
        </div>
        {Object.keys(args).length > 0 && (
          <pre
            style={{
              margin: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              maxHeight: expanded ? 'none' : 120,
              overflow: 'hidden',
            }}
          >
            {JSON.stringify(args, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (block.type === 'toolResult') {
    const isError = block.is_error || block.status === 'error';
    return (
      <div
        style={{
          background: isError ? 'rgba(255,77,79,0.1)' : 'rgba(82,196,26,0.1)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <Tag color={isError ? 'red' : 'green'}>{isError ? '✗ ERROR' : '✓ RESULT'}</Tag>
          {block.tool_call_id && (
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
              #{block.tool_call_id.slice(0, 8)}
            </span>
          )}
        </div>
        <pre
          style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            whiteSpace: 'pre-wrap',
            maxHeight: expanded ? 'none' : 200,
            overflow: 'hidden',
          }}
        >
          {block.content ? String(block.content).slice(0, 2000) : '(no output)'}
        </pre>
      </div>
    );
  }

  if (block.type === 'thinking') {
    return (
      <div
        style={{
          background: 'rgba(114,46,209,0.1)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-2)',
          borderLeft: '3px solid var(--accent)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <Tag color='purple'>💭 THINKING</Tag>
        </div>
        <pre
          style={{
            margin: 0,
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
          }}
        >
          {block.thinking || block.content || '(no thinking content)'}
        </pre>
      </div>
    );
  }

  // Fallback: render as JSON
  return (
    <pre
      style={{
        margin: 0,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)',
        whiteSpace: 'pre-wrap',
      }}
    >
      {JSON.stringify(block, null, 2).slice(0, 500)}
    </pre>
  );
}

/** Render message content which can be string, array of content blocks, or other */
function renderContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block: any) => {
        if (block.type === 'text' && block.text) return block.text;
        if (block.type === 'toolCall')
          return `🔧 ${block.name || 'tool'}(${JSON.stringify(block.arguments || {}).slice(0, 200)})`;
        if (block.type === 'toolResult')
          return block.content ? String(block.content).slice(0, 200) : '✓ (no output)';
        if (block.type === 'thinking') return `💭 ${block.thinking || ''}`;
        return JSON.stringify(block).slice(0, 200);
      })
      .join('\n');
  }
  return JSON.stringify(content, null, 2).slice(0, 2000);
}

/** Check if content has structured blocks */
function hasStructuredContent(content: any): boolean {
  if (!content) return false;
  if (typeof content === 'string') return false;
  if (Array.isArray(content)) {
    return content.some(
      block =>
        block.type === 'toolCall' || block.type === 'toolResult' || block.type === 'thinking',
    );
  }
  return false;
}

export function SessionDetailPage() {
  const { t } = useTranslation();
  const { key } = useParams<{ key: string }>();
  const connState = useConnectionState();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editModel, setEditModel] = useState('');
  const [editThinking, setEditThinking] = useState('');
  const [expandedMsg, setExpandedMsg] = useState<Set<number>>(new Set());
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    if (!key) return;
    try {
      const res = await gatewayClient.call('sessions.get', {
        sessionKey: key,
        limit: 100,
        includeTools: true,
      });
      setMessages(res?.messages || []);
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (connState === 'connected') fetchHistory();
  }, [connState, fetchHistory]);

  // Subscribe to real-time agent events for this session
  useEffect(() => {
    if (connState !== 'connected' || !key) return;

    const offAgent = gatewayClient.on('agent', (payload: any) => {
      if (payload.sessionKey === key || payload.session === key) {
        setLiveEvents(prev => [...prev.slice(-50), { ...payload, _ts: Date.now() }]);
        // Auto-refresh history when agent completes a turn
        if (payload.event === 'turn_end' || payload.event === 'complete') {
          setTimeout(fetchHistory, 500);
        }
      }
    });

    const offChat = gatewayClient.on('chat', (payload: any) => {
      if (payload.sessionKey === key || payload.session === key) {
        if (payload.event === 'message' || payload.event === 'delta') {
          setLiveEvents(prev => [...prev.slice(-50), { ...payload, _ts: Date.now() }]);
        }
      }
    });

    return () => {
      offAgent();
      offChat();
    };
  }, [connState, key, fetchHistory]);

  // Auto-scroll to bottom when new live events arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveEvents, messages]);

  const toggleExpand = (idx: number) => {
    setExpandedMsg(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSend = async () => {
    if (!inputMsg.trim() || !key) return;
    setSending(true);
    try {
      await gatewayClient.call('sessions.send', { sessionKey: key, message: inputMsg.trim() });
      setInputMsg('');
      setLiveEvents([]);
      setTimeout(fetchHistory, 1500);
    } catch {
      /* */
    } finally {
      setSending(false);
    }
  };

  const handleAbort = async () => {
    try {
      await gatewayClient.call('sessions.abort', { sessionKey: key });
    } catch {
      /* */
    }
  };

  const handlePatch = async () => {
    if (!key) return;
    const patch: any = {};
    if (editModel) patch.model = editModel;
    if (editThinking) patch.thinking = editThinking === 'on';
    try {
      await gatewayClient.call('sessions.patch', { sessionKey: key, ...patch });
      setEditing(false);
      fetchHistory();
    } catch {
      /* */
    }
  };

  // Compute message stats
  const toolCallCount = messages.reduce((acc: number, msg: any) => {
    if (Array.isArray(msg.content)) {
      return acc + msg.content.filter((b: any) => b.type === 'toolCall').length;
    }
    return acc;
  }, 0);

  if (connState !== 'connected') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-16)',
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ fontSize: '48px', opacity: 0.5 }}>🔌</div>
        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {t('dashboard.not_connected')}
        </div>
        <Link to='/settings' className='btn btn-primary' style={{ textDecoration: 'none' }}>
          {t('gateway.go_settings')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className='page-header'>
        <div>
          <Link
            to='/sessions'
            style={{
              color: 'var(--text-muted)',
              textDecoration: 'none',
              fontSize: 'var(--text-sm)',
              display: 'inline-block',
              marginBottom: 'var(--space-2)',
            }}
          >
            ← {t('sessions.title')}
          </Link>
          <div className='page-eyebrow'>{t('session_detail.eyebrow', '会话详情')}</div>
          <h1 className='page-title' style={{ wordBreak: 'break-all' }}>
            {t('session_detail.title')}：{key}
          </h1>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <Button danger onClick={handleAbort}>
          {t('session_detail.abort')}
        </Button>
        <Button type='text' onClick={fetchHistory}>
          🔄 {t('app.retry')}
        </Button>
        <Button
          onClick={() => {
            setEditModel('');
            setEditThinking('off');
            setEditing(!editing);
          }}
        >
          {t('session_detail.edit_config')}
        </Button>
      </div>

      {editing && (
        <div className='card' style={{ marginBottom: 'var(--space-4)' }}>
          <div
            className='card-body'
            style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'end', flexWrap: 'wrap' }}
          >
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                {t('session_detail.model')}
              </label>
              <Input
                style={{ width: '100%' }}
                value={editModel}
                onChange={e => setEditModel(e.target.value)}
                placeholder='model name'
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 500, marginBottom: 'var(--space-1)' }}>
                {t('session_detail.thinking')}
              </label>
              <Select
                className='form-input'
                value={editThinking}
                onChange={e => setEditThinking(e)}
              >
                <Select.Option value='on'>{t('app.on')}</Select.Option>
                <Select.Option value='off'>{t('app.off')}</Select.Option>
              </Select>
            </div>
            <Button type='primary' onClick={handlePatch}>
              {t('app.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
        }}
      >
        <Tag>{messages.length} messages</Tag>
        {toolCallCount > 0 && <Tag color='purple'>{toolCallCount} tool calls</Tag>}
        {liveEvents.length > 0 && <Tag color='blue'>{liveEvents.length} live events</Tag>}
      </div>

      {/* Live Events Panel */}
      {liveEvents.length > 0 && (
        <div className='card' style={{ marginBottom: 'var(--space-4)' }}>
          <div
            className='card-header'
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <h2 style={{ margin: 0 }}>🔴 Live</h2>
            <Button
              type='text'
              onClick={() => setLiveEvents([])}
              style={{ fontSize: 'var(--text-sm)' }}
            >
              Clear
            </Button>
          </div>
          <div
            className='card-body'
            style={{ maxHeight: 200, overflow: 'auto', fontSize: 'var(--text-sm)' }}
          >
            {liveEvents.slice(-20).map((evt, i) => (
              <div
                key={i}
                style={{
                  padding: 'var(--space-1) 0',
                  borderBottom: '1px solid var(--border-default)',
                }}
              >
                <span
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-xs)',
                    marginRight: 'var(--space-2)',
                  }}
                >
                  {new Date(evt._ts).toLocaleTimeString()}
                </span>
                <Tag
                  color={
                    evt.event === 'error' ? 'red' : evt.event === 'tool_start' ? 'purple' : 'blue'
                  }
                  style={{ fontSize: 'var(--text-xs)' }}
                >
                  {evt.event || 'event'}
                </Tag>
                {evt.tool && <span style={{ fontFamily: 'var(--font-mono)' }}>🔧 {evt.tool}</span>}
                {evt.delta && (
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {String(evt.delta).slice(0, 100)}
                  </span>
                )}
                {evt.error && <span style={{ color: 'var(--status-red)' }}>{evt.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className='card'>
        <div className='card-header'>
          <h2>{t('session_detail.history')}</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {t('app.total', { count: messages.length })}
          </span>
        </div>
        {loading ? (
          <div className='card-body' style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            {t('app.loading')}
          </div>
        ) : messages.length === 0 ? (
          <div className='card-body empty-state' style={{ padding: 'var(--space-10)' }}>
            <div className='empty-state-desc'>{t('session_detail.no_history')}</div>
          </div>
        ) : (
          <div className='card-body' style={{ maxHeight: 600, overflow: 'auto' }}>
            {messages.map((msg: any, i: number) => {
              const isExpanded = expandedMsg.has(i);
              const hasStructured = hasStructuredContent(msg.content);
              return (
                <div
                  key={i}
                  style={{
                    padding: 'var(--space-3)',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {msg.role === 'user'
                        ? '👤'
                        : msg.role === 'assistant'
                          ? '🤖'
                          : msg.role === 'tool'
                            ? '🔧'
                            : '📝'}{' '}
                      {msg.role}
                      {msg.model && (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontWeight: 400,
                            marginLeft: 'var(--space-2)',
                          }}
                        >
                          ({msg.model})
                        </span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      {hasStructured && (
                        <Button
                          type='text'
                          onClick={() => toggleExpand(i)}
                          style={{ fontSize: 'var(--text-xs)', padding: '0 4px' }}
                        >
                          {isExpanded ? '▽ Collapse' : '▷ Expand'}
                        </Button>
                      )}
                      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {msg.ts ? new Date(msg.ts).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                  {/* Rich content rendering */}
                  {hasStructured ? (
                    <div>
                      {Array.isArray(msg.content) &&
                        msg.content.map((block: any, j: number) => (
                          <ContentBlock key={j} block={block} expanded={isExpanded} />
                        ))}
                    </div>
                  ) : (
                    <pre
                      style={{
                        fontSize: 'var(--text-sm)',
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text-primary)',
                        wordBreak: 'break-word',
                        fontFamily: 'inherit',
                        margin: 0,
                      }}
                    >
                      {renderContent(msg.content)}
                    </pre>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Send message */}
      <div className='card' style={{ marginTop: 'var(--space-4)' }}>
        <div className='card-body' style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <Input
            style={{ flex: 1 }}
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            placeholder={t('session_detail.send_placeholder')}
            onPressEnter={e => !e.shiftKey && handleSend()}
          />
          <Button type='primary' onClick={handleSend} disabled={sending || !inputMsg.trim()}>
            {sending ? '...' : t('session_detail.send')}
          </Button>
        </div>
      </div>
    </div>
  );
}
