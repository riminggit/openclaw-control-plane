/**
 * DAG 可视化组件 (使用 React Flow)
 * 
 * 注意: 此文件是基础框架,需要安装 reactflow 依赖
 * 安装命令: npm install reactflow
 */

import React, { useMemo } from 'react'
// import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow'
// import 'reactflow/dist/style.css'
import { DAG, DAGStep, StepStatus } from '../../types/workflow'

export interface DAGViewerProps {
  dag: DAG
  stepsStatus?: Record<string, StepStatus> // 步骤ID -> 状态
  stepsProgress?: Record<string, number> // 步骤ID -> 进度
  className?: string
}

/**
 * DAG 可视化组件
 * 
 * 当前为基础实现,展示 DAG 结构
 * 后续可集成 React Flow 提供更好的交互体验
 */
export const DAGViewer: React.FC<DAGViewerProps> = ({
  dag,
  stepsStatus = {},
  stepsProgress = {},
  className = ''
}) => {
  // 简单的布局算法 (从上到下)
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const levels: Record<string, number> = {}
    
    // 计算每个节点的层级
    const calculateLevel = (stepId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(stepId)) return 0 // 防止循环
      visited.add(stepId)
      
      const step = dag.steps.find(s => s.id === stepId)
      if (!step || step.depends_on.length === 0) return 0
      
      const maxParentLevel = Math.max(
        ...step.depends_on.map(depId => calculateLevel(depId, visited))
      )
      return maxParentLevel + 1
    }

    dag.steps.forEach(step => {
      levels[step.id] = calculateLevel(step.id)
    })

    // 按层级分组
    const levelGroups: Record<number, string[]> = {}
    Object.entries(levels).forEach(([stepId, level]) => {
      if (!levelGroups[level]) levelGroups[level] = []
      levelGroups[level].push(stepId)
    })

    // 分配位置
    Object.entries(levelGroups).forEach(([level, stepIds]) => {
      const levelNum = parseInt(level)
      const y = levelNum * 150
      stepIds.forEach((stepId, index) => {
        const x = (index - (stepIds.length - 1) / 2) * 200
        positions[stepId] = { x: x + 400, y: y + 100 }
      })
    })

    return positions
  }, [dag])

  const statusColors: Record<StepStatus, string> = {
    [StepStatus.PENDING]: '#9ca3af',
    [StepStatus.READY]: '#60a5fa',
    [StepStatus.ASSIGNED]: '#60a5fa',
    [StepStatus.RUNNING]: '#fbbf24',
    [StepStatus.AWAITING_REVIEW]: '#a78bfa',
    [StepStatus.APPROVED]: '#34d399',
    [StepStatus.REJECTED]: '#f87171',
    [StepStatus.RETRYING]: '#fb923c',
    [StepStatus.COMPLETED]: '#34d399',
    [StepStatus.FAILED]: '#f87171',
    [StepStatus.CANCELLED]: '#9ca3af',
    [StepStatus.SKIPPED]: '#9ca3af'
  }

  return (
    <div className={`dag-viewer border rounded-lg bg-gray-50 ${className}`} style={{ height: '600px', overflow: 'auto' }}>
      <svg width="100%" height="100%" style={{ minWidth: '800px', minHeight: '600px' }}>
        {/* 渲染边 */}
        {dag.edges.map((edge, idx) => {
          const sourcePos = nodePositions[edge.source]
          const targetPos = nodePositions[edge.target]
          if (!sourcePos || !targetPos) return null

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={sourcePos.x}
                y1={sourcePos.y + 40}
                x2={targetPos.x}
                y2={targetPos.y - 40}
                stroke="#cbd5e1"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </g>
          )
        })}

        {/* 箭头定义 */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#cbd5e1" />
          </marker>
        </defs>

        {/* 渲染节点 */}
        {dag.steps.map((step) => {
          const pos = nodePositions[step.id]
          if (!pos) return null

          const status = stepsStatus[step.id] || StepStatus.PENDING
          const progress = stepsProgress[step.id] || 0

          return (
            <g key={step.id}>
              {/* 节点背景 */}
              <rect
                x={pos.x - 100}
                y={pos.y - 40}
                width="200"
                height="80"
                rx="8"
                fill="white"
                stroke={statusColors[status]}
                strokeWidth="2"
              />
              
              {/* 节点名称 */}
              <text
                x={pos.x}
                y={pos.y - 10}
                textAnchor="middle"
                className="text-sm font-semibold"
              >
                {step.name}
              </text>
              
              {/* Agent 名称 */}
              <text
                x={pos.x}
                y={pos.y + 10}
                textAnchor="middle"
                className="text-xs"
                fill="#666"
              >
                {step.agent}
              </text>

              {/* 进度条 */}
              {progress > 0 && (
                <>
                  <rect
                    x={pos.x - 80}
                    y={pos.y + 25}
                    width="160"
                    height="6"
                    rx="3"
                    fill="#e5e7eb"
                  />
                  <rect
                    x={pos.x - 80}
                    y={pos.y + 25}
                    width={160 * (progress / 100)}
                    height="6"
                    rx="3"
                    fill={statusColors[status]}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 35}
                    textAnchor="middle"
                    className="text-xs"
                    fill="#666"
                  >
                    {Math.round(progress)}%
                  </text>
                </>
              )}

              {/* 需要审核标记 */}
              {step.human_review && (
                <circle
                  cx={pos.x + 90}
                  cy={pos.y - 30}
                  r="8"
                  fill="#a78bfa"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * TODO: 集成 React Flow 版本
 * 
 * 安装依赖: npm install reactflow
 * 
 * 使用示例:
 * import ReactFlow, { Background, Controls, MiniMap } from 'reactflow'
 * import 'reactflow/dist/style.css'
 * 
 * const nodes = dag.steps.map(step => ({
 *   id: step.id,
 *   type: 'default',
 *   position: nodePositions[step.id],
 *   data: { label: step.name }
 * }))
 * 
 * const edges = dag.edges.map(edge => ({
 *   id: `${edge.source}-${edge.target}`,
 *   source: edge.source,
 *   target: edge.target
 * }))
 * 
 * <ReactFlow nodes={nodes} edges={edges}>
 *   <Background />
 *   <Controls />
 *   <MiniMap />
 * </ReactFlow>
 */
