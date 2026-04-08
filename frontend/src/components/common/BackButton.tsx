/**
 * BackButton - 返回按钮组件
 * 
 * 修复：使用 styles.css 中定义的 CSS 变量
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'

interface BackButtonProps {
  /** 返回目标路径，不传则返回上一页 */
  to?: string
  /** 按钮文字，默认"返回" */
  text?: string
  /** 自定义类名 */
  className?: string
}

export function BackButton({ to, text = '返回', className = '' }: BackButtonProps) {
  const navigate = useNavigate()
  
  const handleClick = () => {
    try {
      if (to) {
        navigate(to)
      } else {
        navigate(-1)
      }
    } catch (error) {
      console.error('BackButton navigation error:', error)
      // 如果导航失败，尝试跳转到首页
      navigate('/')
    }
  }
  
  return (
    <button 
      className={`btn btn-secondary ${className}`} 
      onClick={handleClick}
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-secondary)',
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
    >
      <span style={{ fontSize: '14px' }}>←</span>
      <span>{text}</span>
    </button>
  )
}
