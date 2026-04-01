-- ============================================================
-- OpenClaw Control Plane - Workflow Management System Schema
-- SQLite DDL for v1.0 MVP
-- Author: rd-lead
-- Date: 2026-04-01
-- ============================================================

-- Enable foreign keys (SQLite doesn't enforce by default)
PRAGMA foreign_keys = ON;

-- ============================================================
-- Part 1: 核心工作流表（新增）
-- ============================================================

-- 1.1 工作流模板表
CREATE TABLE IF NOT EXISTS workflow_templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT 'v1.0',
    status TEXT NOT NULL DEFAULT 'draft', -- draft / published / archived
    dag TEXT NOT NULL, -- DAG 定义（步骤 + 边）JSON
    config TEXT NOT NULL DEFAULT '{}', -- 全局配置（超时/重试/失败策略）JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL, -- 关联 User.id（TEXT）
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    published_at TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT -- 标签数组（JSON 格式）
);

-- 1.2 工作流实例表
CREATE TABLE IF NOT EXISTS workflow_instances (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE RESTRICT,
    template_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending / running / paused / completed / failed / terminated
    input TEXT NOT NULL DEFAULT '{}', -- JSON
    output TEXT, -- JSON
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    estimated_remaining INTEGER, -- 预估剩余时间（秒）
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL, -- 关联 User.id（TEXT）
    started_at TEXT,
    completed_at TEXT,
    duration INTEGER, -- 实际耗时（秒）
    error_message TEXT,
    termination_reason TEXT
);

-- 1.3 步骤定义表（存储模板中的步骤定义，冗余存储以便查询）
CREATE TABLE IF NOT EXISTS step_definitions (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL, -- 模板中的步骤 ID（如 "step1"）
    name TEXT NOT NULL,
    agent TEXT, -- Agent 名称或 ID
    capabilities TEXT, -- Agent 能力标签（JSON 数组）
    estimated_duration INTEGER, -- 预估时长（分钟）
    input_schema TEXT, -- 输入参数 schema JSON
    output_schema TEXT, -- 输出参数 schema JSON
    validation_rules TEXT, -- 验证规则 JSON
    human_review INTEGER NOT NULL DEFAULT 0, -- 是否需要人工审核（0/1）
    retry_policy TEXT, -- 重试策略 JSON
    timeout_seconds INTEGER, -- 超时时间（秒）
    parallel_group TEXT, -- 并行组 ID
    checker_agent TEXT, -- 互审方 Agent（用于设计互审）
    min_issues INTEGER, -- 互审方必须提出的最少问题数
    depends_on TEXT, -- 依赖的步骤 ID 列表（JSON 数组）
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(template_id, step_id)
);

-- 1.4 步骤执行表
CREATE TABLE IF NOT EXISTS step_executions (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL, -- 对应模板中的步骤 ID
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending / ready / assigned / running / awaiting_review / approved / rejected / retrying / completed / failed / cancelled / skipped
    agent_id TEXT, -- 执行的 Agent ID
    agent_name TEXT,
    input TEXT, -- JSON
    output TEXT, -- JSON
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    duration INTEGER, -- 实际耗时（秒）
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    error_stack TEXT,
    force_completed INTEGER NOT NULL DEFAULT 0, -- 0/1
    force_completed_by TEXT,
    force_completed_reason TEXT,
    force_completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1.5 审核记录表
CREATE TABLE IF NOT EXISTS review_records (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id TEXT NOT NULL REFERENCES step_executions(id) ON DELETE CASCADE,
    reviewer_id TEXT NOT NULL, -- 审核人 ID
    reviewer_name TEXT,
    action TEXT, -- approve / reject / request_changes
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    timeout_at TEXT, -- 超时时间
    timeout_action TEXT DEFAULT 'auto_reject', -- auto_reject / auto_approve / escalate / notify_only
    remaining_time INTEGER, -- 剩余时间（秒）
    review_round INTEGER NOT NULL DEFAULT 1 -- 审核轮次
);

-- 1.6 工作流日志表
CREATE TABLE IF NOT EXISTS workflow_logs (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id TEXT REFERENCES step_executions(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    level TEXT NOT NULL DEFAULT 'INFO', -- INFO / WARN / ERROR / DEBUG
    message TEXT NOT NULL,
    metadata TEXT, -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1.7 Agent 信息表（扩展现有 Agent 概念）
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT,
    capabilities TEXT NOT NULL DEFAULT '[]', -- 能力标签数组（JSON）
    status TEXT NOT NULL DEFAULT 'offline', -- online / degraded / offline
    current_task_id TEXT, -- 当前任务 ID
    current_workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE SET NULL,
    current_step_execution_id TEXT REFERENCES step_executions(id) ON DELETE SET NULL,
    last_heartbeat TEXT,
    config TEXT, -- Agent 配置（模型/温度等）JSON
    metadata TEXT, -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1.8 工作流模板版本历史表（支持版本回滚）
CREATE TABLE IF NOT EXISTS workflow_template_versions (
    id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    dag TEXT NOT NULL, -- JSON
    config TEXT NOT NULL, -- JSON
    change_summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL,
    UNIQUE(template_id, version)
);

-- 1.9 工作流调度队列表（用于 DAG 调度器）
CREATE TABLE IF NOT EXISTS workflow_scheduler_queue (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending / ready / running / completed / failed
    priority INTEGER NOT NULL DEFAULT 0,
    retry_after TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    scheduled_at TEXT,
    started_at TEXT,
    completed_at TEXT,
    error_message TEXT
);

-- 1.10 工作流产出物表
CREATE TABLE IF NOT EXISTS workflow_artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id TEXT REFERENCES step_executions(id) ON DELETE SET NULL,
    artifact_type TEXT NOT NULL, -- file / document / data / code
    name TEXT NOT NULL,
    description TEXT,
    storage_kind TEXT NOT NULL DEFAULT 'local', -- local / feishu / s3
    storage_path TEXT, -- 文件路径或 URL
    metadata TEXT, -- JSON
    size_bytes INTEGER,
    checksum TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 1.11 工作流事件表（用于审计和追踪）
CREATE TABLE IF NOT EXISTS workflow_events (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id TEXT REFERENCES step_executions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- workflow.started / step.completed / review.approved 等
    event_data TEXT, -- JSON
    actor_type TEXT, -- user / agent / system
    actor_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- Part 2: 扩展现有表（ALTER TABLE）
-- ============================================================

-- 2.1 扩展 tasks 表（增加工作流关联字段）
-- SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we add columns without checking
-- These will fail silently if columns already exist, which is acceptable
ALTER TABLE tasks ADD COLUMN workflow_instance_id TEXT REFERENCES workflow_instances(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN step_execution_id TEXT REFERENCES step_executions(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN step_order INTEGER;

-- 为新增字段添加索引
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_instance_id ON tasks(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_tasks_step_execution_id ON tasks(step_execution_id);

-- ============================================================
-- Part 3: 索引设计
-- ============================================================

-- 3.1 workflow_templates 索引
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_status ON workflow_templates(status);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_name ON workflow_templates(name);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_created_at ON workflow_templates(created_at DESC);

-- 3.2 workflow_instances 索引
CREATE INDEX IF NOT EXISTS idx_workflow_instances_template_id ON workflow_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_created_by ON workflow_instances(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_created_at ON workflow_instances(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_started_at ON workflow_instances(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_completed_at ON workflow_instances(completed_at DESC);

-- 3.3 step_definitions 索引
CREATE INDEX IF NOT EXISTS idx_step_definitions_template_id ON step_definitions(template_id);
CREATE INDEX IF NOT EXISTS idx_step_definitions_step_id ON step_definitions(template_id, step_id);

-- 3.4 step_executions 索引
CREATE INDEX IF NOT EXISTS idx_step_executions_workflow_instance_id ON step_executions(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_status ON step_executions(status);
CREATE INDEX IF NOT EXISTS idx_step_executions_agent_id ON step_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_step_executions_step_id ON step_executions(workflow_instance_id, step_id);

-- 3.5 review_records 索引
CREATE INDEX IF NOT EXISTS idx_review_records_reviewer_id ON review_records(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_review_records_workflow_instance_id ON review_records(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_review_records_step_execution_id ON review_records(step_execution_id);
CREATE INDEX IF NOT EXISTS idx_review_records_timeout_at ON review_records(timeout_at);
CREATE INDEX IF NOT EXISTS idx_review_records_created_at ON review_records(created_at DESC);

-- 3.6 workflow_logs 索引
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow_instance_id ON workflow_logs(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_step_execution_id ON workflow_logs(step_execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_timestamp ON workflow_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_level ON workflow_logs(level);

-- 3.7 agents 索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_last_heartbeat ON agents(last_heartbeat DESC);

-- 3.8 workflow_scheduler_queue 索引
CREATE INDEX IF NOT EXISTS idx_scheduler_queue_workflow_instance_id ON workflow_scheduler_queue(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_scheduler_queue_status ON workflow_scheduler_queue(status);
CREATE INDEX IF NOT EXISTS idx_scheduler_queue_priority ON workflow_scheduler_queue(priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_scheduler_queue_scheduled_at ON workflow_scheduler_queue(scheduled_at);

-- 3.9 workflow_artifacts 索引
CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_workflow_instance_id ON workflow_artifacts(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_step_execution_id ON workflow_artifacts(step_execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_artifacts_type ON workflow_artifacts(artifact_type);

-- 3.10 workflow_events 索引
CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow_instance_id ON workflow_events(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_step_execution_id ON workflow_events(step_execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_events_event_type ON workflow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workflow_events_timestamp ON workflow_events(timestamp DESC);

-- ============================================================
-- Part 4: 触发器（SQLite 语法）
-- ============================================================

-- 4.1 自动更新 workflow_templates.updated_at
CREATE TRIGGER IF NOT EXISTS update_workflow_templates_updated_at
AFTER UPDATE ON workflow_templates
FOR EACH ROW
BEGIN
    UPDATE workflow_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 4.2 自动更新 workflow_instances.updated_at（虽然表中没有此字段，保留注释作为示例）
-- 注意：workflow_instances 表没有 updated_at 字段，此触发器仅为示例
-- CREATE TRIGGER IF NOT EXISTS update_workflow_instances_updated_at
-- AFTER UPDATE ON workflow_instances
-- FOR EACH ROW
-- BEGIN
--     UPDATE workflow_instances SET updated_at = datetime('now') WHERE id = NEW.id;
-- END;

-- 4.3 自动更新 step_executions.updated_at
CREATE TRIGGER IF NOT EXISTS update_step_executions_updated_at
AFTER UPDATE ON step_executions
FOR EACH ROW
BEGIN
    UPDATE step_executions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 4.4 自动更新 review_records.updated_at
CREATE TRIGGER IF NOT EXISTS update_review_records_updated_at
AFTER UPDATE ON review_records
FOR EACH ROW
BEGIN
    UPDATE review_records SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 4.5 自动更新 agents.updated_at
CREATE TRIGGER IF NOT EXISTS update_agents_updated_at
AFTER UPDATE ON agents
FOR EACH ROW
BEGIN
    UPDATE agents SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- 注意：以下复杂触发器已移除，改为应用层实现
-- - 自动计算工作流整体进度（改为应用层调用 API 时计算）
-- - 审核超时检查（改为 cron 任务或应用层定时器）
-- ============================================================

-- ============================================================
-- Part 5: 初始测试数据
-- ============================================================

-- 5.1 插入测试 Agent
INSERT OR IGNORE INTO agents (id, name, display_name, capabilities, status, config, created_at, updated_at) VALUES
('agent-001', 'rd-product-researcher', '产品研究员', '["research", "requirements"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-002', 'rd-commander', '研发总指挥', '["coordination", "review"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-003', 'rd-product-manager', '产品经理', '["prd", "requirements"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-004', 'rd-pm-checker', '产品评审', '["review", "validation"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-005', 'rd-backend-arch', '后端架构师', '["backend", "architecture"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-006', 'rd-backend-dev', '后端开发', '["backend", "coding"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-007', 'rd-frontend-arch', '前端架构师', '["frontend", "architecture"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-008', 'rd-frontend-dev', '前端开发', '["frontend", "coding"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-009', 'rd-dba', 'DBA', '["database", "sql"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-010', 'dba-checker', 'DBA 评审', '["database", "review"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-011', 'ui-designer', 'UI 设计师', '["ui", "design"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-012', 'ui-checker', 'UI 走查', '["ui", "review"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-013', 'rd-tester-auto', '自动化测试', '["testing", "automation"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-014', 'rd-tester-func', '功能测试', '["testing", "validation"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now')),
('agent-015', 'devops', '运维工程师', '["deployment", "monitoring"]', 'online', '{"model": "gpt-4"}', datetime('now'), datetime('now'));

-- 5.2 插入测试工作流模板
INSERT OR IGNORE INTO workflow_templates (id, name, description, version, status, dag, config, created_at, created_by, updated_at, published_at, usage_count, tags) VALUES
('template-001', '研发流水线-标准流程', '完整的 20 步研发流水线，从需求分析到最终交付', 'v1.0', 'published', 
'{
  "steps": [
    {
      "id": "step1",
      "name": "需求分析",
      "agent": "rd-product-researcher",
      "capabilities": ["research"],
      "estimated_duration": 60,
      "output": "docs/requirements.md",
      "validation": ["四部分完整"],
      "human_review": false,
      "depends_on": []
    },
    {
      "id": "step2",
      "name": "需求验证",
      "agent": "rd-commander",
      "estimated_duration": 30,
      "input": ["step1.output"],
      "validation": ["四部分完整", "符合SMART原则"],
      "human_review": false,
      "depends_on": ["step1"]
    },
    {
      "id": "step3",
      "name": "PRD 编写",
      "agent": "rd-product-manager",
      "estimated_duration": 120,
      "output": "docs/prd.md",
      "human_review": true,
      "depends_on": ["step2"]
    }
  ],
  "edges": [
    {"source": "step1", "target": "step2"},
    {"source": "step2", "target": "step3"}
  ]
}',
'{"single_step_timeout": 1800, "workflow_timeout": 86400, "max_retries": 3, "failure_strategy": "escalate"}',
datetime('now'), 'user-001', datetime('now'), datetime('now'), 5, '["研发", "标准流程"]');

-- 5.3 插入测试步骤定义
INSERT OR IGNORE INTO step_definitions (id, template_id, step_id, name, agent, capabilities, estimated_duration, human_review, depends_on, created_at) VALUES
('sd-001', 'template-001', 'step1', '需求分析', 'rd-product-researcher', '["research"]', 60, 0, '[]', datetime('now')),
('sd-002', 'template-001', 'step2', '需求验证', 'rd-commander', '["coordination", "review"]', 30, 0, '["step1"]', datetime('now')),
('sd-003', 'template-001', 'step3', 'PRD 编写', 'rd-product-manager', '["prd"]', 120, 1, '["step2"]', datetime('now'));

-- 5.4 插入测试工作流实例
INSERT OR IGNORE INTO workflow_instances (id, template_id, template_version, status, input, progress, created_at, created_by, started_at) VALUES
('wf-001', 'template-001', 'v1.0', 'running', '{"project_name": "测试项目", "requirements_path": "/path/to/req.md"}', 33, datetime('now'), 'user-001', datetime('now'));

-- 5.5 插入测试步骤执行记录
INSERT OR IGNORE INTO step_executions (id, workflow_instance_id, step_id, name, status, agent_id, agent_name, progress, started_at, completed_at, duration, created_at, updated_at) VALUES
('se-001', 'wf-001', 'step1', '需求分析', 'completed', 'agent-001', 'rd-product-researcher', 100, datetime('now', '-1 hour'), datetime('now', '-15 minutes'), 2700, datetime('now', '-1 hour'), datetime('now', '-15 minutes')),
('se-002', 'wf-001', 'step2', '需求验证', 'completed', 'agent-002', 'rd-commander', 100, datetime('now', '-14 minutes'), datetime('now', '-5 minutes'), 540, datetime('now', '-14 minutes'), datetime('now', '-5 minutes')),
('se-003', 'wf-001', 'step3', 'PRD 编写', 'running', 'agent-003', 'rd-product-manager', 65, datetime('now', '-4 minutes'), NULL, NULL, datetime('now', '-4 minutes'), datetime('now'));

-- 5.6 插入测试审核记录
INSERT OR IGNORE INTO review_records (id, workflow_instance_id, step_execution_id, reviewer_id, reviewer_name, action, comment, created_at, updated_at, timeout_at, timeout_action, review_round) VALUES
('review-001', 'wf-001', 'se-003', 'user-002', '审核人A', NULL, NULL, datetime('now'), datetime('now'), datetime('now', '+24 hours'), 'auto_reject', 1);

-- 5.7 插入测试日志
INSERT OR IGNORE INTO workflow_logs (id, workflow_instance_id, step_execution_id, timestamp, level, message, metadata, created_at) VALUES
('log-001', 'wf-001', 'se-001', datetime('now', '-55 minutes'), 'INFO', '开始执行需求分析', '{"agent": "rd-product-researcher"}', datetime('now', '-55 minutes')),
('log-002', 'wf-001', 'se-001', datetime('now', '-30 minutes'), 'INFO', '需求分析进度更新', '{"progress": 50}', datetime('now', '-30 minutes')),
('log-003', 'wf-001', 'se-001', datetime('now', '-16 minutes'), 'INFO', '需求分析完成', '{"output": "docs/requirements.md"}', datetime('now', '-16 minutes')),
('log-004', 'wf-001', 'se-002', datetime('now', '-14 minutes'), 'INFO', '开始执行需求验证', '{"agent": "rd-commander"}', datetime('now', '-14 minutes')),
('log-005', 'wf-001', 'se-002', datetime('now', '-6 minutes'), 'INFO', '需求验证完成', '{"validation": "passed"}', datetime('now', '-6 minutes')),
('log-006', 'wf-001', 'se-003', datetime('now', '-4 minutes'), 'INFO', '开始执行 PRD 编写', '{"agent": "rd-product-manager"}', datetime('now', '-4 minutes')),
('log-007', 'wf-001', 'se-003', datetime('now', '-2 minutes'), 'INFO', 'PRD 编写进度更新', '{"progress": 65}', datetime('now', '-2 minutes'));

-- 5.8 插入测试事件
INSERT OR IGNORE INTO workflow_events (id, workflow_instance_id, step_execution_id, event_type, event_data, actor_type, actor_id, timestamp, created_at) VALUES
('event-001', 'wf-001', NULL, 'workflow.started', '{"input": {"project_name": "测试项目"}}', 'user', 'user-001', datetime('now', '-1 hour'), datetime('now', '-1 hour')),
('event-002', 'wf-001', 'se-001', 'step.started', '{"agent": "rd-product-researcher"}', 'agent', 'agent-001', datetime('now', '-1 hour'), datetime('now', '-1 hour')),
('event-003', 'wf-001', 'se-001', 'step.completed', '{"duration": 2700}', 'agent', 'agent-001', datetime('now', '-15 minutes'), datetime('now', '-15 minutes')),
('event-004', 'wf-001', 'se-002', 'step.started', '{"agent": "rd-commander"}', 'agent', 'agent-002', datetime('now', '-14 minutes'), datetime('now', '-14 minutes')),
('event-005', 'wf-001', 'se-002', 'step.completed', '{"duration": 540}', 'agent', 'agent-002', datetime('now', '-5 minutes'), datetime('now', '-5 minutes')),
('event-006', 'wf-001', 'se-003', 'step.started', '{"agent": "rd-product-manager"}', 'agent', 'agent-003', datetime('now', '-4 minutes'), datetime('now', '-4 minutes')),
('event-007', 'wf-001', 'se-003', 'step.progress', '{"progress": 65, "message": "正在编写功能需求"}', 'agent', 'agent-003', datetime('now', '-2 minutes'), datetime('now', '-2 minutes')),
('event-008', 'wf-001', 'se-003', 'review.created', '{"reviewer": "user-002", "timeout_at": "2026-04-02T21:22:00"}', 'system', 'system', datetime('now'), datetime('now'));

-- ============================================================
-- Part 6: 视图定义（可选，便于查询）
-- ============================================================

-- 6.1 工作流实例详情视图
CREATE VIEW IF NOT EXISTS workflow_instance_details AS
SELECT 
    wi.id,
    wi.template_id,
    wi.template_version,
    wi.status,
    wi.input,
    wi.output,
    wi.progress,
    wi.estimated_remaining,
    wi.created_at,
    wi.created_by,
    wi.started_at,
    wi.completed_at,
    wi.duration,
    wi.error_message,
    wi.termination_reason,
    wt.name AS template_name,
    wt.description AS template_description,
    COUNT(se.id) AS total_steps,
    SUM(CASE WHEN se.status = 'completed' THEN 1 ELSE 0 END) AS completed_steps,
    SUM(CASE WHEN se.status = 'running' THEN 1 ELSE 0 END) AS running_steps,
    SUM(CASE WHEN se.status = 'failed' THEN 1 ELSE 0 END) AS failed_steps,
    SUM(CASE WHEN se.status = 'awaiting_review' THEN 1 ELSE 0 END) AS review_pending_steps
FROM workflow_instances wi
LEFT JOIN workflow_templates wt ON wi.template_id = wt.id
LEFT JOIN step_executions se ON wi.id = se.workflow_instance_id
GROUP BY wi.id, wi.template_id, wi.template_version, wi.status, wi.input, wi.output, 
         wi.progress, wi.estimated_remaining, wi.created_at, wi.created_by, 
         wi.started_at, wi.completed_at, wi.duration, wi.error_message, 
         wi.termination_reason, wt.name, wt.description;

-- 6.2 待审核列表视图
CREATE VIEW IF NOT EXISTS pending_reviews_view AS
SELECT 
    rr.id,
    rr.workflow_instance_id,
    rr.step_execution_id,
    rr.reviewer_id,
    rr.reviewer_name,
    rr.action,
    rr.comment,
    rr.created_at,
    rr.updated_at,
    rr.timeout_at,
    rr.timeout_action,
    rr.remaining_time,
    rr.review_round,
    wi.template_id,
    wt.name AS workflow_name,
    se.name AS step_name,
    se.output AS step_output,
    CASE 
        WHEN rr.timeout_at IS NOT NULL THEN CAST((julianday(rr.timeout_at) - julianday('now')) * 86400 AS INTEGER)
        ELSE NULL
    END AS remaining_seconds
FROM review_records rr
JOIN workflow_instances wi ON rr.workflow_instance_id = wi.id
JOIN workflow_templates wt ON wi.template_id = wt.id
JOIN step_executions se ON rr.step_execution_id = se.id
WHERE rr.action IS NULL
ORDER BY rr.timeout_at ASC;

-- 6.3 Agent 负载统计视图
CREATE VIEW IF NOT EXISTS agent_load_stats AS
SELECT 
    a.id,
    a.name,
    a.display_name,
    a.status,
    COUNT(se.id) AS current_tasks,
    SUM(CASE WHEN se.status = 'running' THEN 1 ELSE 0 END) AS running_tasks,
    AVG(se.duration) AS avg_task_duration
FROM agents a
LEFT JOIN step_executions se ON a.id = se.agent_id AND se.status IN ('running', 'assigned')
GROUP BY a.id, a.name, a.display_name, a.status;

-- ============================================================
-- Part 7: 验证 SELECT 语句（测试数据完整性）
-- ============================================================

-- 7.1 验证工作流模板
SELECT 
    id, 
    name, 
    version, 
    status, 
    json_array_length(json_extract(dag, '$.steps')) AS step_count,
    usage_count, 
    tags
FROM workflow_templates
WHERE id = 'template-001';

-- 预期结果：1 行，step_count = 3

-- 7.2 验证工作流实例
SELECT 
    wi.id,
    wi.status,
    wi.progress,
    wt.name AS template_name,
    COUNT(se.id) AS step_count
FROM workflow_instances wi
JOIN workflow_templates wt ON wi.template_id = wt.id
LEFT JOIN step_executions se ON wi.id = se.workflow_instance_id
WHERE wi.id = 'wf-001'
GROUP BY wi.id, wi.status, wi.progress, wt.name;

-- 预期结果：1 行，status = 'running', progress = 33, step_count = 3

-- 7.3 验证步骤执行
SELECT 
    se.step_id,
    se.name,
    se.status,
    se.agent_name,
    se.progress,
    se.duration,
    se.started_at,
    se.completed_at
FROM step_executions se
WHERE se.workflow_instance_id = 'wf-001'
ORDER BY se.created_at;

-- 预期结果：3 行，状态分别为 completed, completed, running

-- 7.4 验证审核记录
SELECT 
    rr.id,
    se.name AS step_name,
    rr.reviewer_name,
    rr.action,
    rr.timeout_at,
    CAST((julianday(rr.timeout_at) - julianday('now')) * 3600 AS INTEGER) AS remaining_hours
FROM review_records rr
JOIN step_executions se ON rr.step_execution_id = se.id
WHERE rr.action IS NULL;

-- 预期结果：1 行，remaining_hours ≈ 24
