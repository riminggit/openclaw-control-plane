/**
 * PageHeader - 页面头部组件
 * 
 * 修复：使用 styles.css 中定义的样式
 */

import React from 'react'
import { BackButton } from './BackButton'

interface Breadcrumb {
  label: string
  path?: string
}

interface PageHeaderProps {
  /** 页面标题 */
  title: string
  /** 页面副标题 */
  subtitle?: string
  /** 是否显示返回按钮，默认false（列表页不显示） */
  showBackButton?: boolean
  /** 返回按钮目标路径 */
  backTo?: string
  /** 返回按钮文字 */
  backText?: string
  /** 面包屑导航 */
  breadcrumbs?: Breadcrumb[]
  /** 操作按钮区 */
  actions?: React.ReactNode
  /** 自定义类名 */
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  showBackButton = false,
  backTo,
  backText,
  breadcrumbs,
  actions,
  className = ''
}: PageHeaderProps) {
  return (
    <div className={className} style={{ marginBottom: 'var(--space-8)' }}>
      {showBackButton && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <BackButton to={backTo} text={backText} />
        </div>
      )}
      
      <div className="page-header">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <div className="breadcrumb" style={{ marginBottom: 'var(--space-2)' }}>
            {breadcrumbs.map((crumb, index) => (
              <span key={index} style={{ display: 'inline-flex', alignItems: 'center' }}>
                {crumb.path ? (
                  <a href={crumb.path} style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                    {crumb.label}
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && (
                  <span style={{ margin: '0 var(--space-1)', color: 'var(--text-muted)' }}>/</span>
                )}
              </span>
            ))}
          </div>
        )}
        
        <h1 style={{ 
          fontSize: 'var(--text-2xl)', 
          fontWeight: 600, 
          color: 'var(--text-primary)',
          marginBottom: 'var(--space-1)' 
        }}>
          {title}
        </h1>
        
        {subtitle && (
          <p className="page-header-desc">{subtitle}</p>
        )}
      </div>
      
      {actions && (
        <div className="page-header-actions" style={{ marginTop: 'var(--space-4)' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
