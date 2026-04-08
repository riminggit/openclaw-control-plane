# Frontend Tests

## 测试框架

本项目使用以下测试工具：
- **Vitest** - 测试运行器（与Vite无缝集成）
- **@testing-library/react** - React组件测试工具
- **@testing-library/user-event** - 用户交互模拟
- **jsdom** - DOM环境模拟

## 安装测试依赖

```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom @vitest/ui
```

## 运行测试

```bash
# 运行所有测试
npm run test

# 运行测试并监听文件变化
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 启动测试UI界面
npm run test:ui
```

## 测试文件结构

```
frontend/
├── tests/
│   ├── setup.ts          # 测试环境配置
│   ├── api/              # API调用测试
│   │   ├── templates.test.ts
│   │   ├── instances.test.ts
│   │   └── workflow.test.ts
│   ├── components/       # 组件测试
│   │   ├── DAGEditor.test.tsx
│   │   └── ReviewModal.test.tsx
│   └── hooks/            # Hooks测试
│       ├── useWorkflow.test.ts
│       └── useWebSocket.test.ts
```

## 测试规范

### 测试用例结构

每个测试用例应包含：
1. **前置条件** - 设置测试环境
2. **操作步骤** - 执行具体操作
3. **预期结果** - 验证结果正确性

### 禁止使用的占位符

- ❌ 空测试函数
- ❌ `xit()` 或 `xdescribe()` 跳过测试
- ❌ 没有断言的测试

### 测试最佳实践

1. 使用描述性的测试名称
2. 一个测试只验证一个功能点
3. 使用 `beforeEach` 和 `afterEach` 进行清理
4. Mock外部依赖（API调用、WebSocket等）
5. 测试用户交互，而非实现细节

## 示例测试

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'

describe('MyComponent', () => {
  it('should render correctly', () => {
    // 前置条件
    render(<MyComponent title="Test" />)
    
    // 操作步骤
    const element = screen.getByText('Test')
    
    // 预期结果
    expect(element).toBeInTheDocument()
  })
  
  it('should handle click event', async () => {
    // 前置条件
    const handleClick = vi.fn()
    render(<MyComponent onClick={handleClick} />)
    
    // 操作步骤
    const button = screen.getByRole('button')
    await userEvent.click(button)
    
    // 预期结果
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```
