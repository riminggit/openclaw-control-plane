/**
 * WebSocket Hook
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { WorkflowWebSocket, createWorkflowWebSocket } from '../api/websocket';
import { WSEvent } from '../types/workflow';

export interface UseWebSocketOptions {
  token: string;
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

/**
 * WebSocket 连接 Hook
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const { token, autoConnect = true } = options;
  // Use refs for callbacks to avoid reconnection loops
  const onConnectRef = useRef(options.onConnect);
  const onDisconnectRef = useRef(options.onDisconnect);
  const onErrorRef = useRef(options.onError);
  onConnectRef.current = options.onConnect;
  onDisconnectRef.current = options.onDisconnect;
  onErrorRef.current = options.onError;

  const wsRef = useRef<WorkflowWebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);

  useEffect(() => {
    if (!token) return;

    const ws = createWorkflowWebSocket(token);
    wsRef.current = ws;

    if (autoConnect) {
      ws.connect()
        .then(() => {
          setIsConnected(true);
          setError(null);
          onConnectRef.current?.();
        })
        .catch(err => {
          setError(err);
          onErrorRef.current?.(err);
        });
    }

    return () => {
      ws.disconnect();
      setIsConnected(false);
      onDisconnectRef.current?.();
    };
  }, [token, autoConnect]);

  const connect = async () => {
    if (wsRef.current) {
      await wsRef.current.connect();
      setIsConnected(true);
    }
  };

  const disconnect = () => {
    wsRef.current?.disconnect();
    setIsConnected(false);
  };

  const subscribe = (channel: string) => {
    wsRef.current?.subscribe(channel);
  };

  const unsubscribe = (channel: string) => {
    wsRef.current?.unsubscribe(channel);
  };

  const on = (eventType: string, handler: (event: WSEvent) => void) => {
    wsRef.current?.on(eventType, handler);
  };

  const off = (eventType: string, handler: (event: WSEvent) => void) => {
    wsRef.current?.off(eventType, handler);
  };

  return {
    isConnected,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    on,
    off,
  };
}

/**
 * 工作流实时更新 Hook
 */
export function useWorkflowRealtime(workflowId: string | null, token: string) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({ token });

  useEffect(() => {
    if (!workflowId || !isConnected) return;

    const channel = `workflow.${workflowId}`;
    const stepsChannel = `workflow.${workflowId}.steps`;

    const handleEvent = (event: WSEvent) => {
      setEvents(prev => [...prev, event].slice(-100)); // 保留最近100条
    };

    subscribe(channel);
    subscribe(stepsChannel);

    on('workflow.started', handleEvent);
    on('workflow.paused', handleEvent);
    on('workflow.resumed', handleEvent);
    on('workflow.completed', handleEvent);
    on('workflow.failed', handleEvent);
    on('step.started', handleEvent);
    on('step.progress', handleEvent);
    on('step.completed', handleEvent);
    on('step.failed', handleEvent);
    on('step.awaiting_review', handleEvent);

    return () => {
      unsubscribe(channel);
      unsubscribe(stepsChannel);
      off('workflow.started', handleEvent);
      off('workflow.paused', handleEvent);
      off('workflow.resumed', handleEvent);
      off('workflow.completed', handleEvent);
      off('workflow.failed', handleEvent);
      off('step.started', handleEvent);
      off('step.progress', handleEvent);
      off('step.completed', handleEvent);
      off('step.failed', handleEvent);
      off('step.awaiting_review', handleEvent);
    };
  }, [workflowId, isConnected, subscribe, unsubscribe, on, off]);

  return { events, isConnected };
}

/**
 * 审核实时通知 Hook
 */
export function useReviewNotifications(token: string) {
  const [notifications, setNotifications] = useState<WSEvent[]>([]);
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({ token });

  useEffect(() => {
    if (!isConnected) return;

    const handleEvent = (event: WSEvent) => {
      setNotifications(prev => [event, ...prev].slice(0, 50)); // 保留最近50条
    };

    subscribe('reviews');

    on('review.created', handleEvent);
    on('review.approved', handleEvent);
    on('review.rejected', handleEvent);
    on('review.timeout_warning', handleEvent);

    return () => {
      unsubscribe('reviews');
      off('review.created', handleEvent);
      off('review.approved', handleEvent);
      off('review.rejected', handleEvent);
      off('review.timeout_warning', handleEvent);
    };
  }, [isConnected, subscribe, unsubscribe, on, off]);

  return { notifications, isConnected };
}
