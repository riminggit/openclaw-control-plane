# docs/ 目录索引

本目录存放产品需求、设计、调研、测试与评审等文档。入口说明见下表；**根目录**另有架构与迁移说明，便于与代码库对照阅读。

## 根目录

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 本索引（目录导航） |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 系统架构说明（分层、组件、数据流） |
| [LEGACY_SYSTEM_MIGRATION.md](./LEGACY_SYSTEM_MIGRATION.md) | 旧工作流实现与新系统迁移说明 |

## 目录树（概览）

```
docs/
├── ARCHITECTURE.md
├── LEGACY_SYSTEM_MIGRATION.md
├── README.md
├── analysis/                    # 对标与专项分析
├── bug-reports/                 # Bug 修复报告（按版本）
├── code-review/                 # 代码走查（按轮次）
├── design/                      # 设计与数据层
├── requirements/                # 需求与 PRD（含冻结版）
├── research/                    # 技术/产品调研
└── testing/                     # 测试用例与测试报告
```

---

## requirements/ — 需求与 PRD

| 文档 | 说明 |
|------|------|
| `agent-workflow-v2.md` | Agent 工作流 v2 需求定义 |
| `phase2-requirements.md` | Phase 2 新增需求 |
| `phase3-gateway-integration.md` | Phase 3 Gateway 集成需求 |
| `workflow-management.md` | 工作流管理需求 |
| `workflow-management-prd.md` | 工作流管理 PRD |
| `workflow-management-frozen.md` | 工作流管理冻结版 |
| `workflow-prd-review.md` | 工作流 PRD 评审记录 |
| `task-orchestration-v3-prd.md` | **任务编排增强 v3**：业界对比、运行时契约、`orchestration_profile` / `runtime_contract_version`、**后续版本兼容策略**（§3.5）、分阶段落地 |

---

## design/ — 设计与数据

| 文档 | 说明 |
|------|------|
| `workflow-api-design.md` | 工作流 API 设计 |
| `workflow-schema.sql` | 工作流相关 SQL schema |
| `ux-review-lifecycle-taskflow.md` | 生命周期与任务流 UX 评审 |
| `SQLITE_MIGRATION_SUMMARY.md` | SQLite 迁移摘要 |

---

## research/ — 调研

| 文档 | 说明 |
|------|------|
| `agent-orchestration-comparison.md` | Agent 编排方案对比 |
| `dashboard-features-benchmark.md` | Dashboard 功能对标 |

---

## analysis/ — 分析

| 文档 | 说明 |
|------|------|
| `feishu-doc-benchmark.md` | 飞书文档相关对标/分析 |

---

## bug-reports/v0.1.0/

| 文档 | 说明 |
|------|------|
| `bug-fix-report.md` | 首轮 Bug 修复报告 |
| `bug-fix-report-v2.md` | 第二轮 Bug 修复报告 |
| `bug-fix-report-phase3.md` | Phase 3 Bug 修复报告 |
| `bugfix-task-v2.md` | Bugfix 任务清单 v2 |
| `bug-fix-taskflow-id-compat.md` | Taskflow ID 兼容性修复说明 |

---

## code-review/

### round-1/

| 文档 | 说明 |
|------|------|
| `CODE_REVIEW.md` | 第一轮走查原始记录 |
| `code-review-round-1.md` | 第一轮走查报告 |
| `code-review-architecture.md` | 架构相关走查 |

### round-2/

| 文档 | 说明 |
|------|------|
| `CODE_REVIEW_V2.md` | 第二轮走查原始记录 |
| `code-review-round-2.md` | 第二轮走查报告 |
| `code-review-round-2-final.md` | 第二轮走查终稿 |
| `code-review-quality.md` | 质量维度走查 |

---

## testing/

### test-cases/v0.1.0-post-bugfix/

| 文档 | 说明 |
|------|------|
| `test-cases.md` | Bugfix 后测试用例 |

### test-reports/v0.1.0/

| 文档 | 说明 |
|------|------|
| `test-round-1.md` ~ `test-round-3.md` | 各轮测试报告 |
| `test-frontend-panel.md` | 前端面板测试 |
| `test-coverage.md` | 覆盖率相关 |
| `browser-verification.md` | 浏览器验证 |
| `browser-verification-final.md` | 浏览器验证（终稿） |

### test-reports/v0.1.0-post-bugfix/

| 文档 | 说明 |
|------|------|
| `test-round-1.md` ~ `test-round-3.md` | Bugfix 后各轮测试 |
| `test-report-regression.md` | 回归测试报告 |

---

## 维护说明

- **新增文档**：按类型放入对应子目录；若跨类（例如既像需求又像设计），以「主要读者用途」归类，并在本 README 补一行索引。
- **版本目录**：测试与 Bug 报告按版本分子目录（如 `v0.1.0`），新版本可并列新增 `v0.2.0/` 等，避免覆盖历史记录。
- **避免重复**：同一主题只保留一份权威文件；若需快照，用子目录或文件名标明阶段（如 `*-frozen.md`）。
