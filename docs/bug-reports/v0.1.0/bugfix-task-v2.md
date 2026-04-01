# Bug修复任务清单 v2

## 项目路径
- 前端：`/root/.openclaw/workspace/project/openclaw-control-plane/frontend`
- 后端：`/root/.openclaw/workspace/project/openclaw-control-plane/backend`
- 后端运行中：`uvicorn app.main:app --host 0.0.0.0 --port 8000`

## 后端API验证结果（全部正常返回数据）

| 端点 | 状态 | 返回格式 |
|------|------|----------|
| `/api/agents-mgmt/list` | ✅ | `{agents: [{id, name, config: {model: {primary, fallbacks}, ...}, ...}], total: 42}` |
| `/api/skills/installed` | ✅ | `{skills: [{name, description?, version?, status?}]}` |
| `/api/skills/list` | ✅ | `{skills: [{name}]}` |
| `/api/skills/search` | ✅ | 取决于query |
| `/api/memory/files` | ✅ | `{files: [{name, path, size_bytes, modified_at}], base}` |
| `/api/memory/tree` | ✅ | 文件树数组 |
| `/api/memory/agents` | ✅ | agent列表 |
| `/api/channels/list` | ✅ | `{channels: [{type, enabled, config, plugin_loaded}], total}` |
| `/api/channels/status` | ✅ | `{channels: [{type, enabled, config, plugin_loaded}]}` |
| `/api/usage/summary` | ✅ | `{period_days, total_tokens, total_sessions, ...}` |
| `/api/usage/sessions` | ✅ | `{sessions: [...]}` |
| `/api/usage/by-model` | ✅ | `{models: [...]}` |
| `/api/analytics/cost/summary` | ✅ | `{today: {tokens, cost_usd}, week: {...}, month: {...}}` |

---

## Bug 1: Agent面板没有获取真实的agent

### 根因分析
前端 `AgentsPage.tsx` 通过 `agentsMgmtApi.list()` 调用 `/api/agents-mgmt/list`，API路径正确。

但 `agentsMgmt.ts` 的 `Agent` 接口定义为：
```ts
interface Agent {
  id: string; name: string; description?: string; model: string;
  thinking?: boolean; systemPrompt?: string; status?: 'online' | 'offline';
  channels?: string[]; createdAt?: string; updatedAt?: string;
}
```

而后端实际返回的数据格式是：
```json
{
  "id": "main",
  "name": "main", 
  "config": {
    "model": {"primary": "zhipu/GLM-5-Turbo", "fallbacks": [...]},
    "bootstrapMaxChars": 15000, ...
  }
}
```

**核心问题**：
1. `Agent.model` 期望是 `string`，但后端返回的是 `config.model` (对象)
2. `Agent.description`、`Agent.status`、`Agent.channels` 后端不返回，永远是 undefined
3. 页面显示 `agent.model` 时拿到的是 `undefined`（显示空badge），`agent.status` 是 `undefined`（永远灰色）

### 修复方案
1. 修改 `src/api/modules/agentsMgmt.ts` 的 `Agent` 接口，匹配后端实际返回格式：
   ```ts
   interface Agent {
     id: string
     name: string
     config: {
       model?: string | { primary?: string; fallbacks?: string[] }
       workspace?: string
       agentDir?: string
       subagents?: { allowAgents: string[] }
       bootstrapMaxChars?: number
       [key: string]: any
     }
   }
   ```
2. 在 `agentsMgmtApi.list()` 的 `.then()` 中做数据映射，把后端格式转为前端需要的格式：
   ```ts
   list: () => apiGet<{agents: RawAgent[]; total: number}>('/agents-mgmt/list')
     .then(d => d.agents.map(a => ({
       id: a.id,
       name: a.name,
       description: a.config?.name || a.name,
       model: typeof a.config?.model === 'string' ? a.config.model : a.config?.model?.primary || 'unknown',
       status: 'online' as const,  // 后端没有status字段，从gateway推断为online
       channels: [],
       workspace: a.config?.workspace,
     })))
   ```
3. 或者更好的方案：修改后端 `agents_mgmt.py` 的 `/list` 端点，返回前端需要的扁平化字段。**推荐这个方案，因为其他地方也需要。**

### 验证
```bash
curl -s http://localhost:8000/api/agents-mgmt/list | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'agents={d[\"total\"]}, first={d[\"agents\"][0][\"id\"]}')"
```

---

## Bug 2: 所有input和select框样式有问题

### 根因分析
1. `styles.css` 第73行全局重置：`input, select, textarea, button { font-family: inherit; font-size: inherit; }` — 这会影响antd组件内部的input
2. 多个页面使用裸 `<input>` 和 `<Select>` 混用：
   - `AnalyticsPage.tsx` 第110-116行：`<input className="form-input">` — 但 `styles.css` 中**没有定义 `.form-input` 类**！
   - `CronPage.tsx`：同样使用未定义的 `form-input` 类
   - `SkillsPage.tsx` 第85行：裸 `<input>` 带 inline styles
   - `MemoryPage.tsx` 第90行：裸 `<input>` 带 inline styles
3. antd 的 `Input` 和 `Select` 已经在多个页面正确使用（如 `AgentsPage.tsx`, `ChannelsPage.tsx`），但混用了裸input和antd Input

### 修复方案
1. **定义 `.form-input` CSS类**（在 `styles.css` 中添加），统一裸input样式
2. **或者更优方案**：把所有裸 `<input>` 替换为 antd `<Input>` 组件，把裸 `<select>` 替换为 antd `<Select>`
3. 修改全局重置，不影响antd：把 `input, select, textarea` 改为更具体的选择器，或者用 `input:not(.ant-input), select:not(.ant-select)` 等

### 需要修改的文件
- `src/styles.css` — 添加 `.form-input` 定义 + 修正全局重置
- `src/pages/AnalyticsPage.tsx` — 第110/116行 裸input → antd Input
- `src/pages/CronPage.tsx` — 多处裸input → antd Input
- `src/pages/SkillsPage.tsx` — 第85行 裸input → antd Input
- `src/pages/MemoryPage.tsx` — 第90行 裸input → antd Input

---

## Bug 3: 记忆文件等各方面都获取不到

### 根因分析
`MemoryPage.tsx` 调用：
- `fetch('/api/memory/tree?agent=main')` — 后端有此端点 ✅
- `fetch('/api/memory/agents')` — 后端有此端点 ✅
- `fetch('/api/memory/file?agent=main&path=xxx')` — 后端有此端点 ✅

需要curl验证实际返回的数据格式是否匹配前端期望：
- `/api/memory/tree` 前端期望 `FileNode[]` 格式（`{name, path, type: 'file'|'folder', children?}`）
- `/api/memory/agents` 前端期望 `string[]`

### 验证步骤
```bash
curl -s http://localhost:8000/api/memory/tree?agent=main | head -200
curl -s http://localhost:8000/api/memory/agents | head -50
curl -s "http://localhost:8000/api/memory/file?agent=main&path=2026-04-01.md" | head -200
```

### 可能的问题
1. 后端 `/api/memory/tree` 返回的是扁平文件列表（`{name, path, size_bytes, modified_at}`），不是树形结构
2. 前端期望 `{type: 'file'|'folder', children?}` 格式用于渲染树，但后端返回的是 `{name, path, size_bytes}` 格式
3. `/api/memory/agents` 后端可能返回空数组或不返回

### 修复方案
1. 如果后端 `/tree` 返回扁平列表 → 前端需要把扁平列表转为树形结构，或者修改后端返回树形
2. 如果后端 `/agents` 返回的不是 `string[]` → 修正前端数据解包
3. 确保所有API调用有错误处理，console.log错误信息

---

## Bug 4: 点击到skill页面崩溃

### 根因分析
`SkillsPage.tsx` 第39行：
```ts
const data = await res.json()
setInstalled(Array.isArray(data) ? data : (data.skills || []))
```

后端 `/api/skills/installed` 返回 `{skills: [{name: "agent-reach"}, ...]}`。

前端 `Skill` 接口定义为：
```ts
interface Skill {
  name: string; description: string; version?: string;
  status: 'eligible' | 'missing' | 'disabled' | 'blocked'; bundled?: boolean;
}
```

后端返回的 skill 对象只有 `{name}`，**没有 `description`、`version`、`status` 等字段**。

第109行 `installed.map(skill => ...)` 本身不会崩溃因为 installed 是数组。

**但错误信息是 `n.map is not a function`** — 这意味着 `installed` 不是数组。

可能原因：
1. `data.skills` 是 `undefined`，`data || []` 走了 data 分支，但 data 不是数组
2. 或者是 store tab 下的 `storeResults.map` 崩溃 — `handleSearch` 中 `setStoreResults(await res.json())` 直接把整个响应作为数组，但后端可能返回 `{skills: [...]}` 包装

### 验证步骤
```bash
curl -s http://localhost:8000/api/skills/installed | head -100
curl -s "http://localhost:8000/api/skills/search?q=stock&source=skillhub" | head -100
```

### 修复方案
1. 确保所有 `setInstalled`/`setStoreResults` 赋值前做 `Array.isArray()` 检查
2. 修正 `Skill` 接口为可选字段，渲染时加默认值

---

## Bug 5: 渠道管理样式和功能问题

### 根因分析
`ChannelsPage.tsx` 使用 `channelsApi`，API路径正确。

`Channel` 接口：
```ts
interface Channel {
  type: string; name: string; icon?: string;
  status: 'connected' | 'disconnected' | 'unconfigured';
  config?: Record<string, string>;
}
```

后端 `/api/channels/list` 返回：
```json
{"channels": [{"type": "lightclawbot", "enabled": true, "config": {...}, "plugin_loaded": true}], "total": 2}
```

**问题**：
1. 后端返回 `enabled` (boolean)，前端期望 `status` (string)
2. 后端没有返回 `name` 字段
3. `channelsApi.list()` 用 `.then(d => d.channels)` 直接返回channels数组
4. `channelsApi.status()` 也调用 `/channels/status`，返回格式可能不同

### 修复方案
1. 修改前端 `Channel` 接口或添加数据映射
2. 在 `fetchChannels()` 中把 `enabled` 映射为 `status` 字符串

---

## Bug 6: 成本分析样式和国际化问题

### 根因分析
`AnalyticsPage.tsx`：
1. 使用了 antd `Input`, `Select`, `Button` 但也混用了裸 `<input className="form-input">`（第110/116行）
2. 没有 `page-container` / `page-header` 结构，直接用 `style={{ display: 'flex' }}`
3. 所有文案都用了 `t()` 但 AnalyticsPage 使用的变量名 `t` 被第23行的参数覆盖了：`const switchTheme = (t: ThemeName) => {...}` — **这会导致后续的 `t('analytics.title')` 调用ThemeName类型的参数而不是i18n的t函数！**
   - 实际上不是，因为 `switchTheme` 是一个函数声明，`t` 在外部作用域
4. CSS变量引用了不存在的变量：`var(--border)`, `var(--card-bg)`, `var(--info)`, `var(--success)`, `var(--danger)` — 这些都不是在 `styles.css` 中定义的

### 修复方案
1. 第110/116行裸input → antd `Input`
2. 添加 `page-container` / `page-header` 结构
3. 修正CSS变量引用：`var(--border)` → `var(--border-default)`, `var(--card-bg)` → `var(--bg-card)`, `var(--info)` → `var(--status-blue)`, `var(--success)` → `var(--status-green)`, `var(--danger)` → `var(--status-red)`
4. 检查所有页面的 i18n 覆盖

---

## Bug 7: 主题和语言弹窗超出视窗

### 根因分析
`AppLayout.tsx` 中主题和语言切换使用手写的 `dropdown`：
- `themeOpen` / `langOpen` state 控制显示
- `mousedown` 监听关闭
- `.dropdown-menu` 用 `position: absolute; right: 0; top: calc(100% + 4px)` — 没有处理溢出

**问题**：当侧边栏在页面底部（或折叠状态下），dropdown向下展开会超出视窗。

### 修复方案
改用 antd `Dropdown` 组件，自动处理边界检测和定位：
```tsx
import { Dropdown } from 'antd'

const themeItems = THEMES.map(th => ({
  key: th.name,
  label: <span><span className="color-dot" style={{background: th.preview}} />{t(`theme.${th.name}`)}</span>,
  onClick: () => switchTheme(th.name),
}))

<Dropdown menu={{ items: themeItems }} trigger={['click']}>
  <button className="dropdown-trigger">🎨 {!collapsed && <span>{t('theme.label')}</span>}</button>
</Dropdown>
```

---

## 通用修复规则
1. 每修完一个bug必须运行：`cd frontend && npx tsc --noEmit`
2. 后端API修改后验证：`curl -s http://localhost:8000/api/...`
3. 能用antd组件的就绝不用手写
4. 不要动不需要改的文件
