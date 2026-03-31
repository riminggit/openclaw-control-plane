import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { gatewayClient } from '../lib/gateway-client'

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/** Subscribe to Gateway connection state */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(gatewayClient.state)
  useEffect(() => gatewayClient.onStateChange(setState), [])
  return state
}

/** Fetch session list via RPC */
export function useSessions(limit = 50) {
  const connState = useConnectionState()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (connState !== 'connected') return
    setLoading(true)
    try {
      const res = await gatewayClient.call('sessions.list', { limit, activeMinutes: 1440, messageLimit: 0 })
      setSessions(Array.isArray(res) ? res : res?.sessions || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [connState, limit])

  useEffect(() => { fetch() }, [fetch])

  // Subscribe to session events for live updates
  useEffect(() => {
    if (connState !== 'connected') return
    const off = gatewayClient.on('session', () => { fetch() })
    return off
  }, [connState, fetch])

  return { sessions, loading, refetch: fetch }
}

/** Fetch Gateway status + health */
export function useGatewayStatus() {
  const connState = useConnectionState()
  const [status, setStatus] = useState<any>(null)
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (connState !== 'connected') return
    setLoading(true)
    try {
      const [s, h] = await Promise.allSettled([
        gatewayClient.call('status', {}),
        gatewayClient.call('health', {}),
      ])
      if (s.status === 'fulfilled') setStatus(s.value)
      if (h.status === 'fulfilled') setHealth(h.value)
    } catch { /* */ } finally { setLoading(false) }
  }, [connState])

  useEffect(() => { fetch() }, [fetch])

  return { status, health, loading, refetch: fetch }
}

/** Fetch cron jobs */
export function useCronJobs() {
  const connState = useConnectionState()
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (connState !== 'connected') return
    setLoading(true)
    try {
      const res = await gatewayClient.call('cron.list', { includeDisabled: true })
      setJobs(Array.isArray(res) ? res : res?.jobs || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [connState])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    if (connState !== 'connected') return
    const off = gatewayClient.on('cron', () => { fetch() })
    return off
  }, [connState, fetch])

  return { jobs, loading, refetch: fetch }
}

/** Convenience hook for a specific session's live data */
export function useGateway() {
  const connState = useConnectionState()
  return {
    connected: connState === 'connected',
    client: gatewayClient,
    call: gatewayClient.call.bind(gatewayClient),
  }
}

/** Provider that manages Gateway connection lifecycle */
export function GatewayProvider({ children }: { children: ReactNode }) {
  const mounted = useRef(true)
  useEffect(() => {
    gatewayClient.connect()
    return () => {
      mounted.current = false
      gatewayClient.disconnect()
    }
  }, [])
  return <>{children}</>
}
