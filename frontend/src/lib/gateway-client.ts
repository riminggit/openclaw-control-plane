type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

type EventCallback = (payload: any) => void

interface PendingRequest {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

export class GatewayClient {
  private ws: WebSocket | null = null
  private url = ''
  private token = ''
  private _state: ConnectionState = 'disconnected'
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private listeners = new Map<string, Set<EventCallback>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private shouldReconnect = false
  private _onStateChange?: (state: ConnectionState) => void

  get state() { return this._state }

  onStateChange(cb: (state: ConnectionState) => void) {
    this._onStateChange = cb
  }

  private setState(s: ConnectionState) {
    this._state = s
    this._onStateChange?.(s)
  }

  connect(url: string, token: string) {
    this.disconnect()
    this.url = url
    this.token = token
    this.shouldReconnect = true
    this.reconnectDelay = 1000
    this._doConnect()
  }

  private _doConnect() {
    this.setState('connecting')
    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.setState('error')
      this._scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      // Send connect frame
      this._sendRaw({ type: 'req', id: 0, method: 'connect', params: { auth: { token: this.token }, role: 'client' } })
    }

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        this._handleMessage(msg)
      } catch { /* ignore bad messages */ }
    }

    this.ws.onerror = () => {
      this.setState('error')
    }

    this.ws.onclose = () => {
      this.setState('disconnected')
      // Reject all pending
      for (const [id, req] of this.pending) {
        clearTimeout(req.timer)
        req.reject(new Error('Connection closed'))
        this.pending.delete(id)
      }
      this._scheduleReconnect()
    }
  }

  private _handleMessage(msg: any) {
    if (msg.type === 'res') {
      if (msg.id === 0) {
        // connect response
        if (msg.ok) {
          this.setState('connected')
          this.reconnectDelay = 1000
        } else {
          this.setState('error')
          this.ws?.close()
        }
        return
      }
      const req = this.pending.get(msg.id)
      if (req) {
        clearTimeout(req.timer)
        this.pending.delete(msg.id)
        if (msg.ok) req.resolve(msg.payload)
        else req.reject(new Error(msg.error?.message || 'RPC error'))
      }
    } else if (msg.type === 'event' && msg.event) {
      const cbs = this.listeners.get(msg.event)
      if (cbs) cbs.forEach(cb => { try { cb(msg.payload) } catch { /* */ } })
      // wildcard
      const all = this.listeners.get('*')
      if (all) all.forEach(cb => { try { cb(msg) } catch { /* */ } })
    }
  }

  private _sendRaw(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  call(method: string, params: Record<string, any> = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this._state !== 'connected') {
        reject(new Error('Not connected'))
        return
      }
      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('Timeout'))
      }, 30000)
      this.pending.set(id, { resolve, reject, timer })
      this._sendRaw({ type: 'req', id, method, params })
    })
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(callback)
    return () => this.off(event, callback)
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback)
  }

  private _scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return
    if (this.reconnectDelay > 30000) this.reconnectDelay = 30000
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this._doConnect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000)
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    if (this.ws) { this.ws.onclose = null; this.ws.close(); this.ws = null }
    this.setState('disconnected')
    for (const [id, req] of this.pending) {
      clearTimeout(req.timer)
      req.reject(new Error('Disconnected'))
      this.pending.delete(id)
    }
  }

  // Convenience: load saved config and auto-connect
  static loadConfig(): { url: string; token: string } {
    return {
      url: localStorage.getItem('gateway_url') || 'ws://127.0.0.1:18789/',
      token: localStorage.getItem('gateway_token') || '',
    }
  }

  static saveConfig(url: string, token: string) {
    localStorage.setItem('gateway_url', url)
    localStorage.setItem('gateway_token', token)
  }
}

// Singleton
export const gatewayClient = new GatewayClient()
