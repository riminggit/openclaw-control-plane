/**
 * 轮询 Hook
 */

import { useEffect, useRef, useCallback } from 'react'

export interface UsePollingOptions {
  interval?: number // 轮询间隔（毫秒）
  enabled?: boolean // 是否启用
  immediate?: boolean // 是否立即执行
  onError?: (error: Error) => void
}

/**
 * 轮询 Hook
 */
export function usePolling(
  callback: () => Promise<void> | void,
  options: UsePollingOptions = {}
) {
  const {
    interval = 5000,
    enabled = true,
    immediate = true,
    onError
  } = options

  const savedCallback = useRef(callback)
  const savedOnError = useRef(onError)

  // 保存最新的回调
  useEffect(() => {
    savedCallback.current = callback
    savedOnError.current = onError
  }, [callback, onError])

  // 立即执行
  useEffect(() => {
    if (immediate && enabled) {
      const run = async () => {
        try {
          await savedCallback.current()
        } catch (error) {
          savedOnError.current?.(error as Error)
        }
      }
      run()
    }
  }, [immediate, enabled])

  // 定时轮询
  useEffect(() => {
    if (!enabled) return

    const id = setInterval(async () => {
      try {
        await savedCallback.current()
      } catch (error) {
        savedOnError.current?.(error as Error)
      }
    }, interval)

    return () => clearInterval(id)
  }, [interval, enabled])
}

/**
 * 工作流轮询 Hook
 */
export function useWorkflowPolling(
  workflowId: string | null,
  fetchCallback: () => Promise<void>,
  options: Omit<UsePollingOptions, 'immediate'> = {}
) {
  const { interval = 3000, enabled = true, onError } = options

  usePolling(fetchCallback, {
    interval,
    enabled: enabled && !!workflowId,
    immediate: true,
    onError
  })
}

/**
 * 列表轮询 Hook
 */
export function useListPolling(
  fetchCallback: () => Promise<void>,
  options: Omit<UsePollingOptions, 'immediate'> = {}
) {
  const { interval = 10000, enabled = true, onError } = options

  usePolling(fetchCallback, {
    interval,
    enabled,
    immediate: true,
    onError
  })
}

/**
 * 自定义轮询控制器
 */
export function usePollingController() {
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())

  const start = useCallback((
    key: string,
    callback: () => Promise<void> | void,
    interval: number = 5000
  ) => {
    // 先停止已存在的同名定时器
    stop(key)

    // 立即执行一次
    const run = async () => {
      try {
        await callback()
      } catch (error) {
        console.error(`[Polling] Error in ${key}:`, error)
      }
    }
    run()

    // 启动定时器
    const timer = setInterval(run, interval)
    timersRef.current.set(key, timer)
  }, [])

  const stop = useCallback((key: string) => {
    const timer = timersRef.current.get(key)
    if (timer) {
      clearInterval(timer)
      timersRef.current.delete(key)
    }
  }, [])

  const stopAll = useCallback(() => {
    timersRef.current.forEach((timer, key) => {
      clearInterval(timer)
    })
    timersRef.current.clear()
  }, [])

  const isRunning = useCallback((key: string) => {
    return timersRef.current.has(key)
  }, [])

  // 清理所有定时器
  useEffect(() => {
    return () => {
      stopAll()
    }
  }, [stopAll])

  return {
    start,
    stop,
    stopAll,
    isRunning
  }
}
