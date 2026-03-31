import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { gatewayClient, GatewayClient } from '../lib/gateway-client'

// Context for global client
const GatewayContext = createContext<GatewayClient>(gatewayClient)
export function useGateway() { return useContext(GatewayContext) }
export { GatewayClient }

export function GatewayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(gatewayClient.state)
  useEffect(() => {
    gatewayClient.onStateChange(setState)
    // Auto-connect via backend proxy (token handled server-side)
    gatewayClient.connect()
    return () => { gatewayClient.disconnect() }
  }, [])
  return <GatewayContext.Provider value={gatewayClient}>{children}</GatewayContext.Provider>
}

// Sessions
export function useSessions(limit = 50) {
  const client = useGateway()
  const connState = useConnectionState()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetched = useRef(false)

  const fetch = useCallback(async () => {
    try {
      const res = await client.call('sessions.list', { limit, activeMinutes: 60 })
      setSessions(res?.sessions || res || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [client, limit])

  useEffect(() => { if (connState === 'connected' && !fetched.current) { fetched.current = true; fetch() } }, [connState, fetch])
  useEffect(() => {
    const off = client.on('session', () => { fetched.current = false; fetch() })
    return off
  }, [client, fetch])

  return { sessions, loading, refetch: fetch }
}

// Cron Jobs
export function useCronJobs() {
  const client = useGateway()
  const connState = useConnectionState()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetched = useRef(false)

  const fetch = useCallback(async () => {
    try {
      const res = await client.call('cron.list', { includeDisabled: true })
      setJobs(res?.jobs || res || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [client])

  useEffect(() => { if (connState === 'connected' && !fetched.current) { fetched.current = true; fetch() } }, [connState, fetch])
  useEffect(() => {
    const off = client.on('cron', () => { fetched.current = false; fetch() })
    return off
  }, [client, fetch])

  return { jobs, loading, refetch: fetch }
}

// Status / Health
export function useGatewayStatus() {
  const client = useGateway()
  const connState = useConnectionState()
  const [status, setStatus] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const [s, h] = await Promise.allSettled([
        client.call('status'),
        client.call('health'),
      ])
      if (s.status === 'fulfilled') setStatus(s.value)
      if (h.status === 'fulfilled') setHealth(h.value)
    } catch { /* */ } finally { setLoading(false) }
  }, [client])

  useEffect(() => { if (connState === 'connected') fetch() }, [connState, fetch])

  return { status, health, loading, refetch: fetch }
}

// Chat History
export function useChatHistory(limit = 50) {
  const client = useGateway()
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const fetched = useRef(false)

  const fetch = useCallback(async () => {
    try {
      const res = await client.call('chat.history', { limit })
      setMessages(res?.messages || res || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [client, limit])

  useEffect(() => { if (connState === 'connected' && !fetched.current) { fetched.current = true; fetch() } }, [connState, fetch])
  useEffect(() => {
    const off = client.on('chat', (payload) => {
      setMessages(prev => [...prev, payload])
    })
    return off
  }, [client])

  return { messages, loading, refetch: fetch }
}

// Logs
export function useLogs(filter?: string) {
  const client = useGateway()
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (connState !== 'connected') return
    setLoading(true)
    client.call('logs.tail', filter ? { filter } : {}).then((res) => {
      setLogs(res?.lines || res || [])
      setLoading(false)
    }).catch(() => setLoading(false))

    const off = client.on('*', (msg) => {
      if (msg.event === 'log' || msg.event === 'agent') {
        const text = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)
        setLogs(prev => [...prev.slice(-200), text])
      }
    })
    return off
  }, [client, client.state, filter])

  return { logs, loading }
}

// Connection state hook
export function useConnectionState() {
  const client = useGateway()
  const [state, setState] = useState(client.state)
  useEffect(() => {
    const cb = (s: string) => setState(s)
    client.onStateChange(cb)
    return () => { client.onStateChange(() => {}) }
  }, [client])
  return state
}
