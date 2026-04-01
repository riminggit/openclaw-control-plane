/**
 * WebSocket 客户端
 */

import { WSEvent, WSSubscribeMessage } from '../types/workflow'

type EventHandler<T = any> = (event: WSEvent<T>) => void

export class WorkflowWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private token: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private handlers: Map<string, Set<EventHandler>> = new Map()
  private subscribedChannels: Set<string> = new Set()
  private isConnecting = false

  constructor(url: string, token: string) {
    this.url = url
    this.token = token
  }

  /**
   * 连接 WebSocket
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        resolve()
        return
      }

      this.isConnecting = true
      const wsUrl = `${this.url}?token=${this.token}`
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected')
        this.isConnecting = false
        this.reconnectAttempts = 0
        
        // 重新订阅之前的频道
        this.subscribedChannels.forEach(channel => {
          this.subscribe(channel)
        })
        
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const wsEvent: WSEvent = JSON.parse(event.data)
          this.handleEvent(wsEvent)
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        this.isConnecting = false
        reject(error)
      }

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected')
        this.isConnecting = false
        this.handleReconnect()
      }
    })
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.subscribedChannels.clear()
  }

  /**
   * 订阅频道
   */
  subscribe(channel: string) {
    this.subscribedChannels.add(channel)
    this.send({
      action: 'subscribe',
      channel
    })
  }

  /**
   * 取消订阅
   */
  unsubscribe(channel: string) {
    this.subscribedChannels.delete(channel)
    this.send({
      action: 'unsubscribe',
      channel
    })
  }

  /**
   * 添加事件处理器
   */
  on<T = any>(eventType: string, handler: EventHandler<T>) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
  }

  /**
   * 移除事件处理器
   */
  off<T = any>(eventType: string, handler: EventHandler<T>) {
    this.handlers.get(eventType)?.delete(handler)
  }

  /**
   * 发送消息
   */
  private send(message: WSSubscribeMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('[WebSocket] Cannot send message: not connected')
    }
  }

  /**
   * 处理事件
   */
  private handleEvent(event: WSEvent) {
    const handlers = this.handlers.get(event.event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error('[WebSocket] Handler error:', error)
        }
      })
    }

    // 通用处理器
    const allHandlers = this.handlers.get('*')
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error('[WebSocket] Handler error:', error)
        }
      })
    }
  }

  /**
   * 处理重连
   */
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('[WebSocket] Reconnect failed:', error)
      })
    }, delay)
  }
}

/**
 * 创建 WebSocket 客户端
 */
export function createWorkflowWebSocket(token: string): WorkflowWebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  const url = `${protocol}//${host}/api/v1/ws`
  return new WorkflowWebSocket(url, token)
}
