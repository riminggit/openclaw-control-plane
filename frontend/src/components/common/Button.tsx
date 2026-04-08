/**
 * Button - 按钮组件
 * 
 * 支持多种类型：
 * - primary: 主按钮（蓝色背景）
 * - default: 次按钮（白色背景）
 * - danger: 危险按钮（红色背景）
 */

import React from 'react'
import './Button.css'

export type ButtonType = 'primary' | 'default' | 'danger'
export type ButtonSize = 'small' | 'medium' | 'large'

interface ButtonProps {
  /** 按钮类型 */
  type?: ButtonType
  /** 按钮大小 */
  size?: ButtonSize
  /** 是否禁用 */
  disabled?: boolean
  /** 是否加载中 */
  loading?: boolean
  /** 点击事件 */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  /** 子元素 */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
  /** 按钮类型（HTML原生） */
  htmlType?: 'button' | 'submit' | 'reset'
}

export function Button({
  type = 'default',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  children,
  className = '',
  htmlType = 'button'
}: ButtonProps) {
  const classes = [
    'btn',
    `btn-${type}`,
    `btn-${size}`,
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ')
  
  return (
    <button
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      type={htmlType}
    >
      {loading && (
        <span className="btn-loading-icon">
          <span className="spinner"></span>
        </span>
      )}
      <span className="btn-content">{children}</span>
    </button>
  )
}
