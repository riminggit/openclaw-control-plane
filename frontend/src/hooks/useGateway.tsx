import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { gatewayClient } from '../lib/gateway-client';
import { apiGet } from '../api/client';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Subscribe to Gateway connection state */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(gatewayClient.state);
  useEffect(() => gatewayClient.onStateChange(setState), []);
  return state;
}

/** Fetch session list via RPC (with REST fallback) */
export function useSessions(limit = 50, activeMinutes = 1440) {
  const connState = useConnectionState();
  const [sessions, setSessions] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [defaults, setDefaults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (connState === 'connected') {
        const res = await gatewayClient.call('sessions.list', { limit, activeMinutes });
        const sessions = res?.sessions || (Array.isArray(res) ? res : []);
        setSessions(sessions);
        setCount(res?.count ?? sessions.length);
        setDefaults(res?.defaults ?? null);
      } else {
        // REST fallback when WS is not connected
        const res = await apiGet<any>(
          `/api/gateway/sessions?limit=${limit}&active_minutes=${activeMinutes}`,
        );
        const sessions = res?.sessions || (Array.isArray(res) ? res : []);
        setSessions(sessions);
        setCount(res?.count ?? sessions.length);
        setDefaults(res?.defaults ?? null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [connState, limit, activeMinutes]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (connState !== 'connected') return;
    const off = gatewayClient.on('session', () => {
      fetch();
    });
    return off;
  }, [connState, fetch]);

  return { sessions, count, defaults, loading, refetch: fetch };
}

/** Fetch Gateway status + health (with REST fallback) */
export function useGatewayStatus() {
  const connState = useConnectionState();
  const [status, setStatus] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (connState === 'connected') {
        const [s, h] = await Promise.allSettled([
          gatewayClient.call('status', {}),
          gatewayClient.call('health', {}),
        ]);
        if (s.status === 'fulfilled') setStatus(s.value);
        if (h.status === 'fulfilled') setHealth(h.value);
      } else {
        const [s, h] = await Promise.allSettled([
          apiGet<any>('/api/gateway/status'),
          apiGet<any>('/api/gateway/health'),
        ]);
        if (s.status === 'fulfilled') setStatus(s.value);
        if (h.status === 'fulfilled') setHealth(h.value);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [connState]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { status, health, loading, refetch: fetch };
}

/** Fetch cron jobs (with REST fallback) */
export function useCronJobs() {
  const connState = useConnectionState();
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (connState === 'connected') {
        const res = await gatewayClient.call('cron.list', { includeDisabled: true });
        const jobs = res?.jobs || (Array.isArray(res) ? res : []);
        setJobs(jobs);
        setTotal(res?.total ?? jobs.length);
      } else {
        const res = await apiGet<any>('/api/gateway/cron-jobs?include_disabled=true');
        const jobs = res?.jobs || (Array.isArray(res) ? res : []);
        setJobs(jobs);
        setTotal(res?.total ?? jobs.length);
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [connState]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (connState !== 'connected') return;
    const off = gatewayClient.on('cron', () => {
      fetch();
    });
    return off;
  }, [connState, fetch]);

  return { jobs, total, loading, refetch: fetch };
}

/** Fetch available models (with REST fallback) */
export function useModels() {
  const connState = useConnectionState();
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (connState === 'connected') {
        const res = await gatewayClient.call('models.list', {});
        setModels(res?.models || (Array.isArray(res) ? res : []));
      } else {
        const res = await apiGet<any>('/api/gateway/models');
        setModels(res?.models || (Array.isArray(res) ? res : []));
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [connState]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { models, loading, refetch: fetch };
}

/** Fetch node list from Gateway (with REST fallback) */
export function useNodes() {
  const connState = useConnectionState();
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (connState === 'connected') {
        const res = await gatewayClient.call('node.list', {});
        setNodes(res?.nodes || (Array.isArray(res) ? res : []));
      } else {
        const res = await apiGet<any>('/api/gateway/nodes');
        setNodes(res?.nodes || (Array.isArray(res) ? res : []));
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, [connState]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  return { nodes, loading, refetch: fetch };
}

/** Chat hook — send messages, receive events, manage history */
export function useChat() {
  const connState = useConnectionState();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchHistory = useCallback(
    async (limit = 100) => {
      setLoading(true);
      try {
        if (connState === 'connected') {
          const res = await gatewayClient.call('chat.history', { limit });
          setMessages(res?.messages || (Array.isArray(res) ? res : []));
        } else {
          const res = await apiGet<any>(`/api/gateway/chat/history?limit=${limit}`);
          setMessages(res?.messages || (Array.isArray(res) ? res : []));
        }
      } catch {
        /* */
      } finally {
        setLoading(false);
      }
    },
    [connState],
  );

  const sendMessage = useCallback(
    async (message: string, idempotencyKey?: string) => {
      if (connState !== 'connected') throw new Error('Not connected');
      setSending(true);
      try {
        const params: any = { message };
        if (idempotencyKey) params.idempotencyKey = idempotencyKey;
        await gatewayClient.call('chat.send', params);
      } finally {
        setSending(false);
      }
    },
    [connState],
  );

  const abortRun = useCallback(
    async (runId?: string) => {
      if (connState !== 'connected') throw new Error('Not connected');
      const params: any = {};
      if (runId) params.runId = runId;
      await gatewayClient.call('chat.abort', params);
    },
    [connState],
  );

  // Subscribe to chat and agent events
  useEffect(() => {
    if (connState !== 'connected') return;
    const offChat = gatewayClient.on('chat', (payload: any) => {
      setMessages(prev => [...prev, payload]);
    });
    const offAgent = gatewayClient.on('agent', (payload: any) => {
      setMessages(prev => [...prev, { role: 'system', ...payload }]);
    });
    return () => {
      offChat();
      offAgent();
    };
  }, [connState]);

  return { messages, loading, sending, fetchHistory, sendMessage, abortRun, setMessages };
}

/** Logs hook — fetch logs via Gateway RPC or REST */
export function useLogs(source: string = 'gateway', lines: number = 500) {
  const connState = useConnectionState();
  const [logLines, setLogLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      if (connState === 'connected') {
        const res = await gatewayClient.call('logs.tail', { filter: source });
        const text = typeof res === 'string' ? res : JSON.stringify(res);
        setLogLines(text.split('\n'));
      } else {
        const res = await apiGet<string>(`/logs/tail?source=${source}&lines=${lines}`);
        const text = typeof res === 'string' ? res : JSON.stringify(res);
        setLogLines(text.split('\n'));
      }
    } catch {
      setLogLines(['[Error fetching logs]']);
    } finally {
      setLoading(false);
    }
  }, [connState, source, lines]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  return { logLines, loading, refetch: fetch };
}

/** Convenience hook for a specific session's live data */
export function useGateway() {
  const connState = useConnectionState();
  return {
    connected: connState === 'connected',
    client: gatewayClient,
    call: gatewayClient.call.bind(gatewayClient),
  };
}

/** Provider that manages Gateway connection lifecycle */
export function GatewayProvider({ children }: { children: ReactNode }) {
  const mounted = useRef(true);
  useEffect(() => {
    gatewayClient.connect();
    return () => {
      mounted.current = false;
      gatewayClient.disconnect();
    };
  }, []);
  return <>{children}</>;
}
