# 工作流管理系统 - UI/UX设计规范文档

> **版本**: v1.0
> **日期**: 2026-04-02
> **作者**: rd-commander
> **步骤**: Step 6 - UI/UX设计

---

## ⚠️ 关键要求

**本文档是前端开发的强制规范，所有前端代码必须严格遵循本设计规范。**

特别是：
1. ✅ **所有页面（除列表页外）必须包含返回按钮**
2. ✅ **所有组件必须有完整样式**
3. ✅ **使用CSS变量定义主题色**
4. ✅ **响应式设计**

---

## 1. 设计原则

### 1.1 核心原则

1. **一致性**: 所有页面使用统一的颜色、间距、字体
2. **易用性**: 操作流程清晰，交互反馈明确
3. **可访问性**: 支持键盘导航，颜色对比度符合WCAG标准
4. **响应式**: 支持不同屏幕尺寸

### 1.2 设计系统

基于 Ant Design 设计语言，但使用自定义CSS实现，不依赖第三方UI库。

---

## 2. 颜色规范

### 2.1 主色调

```css
:root {
  /* 品牌色 */
  --color-primary: #1890ff;           /* 主色 - 蓝色 */
  --color-primary-hover: #40a9ff;     /* 主色悬停 */
  --color-primary-active: #096dd9;    /* 主色激活 */
  --color-primary-light: #e6f7ff;     /* 主色浅色背景 */
  
  /* 功能色 */
  --color-success: #52c41a;           /* 成功 - 绿色 */
  --color-success-hover: #73d13d;     /* 成功悬停 */
  --color-success-light: #f6ffed;     /* 成功浅色背景 */
  
  --color-warning: #faad14;           /* 警告 - 橙色 */
  --color-warning-hover: #ffc53d;     /* 警告悬停 */
  --color-warning-light: #fffbe6;     /* 警告浅色背景 */
  
  --color-error: #ff4d4f;             /* 错误 - 红色 */
  --color-error-hover: #ff7875;       /* 错误悬停 */
  --color-error-light: #fff1f0;       /* 错误浅色背景 */
  
  /* 中性色 */
  --color-text: #333333;              /* 主要文字 */
  --color-text-secondary: #666666;    /* 次要文字 */
  --color-text-tertiary: #999999;     /* 辅助文字 */
  --color-text-disabled: #c0c0c0;     /* 禁用文字 */
  
  /* 背景色 */
  --color-bg: #f5f5f5;                /* 页面背景 */
  --color-bg-white: #ffffff;          /* 白色背景（卡片） */
  --color-bg-hover: #fafafa;          /* 悬停背景 */
  --color-bg-active: #f0f0f0;         /* 激活背景 */
  
  /* 边框色 */
  --color-border: #d9d9d9;            /* 默认边框 */
  --color-border-hover: #40a9ff;      /* 悬停边框 */
  --color-border-active: #1890ff;     /* 激活边框 */
  
  /* 阴影 */
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-modal: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-dropdown: 0 2px 8px rgba(0, 0, 0, 0.15);
}
```

### 2.2 状态色

| 状态 | 颜色 | 使用场景 |
|------|------|---------|
| Pending | #999999 | 等待中 |
| Running | #1890ff | 运行中 |
| Completed | #52c41a | 已完成 |
| Failed | #ff4d4f | 失败 |
| Paused | #faad14 | 暂停 |
| Terminated | #ff4d4f | 已终止 |

---

## 3. 间距规范

### 3.1 基础间距

```css
:root {
  /* 基础间距单位 */
  --spacing-unit: 4px;
  
  /* 间距变量 */
  --spacing-xs: 4px;      /* 极小间距 */
  --spacing-sm: 8px;      /* 小间距 */
  --spacing-md: 16px;     /* 中等间距 */
  --spacing-lg: 24px;     /* 大间距 */
  --spacing-xl: 32px;     /* 超大间距 */
  
  /* 页面边距 */
  --spacing-page: 24px;   /* 页面左右边距 */
  
  /* 卡片间距 */
  --spacing-card: 16px;   /* 卡片内边距 */
  --spacing-card-gap: 16px; /* 卡片之间的间距 */
  
  /* 元素间距 */
  --spacing-element: 8px; /* 表单元素之间的间距 */
  --spacing-section: 24px; /* 区块之间的间距 */
}
```

### 3.2 使用示例

```css
/* 页面容器 */
.page-container {
  padding: var(--spacing-page);
}

/* 卡片 */
.card {
  padding: var(--spacing-card);
  margin-bottom: var(--spacing-card-gap);
}

/* 表单项 */
.form-item {
  margin-bottom: var(--spacing-element);
}
```

---

## 4. 字体规范

### 4.1 字体家族

```css
:root {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 
                 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', 
                 Helvetica, Arial, sans-serif;
  
  /* 等宽字体（用于代码） */
  --font-family-mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 
                      Courier, monospace;
}
```

### 4.2 字体大小

```css
:root {
  --font-size-xs: 12px;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --font-size-xxl: 20px;
  --font-size-heading: 24px;
  --font-size-display: 32px;
}
```

### 4.3 字重

```css
:root {
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;
}
```

### 4.4 行高

```css
:root {
  --line-height-tight: 1.2;
  --line-height-base: 1.5;
  --line-height-loose: 1.8;
}
```

---

## 5. 按钮规范

### 5.1 按钮类型

```css
:root {
  /* 按钮尺寸 */
  --button-height-sm: 24px;
  --button-height: 32px;
  --button-height-lg: 40px;
  
  --button-padding-sm: 0 7px;
  --button-padding: 0 15px;
  --button-padding-lg: 0 24px;
  
  --button-radius: 4px;
}
```

### 5.2 主按钮（Primary Button）

**样式**：
```css
.btn-primary {
  height: var(--button-height);
  padding: var(--button-padding);
  border-radius: var(--button-radius);
  border: none;
  background-color: var(--color-primary);
  color: white;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary:hover {
  background-color: var(--color-primary-hover);
}

.btn-primary:active {
  background-color: var(--color-primary-active);
}

.btn-primary:disabled {
  background-color: #d9d9d9;
  color: var(--color-text-disabled);
  cursor: not-allowed;
}
```

**使用场景**：
- 保存按钮
- 提交按钮
- 创建按钮
- 确认按钮

### 5.3 次按钮（Default Button）

**样式**：
```css
.btn-default {
  height: var(--button-height);
  padding: var(--button-padding);
  border-radius: var(--button-radius);
  border: 1px solid var(--color-border);
  background-color: white;
  color: var(--color-text);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-normal);
  cursor: pointer;
  transition: all 0.3s;
}

.btn-default:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-default:active {
  border-color: var(--color-primary-active);
  color: var(--color-primary-active);
}

.btn-default:disabled {
  border-color: #d9d9d9;
  color: var(--color-text-disabled);
  cursor: not-allowed;
}
```

**使用场景**：
- 取消按钮
- 关闭按钮
- 次要操作按钮

### 5.4 返回按钮（Back Button）⚠️ **关键组件**

**样式**：
```css
.btn-back {
  height: var(--button-height);
  padding: var(--button-padding);
  border-radius: var(--button-radius);
  border: 1px solid var(--color-border);
  background-color: white;
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  transition: all 0.3s;
}

.btn-back:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.btn-back-icon {
  font-size: 16px;
}
```

**组件代码**：
```tsx
// components/common/BackButton.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import './BackButton.css'

interface BackButtonProps {
  to?: string
  text?: string
}

export function BackButton({ to, text = '返回' }: BackButtonProps) {
  const navigate = useNavigate()
  
  const handleClick = () => {
    if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }
  
  return (
    <button className="btn-back" onClick={handleClick}>
      <span className="btn-back-icon">←</span>
      <span>{text}</span>
    </button>
  )
}
```

**使用示例**：
```tsx
// pages/workflows/CreateTemplate.tsx
import { BackButton } from '@/components/common/BackButton'

export default function CreateTemplate() {
  return (
    <div className="page-container">
      <div className="page-header">
        <BackButton to="/workflows/templates" />
        <h1 className="page-title">创建工作流模板</h1>
      </div>
      
      {/* 页面内容 */}
    </div>
  )
}
```

**⚠️ 强制要求**：
- **所有非列表页面必须包含返回按钮**
- 返回按钮应该放在页面左上角
- 返回按钮文字应该是"返回"
- 返回按钮图标是左箭头（←）

### 5.5 危险按钮（Danger Button）

**样式**：
```css
.btn-danger {
  height: var(--button-height);
  padding: var(--button-padding);
  border-radius: var(--button-radius);
  border: none;
  background-color: var(--color-error);
  color: white;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.3s;
}

.btn-danger:hover {
  background-color: var(--color-error-hover);
}

.btn-danger:disabled {
  background-color: #d9d9d9;
  color: var(--color-text-disabled);
  cursor: not-allowed;
}
```

**使用场景**：
- 删除按钮
- 终止按钮
- 拒绝按钮

---

## 6. 卡片规范

### 6.1 基础卡片

**样式**：
```css
:root {
  --card-radius: 8px;
  --card-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  --card-padding: 16px;
}

.card {
  background-color: white;
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: var(--card-padding);
  transition: all 0.3s;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
}

.card-body {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.card-footer {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
```

### 6.2 模板卡片（TemplateCard）

**布局**：
```
┌─────────────────────────────────────┐
│ 📋 研发流水线-标准流程              │ [编辑] [删除]
│ v1.0                               │
├─────────────────────────────────────┤
│ 完整的20步研发流水线，包含需求、设  │
│ 计、开发、测试、部署全流程。        │
│                                     │
│ 标签：[研发] [标准流程]             │
├─────────────────────────────────────┤
│ ✅ 已发布  📊 使用次数: 15          │
└─────────────────────────────────────┘
```

**样式**：
```css
.template-card {
  /* 继承基础卡片样式 */
}

.template-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.template-card-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin-bottom: var(--spacing-xs);
}

.template-card-version {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
}

.template-card-description {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  margin: var(--spacing-md) 0;
}

.template-card-tags {
  display: flex;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-md);
}

.template-card-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
}

.template-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.template-card-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.template-card-actions {
  display: flex;
  gap: var(--spacing-sm);
}
```

### 6.3 实例卡片（InstanceCard）

**布局**：
```
┌─────────────────────────────────────┐
│ 🔄 研发流水线-OpenClaw Control Plane│ [查看详情]
│ 基于: 研发流水线-标准流程 v1.0      │
├─────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░ 65%           │
│                                     │
│ 当前步骤: PRD 编写 (rd-product-manager)
│ 运行中...                           │
├─────────────────────────────────────┤
│ 🟢 运行中  ⏱ 剩余时间: 30分钟      │
└─────────────────────────────────────┘
```

---

## 7. 页面布局设计

### 7.1 页面结构

所有页面遵循统一的结构：

```tsx
<div className="page-container">
  {/* 页面头部 */}
  <div className="page-header">
    <BackButton to="/xxx" /> {/* 列表页除外 */}
    <div className="page-header-content">
      <h1 className="page-title">页面标题</h1>
      <p className="page-subtitle">页面描述（可选）</p>
    </div>
    <div className="page-header-actions">
      {/* 操作按钮 */}
    </div>
  </div>
  
  {/* 页面内容 */}
  <div className="page-content">
    {/* 内容区域 */}
  </div>
</div>
```

### 7.2 页面头部样式

```css
.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.page-header-content {
  flex: 1;
}

.page-title {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  margin-bottom: 0;
}

.page-header-actions {
  display: flex;
  gap: var(--spacing-sm);
}
```

---

## 8. 具体页面设计

### 8.1 模板库页面（/workflows/templates）

**布局**：
```
┌─────────────────────────────────────────────────────┐
│ 📋 工作流模板库                   [+ 创建模板]      │
├─────────────────────────────────────────────────────┤
│ 🔍 搜索模板...  [状态 ▼] [标签 ▼]                  │
├─────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │ 模板卡片1    │ │ 模板卡片2    │ │ 模板卡片3    ││
│ │              │ │              │ │              ││
│ │              │ │              │ │              ││
│ └──────────────┘ └──────────────┘ └──────────────┘│
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│ │ 模板卡片4    │ │ 模板卡片5    │ │ 模板卡片6    ││
│ │              │ │              │ │              ││
│ │              │ │              │ │              ││
│ └──────────────┘ └──────────────┘ └──────────────┘│
│                                                     │
│ 显示 1-6 / 共 15 条                [上一页] [下一页]│
└─────────────────────────────────────────────────────┘
```

**关键元素**：
- ✅ 页面标题："工作流模板库"
- ✅ 创建模板按钮（主按钮）
- ✅ 搜索栏
- ✅ 筛选器（状态、标签）
- ✅ 模板卡片网格布局（3列）
- ✅ 分页器
- ❌ **不需要返回按钮**（这是列表页）

### 8.2 创建模板页面（/workflows/templates/create）

**布局**：
```
┌─────────────────────────────────────────────────────┐
│ [← 返回]  创建工作流模板                            │
├─────────────────────────────────────────────────────┤
│ 基本信息                                            │
│ ┌─────────────────────────────────────────────────┐│
│ │ 模板名称 *                                       ││
│ │ ┌─────────────────────────────────────────────┐ ││
│ │ │ 请输入模板名称                               │ ││
│ │ └─────────────────────────────────────────────┘ ││
│ │                                                 ││
│ │ 模板描述                                         ││
│ │ ┌─────────────────────────────────────────────┐ ││
│ │ │ 请输入模板描述                               │ ││
│ │ │                                             │ ││
│ │ └─────────────────────────────────────────────┘ ││
│ │                                                 ││
│ │ 标签                                             ││
│ │ ┌─────────┐ ┌─────────┐ ┌─────────┐            ││
│ │ │ 研发 ✕  │ │ 测试 ✕  │ │ + 添加  │            ││
│ │ └─────────┘ └─────────┘ └─────────┘            ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ DAG 配置                                            │
│ ┌─────────────────────────────────────────────────┐│
│ │                                                 ││
│ │     ┌──────┐                                    ││
│ │     │ 步骤1│ ────→ ┌──────┐                    ││
│ │     └──────┘       │ 步骤2│ ────→ ┌──────┐    ││
│ │                     └──────┘       │ 步骤3│    ││
│ │                                    └──────┘    ││
│ │                                     │          ││
│ │ [添加步骤] [添加边] [验证DAG]       ↓          ││
│ │                                    完成        ││
│ │                                                 ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│ 高级配置                                            │
│ ┌─────────────────────────────────────────────────┐│
│ │ 单步骤超时 (秒): [  300  ]                       ││
│ │ 工作流超时 (秒): [ 3600  ]                       ││
│ │ 最大重试次数:     [   3   ]                      ││
│ │ 失败策略:         [重试 ▼]                       ││
│ └─────────────────────────────────────────────────┘│
│                                                     │
│                        [取消] [保存为草稿] [发布] │
└─────────────────────────────────────────────────────┘
```

**关键元素**：
- ✅ **返回按钮**（必须，返回到模板库）
- ✅ 页面标题："创建工作流模板"
- ✅ 基本信息表单（名称、描述、标签）
- ✅ DAG编辑器（可视化编辑）
- ✅ 高级配置表单
- ✅ 操作按钮：取消、保存为草稿、发布
- ✅ 表单验证

### 8.3 实例管理页面（/workflows/instances）

**布局**：
```
┌─────────────────────────────────────────────────────┐
│ 🔄 工作流实例                       [+ 启动新实例]  │
├─────────────────────────────────────────────────────┤
│ 🔍 搜索实例...  [状态 ▼] [模板 ▼] [时间 ▼]        │
├─────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────┐  │
│ │ 🔄 研发流水线-OpenClaw Control Plane         │  │
│ │ 基于: 研发流水线-标准流程 v1.0               │  │
│ │ ▓▓▓▓▓▓▓▓░░░░░░░░░░░ 65%                     │  │
│ │ 当前步骤: PRD 编写 (rd-product-manager)      │  │
│ │ 🟢 运行中  ⏱ 剩余时间: 30分钟  [查看详情]   │  │
│ └──────────────────────────────────────────────┘  │
│ ┌──────────────────────────────────────────────┐  │
│ │ ✅ 研发流水线-用户管理系统                   │  │
│ │ 基于: 研发流水线-标准流程 v1.0               │  │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 100%                   │  │
│ │ 已完成，共20步                              │  │
│ │ ✅ 已完成  ⏱ 耗时: 2小时30分  [查看详情]    │  │
│ └──────────────────────────────────────────────┘  │
│                                                     │
│ 显示 1-2 / 共 10 条                [上一页] [下一页]│
└─────────────────────────────────────────────────────┘
```

**关键元素**：
- ✅ 页面标题："工作流实例"
- ✅ 启动新实例按钮（主按钮）
- ✅ 搜索栏
- ✅ 筛选器（状态、模板、时间）
- ✅ 实例卡片列表
- ✅ 进度条
- ✅ 状态徽章
- ✅ 操作按钮（查看详情、暂停、终止）
- ❌ **不需要返回按钮**（这是列表页）

---

## 9. 表单元素样式

### 9.1 输入框（Input）

```css
.input {
  height: var(--button-height);
  padding: 4px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--button-radius);
  font-size: var(--font-size-base);
  color: var(--color-text);
  transition: all 0.3s;
}

.input:hover {
  border-color: var(--color-primary);
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.input:disabled {
  background-color: #f5f5f5;
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.input-error {
  border-color: var(--color-error);
}

.input-error:focus {
  box-shadow: 0 0 0 2px var(--color-error-light);
}
```

### 9.2 文本域（Textarea）

```css
.textarea {
  padding: 4px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--button-radius);
  font-size: var(--font-size-base);
  color: var(--color-text);
  min-height: 80px;
  resize: vertical;
  transition: all 0.3s;
}

.textarea:hover {
  border-color: var(--color-primary);
}

.textarea:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}
```

### 9.3 下拉框（Select）

```css
.select {
  height: var(--button-height);
  padding: 4px 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--button-radius);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background-color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.select:hover {
  border-color: var(--color-primary);
}

.select:focus {
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary-light);
}
```

### 9.4 标签（Tag）

```css
.tag {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  cursor: default;
}

.tag-removable {
  cursor: pointer;
}

.tag-remove-icon {
  font-size: 12px;
  opacity: 0.6;
  transition: opacity 0.3s;
}

.tag-remove-icon:hover {
  opacity: 1;
}
```

---

## 10. 状态徽章（StatusBadge）

### 10.1 样式定义

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.status-badge-pending {
  background-color: #f0f0f0;
  color: var(--color-text-secondary);
}

.status-badge-running {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.status-badge-completed {
  background-color: var(--color-success-light);
  color: var(--color-success);
}

.status-badge-failed {
  background-color: var(--color-error-light);
  color: var(--color-error);
}

.status-badge-paused {
  background-color: var(--color-warning-light);
  color: var(--color-warning);
}

.status-badge-terminated {
  background-color: var(--color-error-light);
  color: var(--color-error);
}
```

---

## 11. 进度条（ProgressBar）

```css
.progress-bar {
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-inner {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: 4px;
  transition: width 0.3s;
}

.progress-bar-success .progress-bar-inner {
  background-color: var(--color-success);
}

.progress-bar-error .progress-bar-inner {
  background-color: var(--color-error);
}
```

---

## 12. 响应式设计

### 12.1 断点定义

```css
/* 移动设备 */
@media (max-width: 576px) {
  .page-container {
    padding: var(--spacing-md);
  }
  
  .card-grid {
    grid-template-columns: 1fr;
  }
}

/* 平板设备 */
@media (min-width: 577px) and (max-width: 992px) {
  .page-container {
    padding: var(--spacing-lg);
  }
  
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 桌面设备 */
@media (min-width: 993px) {
  .page-container {
    padding: var(--spacing-page);
  }
  
  .card-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 13. 动画与过渡

### 13.1 全局过渡

```css
:root {
  --transition-fast: 0.15s;
  --transition-base: 0.3s;
  --transition-slow: 0.5s;
}

/* 通用过渡类 */
.transition {
  transition: all var(--transition-base);
}

.transition-fast {
  transition: all var(--transition-fast);
}

.transition-slow {
  transition: all var(--transition-slow);
}
```

### 13.2 淡入淡出

```css
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

.fade-in {
  animation: fadeIn var(--transition-base);
}

.fade-out {
  animation: fadeOut var(--transition-base);
}
```

### 13.3 滑入滑出

```css
@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-10px);
    opacity: 0;
  }
}

.slide-in {
  animation: slideIn var(--transition-base);
}
```

---

## 14. 工具类（Utilities）

### 14.1 间距工具类

```css
.mt-0 { margin-top: 0; }
.mt-1 { margin-top: var(--spacing-xs); }
.mt-2 { margin-top: var(--spacing-sm); }
.mt-3 { margin-top: var(--spacing-md); }
.mt-4 { margin-top: var(--spacing-lg); }

.mb-0 { margin-bottom: 0; }
.mb-1 { margin-bottom: var(--spacing-xs); }
.mb-2 { margin-bottom: var(--spacing-sm); }
.mb-3 { margin-bottom: var(--spacing-md); }
.mb-4 { margin-bottom: var(--spacing-lg); }

.pt-0 { padding-top: 0; }
.pt-1 { padding-top: var(--spacing-xs); }
.pt-2 { padding-top: var(--spacing-sm); }
.pt-3 { padding-top: var(--spacing-md); }
.pt-4 { padding-top: var(--spacing-lg); }

.pb-0 { padding-bottom: 0; }
.pb-1 { padding-bottom: var(--spacing-xs); }
.pb-2 { padding-bottom: var(--spacing-sm); }
.pb-3 { padding-bottom: var(--spacing-md); }
.pb-4 { padding-bottom: var(--spacing-lg); }
```

### 14.2 Flex工具类

```css
.flex { display: flex; }
.flex-column { flex-direction: column; }
.flex-center { align-items: center; justify-content: center; }
.flex-between { justify-content: space-between; }
.flex-around { justify-content: space-around; }
.flex-wrap { flex-wrap: wrap; }
.flex-1 { flex: 1; }
```

### 14.3 文本工具类

```css
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-right { text-align: right; }
.text-bold { font-weight: var(--font-weight-bold); }
.text-primary { color: var(--color-primary); }
.text-success { color: var(--color-success); }
.text-warning { color: var(--color-warning); }
.text-error { color: var(--color-error); }
.text-secondary { color: var(--color-text-secondary); }
.text-tertiary { color: var(--color-text-tertiary); }
```

---

## 15. 实施检查清单

在开发前端代码时，必须确保以下检查项全部通过：

### 15.1 返回按钮检查

- [ ] CreateTemplate页面有返回按钮
- [ ] TemplateDetail页面有返回按钮
- [ ] InstanceDetail页面有返回按钮
- [ ] 所有编辑页面有返回按钮
- [ ] 列表页面不需要返回按钮

### 15.2 样式检查

- [ ] 所有组件使用了CSS变量
- [ ] 颜色使用规范中定义的颜色
- [ ] 间距使用规范中定义的间距
- [ ] 字体使用规范中定义的字体大小
- [ ] 按钮样式符合规范
- [ ] 卡片样式符合规范
- [ ] 表单元素样式符合规范

### 15.3 功能检查

- [ ] 返回按钮功能正常工作
- [ ] 表单验证功能正常
- [ ] 状态徽章显示正确
- [ ] 进度条显示正确
- [ ] 加载状态显示正确
- [ ] 错误提示显示正确
- [ ] 成功提示显示正确

### 15.4 响应式检查

- [ ] 移动设备布局正确
- [ ] 平板设备布局正确
- [ ] 桌面设备布局正确
- [ ] 卡片网格响应式布局正确
- [ ] 表单响应式布局正确

### 15.5 交互检查

- [ ] 按钮hover效果正常
- [ ] 按钮active效果正常
- [ ] 输入框focus效果正常
- [ ] 卡片hover效果正常
- [ ] 动画过渡流畅

---

## 16. 前端开发实施指南

### 16.1 开发流程

1. **创建CSS变量文件** (`styles/variables.css`)
   - 复制本文档第2-4节的CSS变量定义
   - 确保所有变量都正确定义

2. **创建全局样式文件** (`styles/global.css`)
   - 导入variables.css
   - 定义全局样式（重置样式、通用样式）

3. **创建通用组件**
   - PageHeader组件（包含返回按钮）
   - Button组件
   - Card组件
   - StatusBadge组件
   - ProgressBar组件

4. **创建页面组件**
   - Templates.tsx（模板列表）
   - CreateTemplate.tsx（创建模板）
   - TemplateDetail.tsx（模板详情）
   - Instances.tsx（实例列表）
   - InstanceDetail.tsx（实例详情）

5. **应用样式**
   - 每个组件都有对应的CSS Module
   - 严格按照设计规范编写样式
   - 使用CSS变量，不使用硬编码颜色

### 16.2 组件开发示例

#### 16.2.1 PageHeader组件

```tsx
// components/common/PageHeader.tsx
import React from 'react'
import { BackButton } from './BackButton'
import './PageHeader.css'

interface PageHeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backTo?: string
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  showBackButton = true,
  backTo,
  actions
}: PageHeaderProps) {
  return (
    <div className="page-header">
      {showBackButton && <BackButton to={backTo} />}
      
      <div className="page-header-content">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      
      {actions && (
        <div className="page-header-actions">
          {actions}
        </div>
      )}
    </div>
  )
}
```

```css
/* components/common/PageHeader.css */
.page-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.page-header-content {
  flex: 1;
}

.page-title {
  font-size: var(--font-size-heading);
  font-weight: var(--font-weight-bold);
  color: var(--color-text);
  margin: 0;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  margin-top: var(--spacing-xs);
  margin-bottom: 0;
}

.page-header-actions {
  display: flex;
  gap: var(--spacing-sm);
}
```

#### 16.2.2 CreateTemplate页面

```tsx
// pages/workflows/CreateTemplate.tsx
import React, { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { DAGEditor } from '@/components/workflow/DAGEditor'
import './CreateTemplate.css'

export default function CreateTemplate() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [dag, setDag] = useState<DAG>({ steps: [], edges: [] })
  
  const handleSave = async () => {
    // 保存逻辑
  }
  
  const handleCancel = () => {
    // 取消逻辑
  }
  
  return (
    <div className="page-container">
      <PageHeader
        title="创建工作流模板"
        subtitle="定义一个新的工作流模板"
        backTo="/workflows/templates"
      />
      
      <div className="create-template-content">
        {/* 基本信息卡片 */}
        <Card className="create-template-card">
          <div className="card-header">
            <h3 className="card-title">基本信息</h3>
          </div>
          <div className="card-body">
            <div className="form-item">
              <label className="form-label">模板名称 *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入模板名称"
              />
            </div>
            
            <div className="form-item">
              <label className="form-label">模板描述</label>
              <textarea
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请输入模板描述"
                rows={4}
              />
            </div>
            
            <div className="form-item">
              <label className="form-label">标签</label>
              {/* 标签输入组件 */}
            </div>
          </div>
        </Card>
        
        {/* DAG编辑器卡片 */}
        <Card className="create-template-card">
          <div className="card-header">
            <h3 className="card-title">DAG配置</h3>
          </div>
          <div className="card-body">
            <DAGEditor dag={dag} onChange={setDag} />
          </div>
        </Card>
        
        {/* 操作按钮 */}
        <div className="create-template-actions">
          <Button variant="default" onClick={handleCancel}>
            取消
          </Button>
          <Button variant="default" onClick={() => handleSave('draft')}>
            保存为草稿
          </Button>
          <Button variant="primary" onClick={() => handleSave('published')}>
            发布
          </Button>
        </div>
      </div>
    </div>
  )
}
```

```css
/* pages/workflows/CreateTemplate.css */
.create-template-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.create-template-card {
  /* 继承Card样式 */
}

.form-item {
  margin-bottom: var(--spacing-md);
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-text);
}

.create-template-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background-color: white;
  border-radius: var(--card-radius);
  box-shadow: var(--shadow-card);
}
```

### 16.3 CSS Module使用规范

每个组件都应该有对应的CSS Module文件：

```
components/
├── common/
│   ├── PageHeader.tsx
│   ├── PageHeader.css       ← 对应样式文件
│   ├── Button.tsx
│   ├── Button.css
│   └── Card.tsx
│       Card.css
```

### 16.4 样式导入方式

```tsx
// 正确方式：使用CSS Module
import './PageHeader.css'

// 错误方式：不要使用styled-components或内联样式
// const style = { color: '#1890ff' }  // ❌
// <div style={style}>                 // ❌
```

---

## 17. 验证与测试

### 17.1 视觉验证

1. **颜色验证**
   - 检查所有颜色是否使用CSS变量
   - 检查颜色是否符合设计规范
   - 使用浏览器开发者工具检查

2. **间距验证**
   - 检查所有间距是否使用CSS变量
   - 检查间距是否符合设计规范
   - 使用标尺工具测量

3. **字体验证**
   - 检查字体大小是否使用CSS变量
   - 检查字体大小是否符合设计规范
   - 检查字体家族是否正确

### 17.2 功能验证

1. **返回按钮验证**
   - 访问每个页面，检查返回按钮是否存在
   - 点击返回按钮，检查是否正确跳转
   - 检查返回按钮样式是否符合规范

2. **表单验证**
   - 测试所有表单输入
   - 测试表单验证规则
   - 测试错误提示

3. **交互验证**
   - 测试所有按钮hover效果
   - 测试所有输入框focus效果
   - 测试所有动画效果

### 17.3 响应式验证

1. **移动设备验证**（宽度 < 576px）
   - 单列布局
   - 按钮全宽
   - 字体大小适当

2. **平板设备验证**（576px - 992px）
   - 双列布局
   - 按钮自适应
   - 字体大小适中

3. **桌面设备验证**（宽度 > 992px）
   - 三列布局
   - 按钮标准大小
   - 字体大小标准

---

## 18. 设计资源

### 18.1 设计文件

- 颜色规范：本文档第2节
- 间距规范：本文档第3节
- 字体规范：本文档第4节
- 按钮规范：本文档第5节
- 卡片规范：本文档第6节

### 18.2 图标资源

使用Unicode字符或SVG图标：
- 返回：← (U+2190)
- 删除：× (U+00D7)
- 添加：+ (U+002B)
- 编辑：✎ (U+270E)
- 成功：✓ (U+2713)
- 错误：✕ (U+2715)

### 18.3 字体资源

使用系统字体，无需额外下载：
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 
             'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

---

## 19. 常见问题（FAQ）

### Q1: 为什么要强制使用CSS变量？

**A**: CSS变量可以：
1. 确保整个应用的样式一致性
2. 方便后期主题切换
3. 易于维护和修改
4. 避免硬编码颜色值

### Q2: 为什么所有页面都需要返回按钮？

**A**: 返回按钮提供：
1. 明确的导航路径
2. 良好的用户体验
3. 符合Web应用的常规交互模式
4. 减少用户迷失

### Q3: 为什么不使用Ant Design等UI库？

**A**: 自定义CSS可以：
1. 完全控制样式
2. 减少包体积
3. 提高性能
4. 学习CSS基础知识

### Q4: 如何处理响应式设计？

**A**: 使用媒体查询：
1. 移动设备优先
2. 渐进增强
3. 断点设计合理
4. 流式布局

---

## 20. 总结

本UI/UX设计规范文档是前端开发的强制标准，包含：

1. ✅ 完整的颜色规范
2. ✅ 完整的间距规范
3. ✅ 完整的字体规范
4. ✅ 完整的按钮规范（包含返回按钮）
5. ✅ 完整的卡片规范
6. ✅ 所有页面的布局设计
7. ✅ 组件开发示例
8. ✅ 实施检查清单
9. ✅ 验证与测试方法

**关键要求**：
- ⚠️ **所有非列表页面必须包含返回按钮**
- ⚠️ **所有组件必须有完整样式**
- ⚠️ **必须使用CSS变量**
- ⚠️ **必须遵循响应式设计**

**下一步**: 进入 Step 7 - 接口设计（复核现有API设计）

---

**文档版本**: v1.0
**最后更新**: 2026-04-02
**维护者**: rd-commander�