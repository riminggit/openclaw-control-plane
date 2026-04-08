/**
 * 活跃 Agent 可视化面板
 * 以卡片形式展示当前活跃的 agent 及其正在处理的任务
 */

import React, { useMemo, useState } from 'react'
import { useSessions } from '../hooks/useGateway'
import { useConnectionState } from '../hooks/useGateway'

interface AgentInfo {
  id: string
  name: string
  sessions: any[]
  taskCount: number
  channels: string[]
  lastActive: string
  avatar?: string
}

// Agent 头像颜色映射（根据 agent ID 生成）
function getAgentColor(agentId: string): string {
  const colors = [
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#ef4444', // red
    '#f97316', // orange
    '#eab308', // yellow
    '#22c55e', // green
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
  ]
  const index = agentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[index % colors.length]
}

// 生成 Agent 头像首字母
function getAgentInitials(name: string): string {
  if (!name) return '?'
  const parts = name.split(/[-_\s]+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// 格式化最后活跃时间
function formatLastActive(lastActive: string | number): string {
  if (!lastActive) return ''
  
  const now = Date.now()
  const time = typeof lastActive === 'number' ? lastActive : new Date(lastActive).getTime()
  const diff = Math.floor((now - time) / 1000)
  
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

// 任务操作类型
type TaskAction = 'pause' | 'resume' | 'terminate' | 'reassign' | 'view_logs' | 'retry' | 'details'

// Agent 卡片组件
function AgentCard({ 
  agent, 
  onClick,
  onTaskAction,
}: { 
  agent: AgentInfo
  onClick?: () => void
  onTaskAction?: (sessionId: string, action: TaskAction) => void
}) {
  const color = getAgentColor(agent.id)
  const initials = getAgentInitials(agent.name)
  const lastActiveText = formatLastActive(agent.lastActive)
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div
      className="agent-card"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '16px',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 状态指示器 */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: '#22c55e',
          boxShadow: '0 0 8px rgba(34, 197, 94, 0.6)',
          animation: 'pulse 2s infinite',
        }}
        title="活跃中"
      />
      
      {/* Avatar */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          backgroundColor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold',
          color: 'white',
          marginBottom: '12px',
          boxShadow: `0 4px 12px ${color}40`,
        }}
      >
        {initials}
      </div>
      
      {/* Agent 名称 */}
      <div
        style={{
          fontSize: '15px',
          fontWeight: 600,
          marginBottom: '8px',
          color: 'var(--text-primary)',
        }}
      >
        {agent.name || 'Unnamed Agent'}
      </div>
      
      {/* 任务统计 */}
      <div
        style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '8px',
        }}
      >
        <span style={{ fontWeight: 500, color: color }}>{agent.taskCount}</span>
        {' '}个活跃任务
      </div>
      
      {/* 频道标签 */}
      {agent.channels.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '8px',
          }}
        >
          {agent.channels.slice(0, 3).map((channel, i) => (
            <span
              key={i}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
              }}
            >
              {channel}
            </span>
          ))}
          {agent.channels.length > 3 && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
              }}
            >
              +{agent.channels.length - 3}
            </span>
          )}
        </div>
      )}
      
      {/* 最后活跃时间 */}
      {lastActiveText && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '8px',
          }}
        >
          🕒 {lastActiveText}
        </div>
      )}
      
      {/* 展开/折叠按钮 */}
      {agent.sessions.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            marginTop: '8px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {expanded ? '▼ 收起任务' : `▶ 查看任务 (${agent.sessions.length})`}
        </button>
      )}
      
      {/* 任务列表 */}
      {expanded && agent.sessions.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {agent.sessions.slice(0, 5).map((session: any) => (
            <div
              key={session.key || session.sessionKey}
              style={{
                padding: '10px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              {/* 任务标题 */}
              <div
                style={{
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.displayName || session.label || '未命名任务'}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    marginLeft: '8px',
                    backgroundColor: session.state === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                    color: session.state === 'active' ? '#22c55e' : '#6b7280',
                  }}
                >
                  {session.state || 'unknown'}
                </span>
              </div>
              
              {/* 任务详情 */}
              {session.channel && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  📢 {session.channel}
                </div>
              )}
              
              {/* 操作按钮 */}
              {onTaskAction && (
                <div
                  style={{
                    display: 'flex',
                    gap: '4px',
                    marginTop: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {session.state === 'active' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskAction(session.key || session.sessionKey, 'pause')
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '4px',
                          color: '#f59e0b',
                          cursor: 'pointer',
                        }}
                        title="暂停任务"
                      >
                        ⏸ 暂停
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskAction(session.key || session.sessionKey, 'terminate')
                        }}
                        style={{
                          padding: '4px 8px',
                          fontSize: '10px',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '4px',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                        title="终止任务"
                      >
                        ⏹ 终止
                      </button>
                    </>
                  )}
                  {session.state === 'paused' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onTaskAction(session.key || session.sessionKey, 'resume')
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        borderRadius: '4px',
                        color: '#22c55e',
                        cursor: 'pointer',
                      }}
                      title="恢复任务"
                    >
                      ▶ 恢复
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskAction(session.key || session.sessionKey, 'details')
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '4px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                    }}
                    title="查看详情"
                  >
                    👁 详情
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskAction(session.key || session.sessionKey, 'view_logs')
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '4px',
                      color: '#8b5cf6',
                      cursor: 'pointer',
                    }}
                    title="查看日志"
                  >
                    📋 日志
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskAction(session.key || session.sessionKey, 'retry')
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: 'rgba(6, 182, 212, 0.15)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '4px',
                      color: '#06b6d4',
                      cursor: 'pointer',
                    }}
                    title="重试任务"
                  >
                    🔄 重试
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskAction(session.key || session.sessionKey, 'reassign')
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: 'rgba(236, 72, 153, 0.15)',
                      border: '1px solid rgba(236, 72, 153, 0.3)',
                      borderRadius: '4px',
                      color: '#ec4899',
                      cursor: 'pointer',
                    }}
                    title="重新分配"
                  >
                    🔀 重分配
                  </button>
                </div>
              )}
            </div>
          ))}
          {agent.sessions.length > 5 && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>
              还有 {agent.sessions.length - 5} 个任务...
            </div>
          )}
        </div>
      )}
      
      {/* Hover 效果 */}
      <style>{`
        .agent-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

// 主组件
export function ActiveAgentsPanel({ 
  limit = 10,
  onAgentClick,
  onTaskAction,
}: { 
  limit?: number
  onAgentClick?: (agent: AgentInfo) => void
  onTaskAction?: (sessionId: string, action: TaskAction) => void
}) {
  const connState = useConnectionState()
  const { sessions, loading } = useSessions(200, 1440) // 获取最近24小时活跃的 sessions
  
  // 提取活跃 agents
  const activeAgents = useMemo(() => {
    if (!sessions || sessions.length === 0) return []
    
    // 按 agent 分组 sessions
    const agentMap = new Map<string, AgentInfo>()
    
    sessions.forEach((session: any) => {
      const agentId = session.agent || 'unknown'
      const agentName = session.agentName || session.agent || 'Unknown Agent'
      
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          id: agentId,
          name: agentName,
          sessions: [],
          taskCount: 0,
          channels: [],
          lastActive: '',
        })
      }
      
      const agentInfo = agentMap.get(agentId)!
      agentInfo.sessions.push(session)
      
      // 统计活跃任务（假设 state 为 active 表示活跃）
      if (session.state === 'active' || session.state === 'running') {
        agentInfo.taskCount++
      }
      
      // 收集频道
      if (session.channel && !agentInfo.channels.includes(session.channel)) {
        agentInfo.channels.push(session.channel)
      }
      
      // 更新最后活跃时间
      const sessionTime = session.lastActive || session.updatedAt || session.createdAt
      if (sessionTime) {
        if (!agentInfo.lastActive || new Date(sessionTime) > new Date(agentInfo.lastActive)) {
          agentInfo.lastActive = sessionTime
        }
      }
    })
    
    // 转换为数组并排序（按任务数降序）
    const agents = Array.from(agentMap.values())
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, limit)
    
    return agents
  }, [sessions, limit])
  
  // 未连接状态
  if (connState !== 'connected') {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        🔌 未连接到 Gateway
      </div>
    )
  }
  
  // 加载状态
  if (loading) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        加载中...
      </div>
    )
  }
  
  // 空状态
  if (activeAgents.length === 0) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        暂无活跃的 Agent
      </div>
    )
  }
  
  return (
    <div>
      {/* 标题 */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '16px',
          color: 'var(--text-primary)',
        }}
      >
        🤖 活跃 Agent ({activeAgents.length})
      </div>
      
      {/* Agent 卡片网格 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {activeAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onClick={() => onAgentClick?.(agent)}
            onTaskAction={onTaskAction}
          />
        ))}
      </div>
    </div>
  )
}

// 紧凑版本（用于侧边栏）
export function ActiveAgentsCompact({ 
  limit = 5,
  onAgentClick,
  onTaskAction,
}: { 
  limit?: number
  onAgentClick?: (agent: AgentInfo) => void 
  onTaskAction?: (sessionId: string, action: TaskAction) => void
}) {
  const connState = useConnectionState()
  const { sessions, loading } = useSessions(100, 1440)
  
  const activeAgents = useMemo(() => {
    if (!sessions || sessions.length === 0) return []
    
    const agentMap = new Map<string, AgentInfo>()
    
    sessions.forEach((session: any) => {
      const agentId = session.agent || 'unknown'
      const agentName = session.agentName || session.agent || 'Unknown'
      
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          id: agentId,
          name: agentName,
          sessions: [],
          taskCount: 0,
          channels: [],
          lastActive: '',
        })
      }
      
      const agentInfo = agentMap.get(agentId)!
      agentInfo.sessions.push(session)
      
      if (session.state === 'active' || session.state === 'running') {
        agentInfo.taskCount++
      }
    })
    
    return Array.from(agentMap.values())
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, limit)
  }, [sessions, limit])
  
  if (connState !== 'connected' || loading || activeAgents.length === 0) {
    return null
  }
  
  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '12px',
          color: 'var(--text-primary)',
        }}
      >
        🤖 活跃 Agent
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeAgents.map((agent) => {
          const color = getAgentColor(agent.id)
          const initials = getAgentInitials(agent.name)
          
          return (
            <div
              key={agent.id}
              onClick={() => onAgentClick?.(agent)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {/* 小头像 */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  backgroundColor: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              
              {/* 信息 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {agent.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>{agent.taskCount} 个任务</span>
                  {onTaskAction && agent.sessions.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        // 显示第一个任务的操作菜单
                        const session = agent.sessions[0]
                        if (session) {
                          const menu = window.confirm('选择操作：\n\n确定 - 暂停任务\n取消 - 查看详情')
                          if (menu) {
                            onTaskAction(session.key || session.sessionKey, 'pause')
                          } else {
                            onTaskAction(session.key || session.sessionKey, 'details')
                          }
                        }
                      }}
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        color: '#3b82f6',
                        cursor: 'pointer',
                      }}
                      title="管理任务"
                    >
                      ⚙
                    </button>
                  )}
                </div>
              </div>
              
              {/* 状态点 */}
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#22c55e',
                  boxShadow: '0 0 6px rgba(34, 197, 94, 0.6)',
                  flexShrink: 0,
                }}
              />
            </div>
          )
        })}
      </div>
      
      <style>{`
        div[onclick]:hover {
          transform: translateX(2px);
          border-color: var(--color-primary) !important;
        }
      `}</style>
    </div>
  )
}
