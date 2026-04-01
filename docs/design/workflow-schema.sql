-- ============================================================
-- OpenClaw Control Plane - Workflow Management System Schema
-- PostgreSQL DDL for v1.0 MVP
-- Author: rd-lead
-- Date: 2026-04-01
-- ============================================================

-- ============================================================
-- Part 1: 核心工作流表（新增）
-- ============================================================

-- 1.1 工作流模板表
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft / published / archived
    dag JSONB NOT NULL, -- DAG 定义（步骤 + 边）
    config JSONB NOT NULL DEFAULT '{}', -- 全局配置（超时/重试/失败策略）
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL, -- 关联 User.id（TEXT）
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] -- 标签数组
);

-- 1.2 工作流实例表
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE RESTRICT,
    template_version VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / running / paused / completed / failed / terminated
    input JSONB NOT NULL DEFAULT '{}',
    output JSONB,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    estimated_remaining INTEGER, -- 预估剩余时间（秒）
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL, -- 关联 User.id（TEXT）
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- 实际耗时（秒）
    error_message TEXT,
    termination_reason TEXT
);

-- 1.3 步骤定义表（存储模板中的步骤定义，冗余存储以便查询）
CREATE TABLE IF NOT EXISTS step_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    step_id VARCHAR(50) NOT NULL, -- 模板中的步骤 ID（如 "step1"）
    name VARCHAR(255) NOT NULL,
    agent VARCHAR(100), -- Agent 名称或 ID
    capabilities TEXT[], -- Agent 能力标签
    estimated_duration INTEGER, -- 预估时长（分钟）
    input_schema JSONB, -- 输入参数 schema
    output_schema JSONB, -- 输出参数 schema
    validation_rules JSONB, -- 验证规则
    human_review BOOLEAN NOT NULL DEFAULT FALSE, -- 是否需要人工审核
    retry_policy JSONB, -- 重试策略
    timeout_seconds INTEGER, -- 超时时间（秒）
    parallel_group VARCHAR(100), -- 并行组 ID
    checker_agent VARCHAR(100), -- 互审方 Agent（用于设计互审）
    min_issues INTEGER, -- 互审方必须提出的最少问题数
    depends_on TEXT[], -- 依赖的步骤 ID 列表
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(template_id, step_id)
);

-- 1.4 步骤执行表
CREATE TABLE IF NOT EXISTS step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id VARCHAR(50) NOT NULL, -- 对应模板中的步骤 ID
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / ready / assigned / running / awaiting_review / approved / rejected / retrying / completed / failed / cancelled / skipped
    agent_id VARCHAR(100), -- 执行的 Agent ID
    agent_name VARCHAR(100),
    input JSONB,
    output JSONB,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    progress_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- 实际耗时（秒）
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_message TEXT,
    error_stack TEXT,
    force_completed BOOLEAN NOT NULL DEFAULT FALSE,
    force_completed_by VARCHAR(100),
    force_completed_reason TEXT,
    force_completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.5 审核记录表
CREATE TABLE IF NOT EXISTS review_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id UUID NOT NULL REFERENCES step_executions(id) ON DELETE CASCADE,
    reviewer_id VARCHAR(100) NOT NULL, -- 审核人 ID
    reviewer_name VARCHAR(100),
    action VARCHAR(20), -- approve / reject / request_changes
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    timeout_at TIMESTAMP WITH TIME ZONE, -- 超时时间
    timeout_action VARCHAR(20) DEFAULT 'auto_reject', -- auto_reject / auto_approve / escalate / notify_only
    remaining_time INTEGER, -- 剩余时间（秒）
    review_round INTEGER NOT NULL DEFAULT 1 -- 审核轮次
);

-- 1.6 工作流日志表
CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id UUID REFERENCES step_executions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL DEFAULT 'INFO', -- INFO / WARN / ERROR / DEBUG
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.7 Agent 信息表（扩展现有 Agent 概念）
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    capabilities TEXT[] NOT NULL DEFAULT '{}', -- 能力标签数组
    status VARCHAR(20) NOT NULL DEFAULT 'offline', -- online / degraded / offline
    current_task_id UUID, -- 当前任务 ID
    current_workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,
    current_step_execution_id UUID REFERENCES step_executions(id) ON DELETE SET NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    config JSONB, -- Agent 配置（模型/温度等）
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.8 工作流模板版本历史表（支持版本回滚）
CREATE TABLE IF NOT EXISTS workflow_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    dag JSONB NOT NULL,
    config JSONB NOT NULL,
    change_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    UNIQUE(template_id, version)
);

-- 1.9 工作流调度队列表（用于 DAG 调度器）
CREATE TABLE IF NOT EXISTS workflow_scheduler_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending / ready / running / completed / failed
    priority INTEGER NOT NULL DEFAULT 0,
    retry_after TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- 1.10 工作流产出物表
CREATE TABLE IF NOT EXISTS workflow_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id UUID REFERENCES step_executions(id) ON DELETE SET NULL,
    artifact_type VARCHAR(50) NOT NULL, -- file / document / data / code
    name VARCHAR(255) NOT NULL,
    description TEXT,
    storage_kind VARCHAR(20) NOT NULL DEFAULT 'local', -- local / feishu / s3
    storage_path TEXT, -- 文件路径或 URL
    metadata JSONB,
    size_bytes BIGINT,
    checksum VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 1.11 工作流事件表（用于审计和追踪）
CREATE TABLE IF NOT EXISTS workflow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_execution_id UUID REFERENCES step_executions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- workflow.started / step.completed / review.approved 等
    event_data JSONB,
    actor_type VARCHAR(20), -- user / agent / system
    actor_id VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Part 2: 扩展现有表（ALTER TABLE）
-- ============================================================

-- 2.1 扩展 tasks 表（增加工作流关联字段）
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS step_execution_id UUID REFERENCES step_executions(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS step_order INTEGER;

-- 为新增字段添加索引
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_instance_id ON tasks(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_tasks_step_execution_id ON tasks(step_execution_id);

-- 2.2 扩展 sessions 表（假设存在 sessions 表，如不存在可忽略）
-- 注意：由于 db.py 中未明确定义 sessions 表，这里预留 ALTER 语句
-- CREATE TABLE IF NOT EXISTS sessions (
--     id TEXT PRIMARY KEY,
--     workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL,
--     step_execution_id UUID REFERENCES step_executions(id) ON DELETE SET NULL,
--     step_order INTEGER
-- );

-- 如果 sessions 表已存在，则执行以下 ALTER
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sessions') THEN
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workflow_instance_id UUID REFERENCES workflow_instances(id) ON DELETE SET NULL;
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS step_execution_id UUID REFERENCES step_executions(id) ON DELETE SET NULL;
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS step_order INTEGER;
        
        CREATE INDEX IF NOT EXISTS idx_sessions_workflow_instance_id ON sessions(workflow_instance_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_step_execution_id ON sessions(step_execution_id);
    END IF;
END $$;

-- ============================================================
-- Part 3: 索引设计
-- ============================================================

-- 3.1 workflow_templates 索引
CREATE INDEX idx_workflow_templates_created_by ON workflow_templates(created_by);
CREATE INDEX idx_workflow_templates_status ON workflow_templates(status);
CREATE INDEX idx_workflow_templates_name ON workflow_templates USING gin(to_tsvector('english', name));
CREATE INDEX idx_workflow_templates_tags ON workflow_templates USING gin(tags);
CREATE INDEX idx_workflow_templates_created_at ON workflow_templates(created_at DESC);

-- 3.2 workflow_instances 索引
CREATE INDEX idx_workflow_instances_template_id ON workflow_instances(template_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_workflow_instances_created_by ON workflow_instances(created_by);
CREATE INDEX idx_workflow_instances_created_at ON workflow_instances(created_at DESC);
CREATE INDEX idx_workflow_instances_started_at ON workflow_instances(started_at DESC);
CREATE INDEX idx_workflow_instances_completed_at ON workflow_instances(completed_at DESC);

-- 3.3 step_definitions 索引
CREATE INDEX idx_step_definitions_template_id ON step_definitions(template_id);
CREATE INDEX idx_step_definitions_step_id ON step_definitions(template_id, step_id);

-- 3.4 step_executions 索引
CREATE INDEX idx_step_executions_workflow_instance_id ON step_executions(workflow_instance_id);
CREATE INDEX idx_step_executions_status ON step_executions(status);
CREATE INDEX idx_step_executions_agent_id ON step_executions(agent_id);
CREATE INDEX idx_step_executions_step_id ON step_executions(workflow_instance_id, step_id);

-- 3.5 review_records 索引
CREATE INDEX idx_review_records_reviewer_id ON review_records(reviewer_id);
CREATE INDEX idx_review_records_workflow_instance_id ON review_records(workflow_instance_id);
CREATE INDEX idx_review_records_step_execution_id ON review_records(step_execution_id);
CREATE INDEX idx_review_records_timeout_at ON review_records(timeout_at);
CREATE INDEX idx_review_records_created_at ON review_records(created_at DESC);

-- 3.6 workflow_logs 索引
CREATE INDEX idx_workflow_logs_workflow_instance_id ON workflow_logs(workflow_instance_id);
CREATE INDEX idx_workflow_logs_step_execution_id ON workflow_logs(step_execution_id);
CREATE INDEX idx_workflow_logs_timestamp ON workflow_logs(timestamp DESC);
CREATE INDEX idx_workflow_logs_level ON workflow_logs(level);

-- 3.7 agents 索引
CREATE UNIQUE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_last_heartbeat ON agents(last_heartbeat DESC);
CREATE INDEX idx_agents_capabilities ON agents USING gin(capabilities);

-- 3.8 workflow_scheduler_queue 索引
CREATE INDEX idx_scheduler_queue_workflow_instance_id ON workflow_scheduler_queue(workflow_instance_id);
CREATE INDEX idx_scheduler_queue_status ON workflow_scheduler_queue(status);
CREATE INDEX idx_scheduler_queue_priority ON workflow_scheduler_queue(priority DESC, created_at);
CREATE INDEX idx_scheduler_queue_scheduled_at ON workflow_scheduler_queue(scheduled_at);

-- 3.9 workflow_artifacts 索引
CREATE INDEX idx_workflow_artifacts_workflow_instance_id ON workflow_artifacts(workflow_instance_id);
CREATE INDEX idx_workflow_artifacts_step_execution_id ON workflow_artifacts(step_execution_id);
CREATE INDEX idx_workflow_artifacts_type ON workflow_artifacts(artifact_type);

-- 3.10 workflow_events 索引
CREATE INDEX idx_workflow_events_workflow_instance_id ON workflow_events(workflow_instance_id);
CREATE INDEX idx_workflow_events_step_execution_id ON workflow_events(step_execution_id);
CREATE INDEX idx_workflow_events_event_type ON workflow_events(event_type);
CREATE INDEX idx_workflow_events_timestamp ON workflow_events(timestamp DESC);

-- ============================================================
-- Part 4: 触发器和函数
-- ============================================================

-- 4.1 自动更新 updated_at 字段的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4.2 为需要的表添加 updated_at 触发器
CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON workflow_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_instances_updated_at BEFORE UPDATE ON workflow_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_step_executions_updated_at BEFORE UPDATE ON step_executions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_records_updated_at BEFORE UPDATE ON review_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4.3 自动计算工作流整体进度的函数
CREATE OR REPLACE FUNCTION calculate_workflow_progress(
    p_workflow_instance_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_total_steps INTEGER;
    v_completed_steps INTEGER;
    v_progress INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_steps
    FROM step_executions
    WHERE workflow_instance_id = p_workflow_instance_id;
    
    SELECT COUNT(*) INTO v_completed_steps
    FROM step_executions
    WHERE workflow_instance_id = p_workflow_instance_id
      AND status IN ('completed', 'skipped');
    
    IF v_total_steps = 0 THEN
        RETURN 0;
    END IF;
    
    v_progress := (v_completed_steps * 100) / v_total_steps;
    
    UPDATE workflow_instances
    SET progress = v_progress
    WHERE id = p_workflow_instance_id;
    
    RETURN v_progress;
END;
$$ LANGUAGE plpgsql;

-- 4.4 自动更新工作流状态的函数
CREATE OR REPLACE FUNCTION update_workflow_status_on_step_completion()
RETURNS TRIGGER AS $$
BEGIN
    -- 当步骤完成时，检查是否所有步骤都完成
    IF NEW.status IN ('completed', 'skipped') AND OLD.status NOT IN ('completed', 'skipped') THEN
        PERFORM calculate_workflow_progress(NEW.workflow_instance_id);
        
        -- 检查是否所有步骤都完成
        IF NOT EXISTS (
            SELECT 1 FROM step_executions
            WHERE workflow_instance_id = NEW.workflow_instance_id
              AND status NOT IN ('completed', 'skipped')
        ) THEN
            UPDATE workflow_instances
            SET status = 'completed',
                completed_at = NOW(),
                duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
            WHERE id = NEW.workflow_instance_id
              AND status = 'running';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_step_completion_update_workflow
AFTER UPDATE ON step_executions
FOR EACH ROW
EXECUTE FUNCTION update_workflow_status_on_step_completion();

-- 4.5 审核超时检查函数
CREATE OR REPLACE FUNCTION check_review_timeout()
RETURNS void AS $$
DECLARE
    review_record RECORD;
BEGIN
    FOR review_record IN
        SELECT id, timeout_action, step_execution_id
        FROM review_records
        WHERE action IS NULL
          AND timeout_at IS NOT NULL
          AND timeout_at < NOW()
    LOOP
        -- 执行超时动作
        IF review_record.timeout_action = 'auto_reject' THEN
            UPDATE review_records
            SET action = 'reject',
                comment = '审核超时，自动拒绝',
                updated_at = NOW()
            WHERE id = review_record.id;
            
            UPDATE step_executions
            SET status = 'rejected',
                error_message = '审核超时，自动拒绝'
            WHERE id = review_record.step_execution_id;
        ELSIF review_record.timeout_action = 'auto_approve' THEN
            UPDATE review_records
            SET action = 'approve',
                comment = '审核超时，自动通过',
                updated_at = NOW()
            WHERE id = review_record.id;
            
            UPDATE step_executions
            SET status = 'approved'
            WHERE id = review_record.step_execution_id;
        END IF;
        
        -- 记录事件
        INSERT INTO workflow_events (workflow_instance_id, step_execution_id, event_type, event_data, actor_type)
        SELECT 
            r.workflow_instance_id,
            r.step_execution_id,
            'review.timeout',
            jsonb_build_object('action', review_record.timeout_action),
            'system'
        FROM review_records r
        WHERE r.id = review_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4.6 定时任务：检查审核超时（需要 pg_cron 扩展）
-- 注意：需要先安装 pg_cron 扩展
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('check_review_timeout', '*/5 * * * *', 'SELECT check_review_timeout()');

-- ============================================================
-- Part 5: 初始测试数据
-- ============================================================

-- 5.1 插入测试 Agent
INSERT INTO agents (id, name, display_name, capabilities, status, config, created_at, updated_at) VALUES
('agent-001', 'rd-product-researcher', '产品研究员', ARRAY['research', 'requirements'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-002', 'rd-commander', '研发总指挥', ARRAY['coordination', 'review'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-003', 'rd-product-manager', '产品经理', ARRAY['prd', 'requirements'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-004', 'rd-pm-checker', '产品评审', ARRAY['review', 'validation'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-005', 'rd-backend-arch', '后端架构师', ARRAY['backend', 'architecture'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-006', 'rd-backend-dev', '后端开发', ARRAY['backend', 'coding'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-007', 'rd-frontend-arch', '前端架构师', ARRAY['frontend', 'architecture'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-008', 'rd-frontend-dev', '前端开发', ARRAY['frontend', 'coding'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-009', 'rd-dba', 'DBA', ARRAY['database', 'sql'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-010', 'dba-checker', 'DBA 评审', ARRAY['database', 'review'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-011', 'ui-designer', 'UI 设计师', ARRAY['ui', 'design'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-012', 'ui-checker', 'UI 走查', ARRAY['ui', 'review'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-013', 'rd-tester-auto', '自动化测试', ARRAY['testing', 'automation'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-014', 'rd-tester-func', '功能测试', ARRAY['testing', 'validation'], 'online', '{"model": "gpt-4"}', NOW(), NOW()),
('agent-015', 'devops', '运维工程师', ARRAY['deployment', 'monitoring'], 'online', '{"model": "gpt-4"}', NOW(), NOW());

-- 5.2 插入测试工作流模板
INSERT INTO workflow_templates (id, name, description, version, status, dag, config, created_at, created_by, updated_at, published_at, usage_count, tags) VALUES
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
NOW(), 'user-001', NOW(), NOW(), 5, ARRAY['研发', '标准流程']);

-- 5.3 插入测试步骤定义
INSERT INTO step_definitions (id, template_id, step_id, name, agent, capabilities, estimated_duration, human_review, depends_on, created_at) VALUES
('sd-001', 'template-001', 'step1', '需求分析', 'rd-product-researcher', ARRAY['research'], 60, FALSE, ARRAY[]::TEXT[], NOW()),
('sd-002', 'template-001', 'step2', '需求验证', 'rd-commander', ARRAY['coordination', 'review'], 30, FALSE, ARRAY['step1'], NOW()),
('sd-003', 'template-001', 'step3', 'PRD 编写', 'rd-product-manager', ARRAY['prd'], 120, TRUE, ARRAY['step2'], NOW());

-- 5.4 插入测试工作流实例
INSERT INTO workflow_instances (id, template_id, template_version, status, input, progress, created_at, created_by, started_at) VALUES
('wf-001', 'template-001', 'v1.0', 'running', '{"project_name": "测试项目", "requirements_path": "/path/to/req.md"}', 33, NOW(), 'user-001', NOW());

-- 5.5 插入测试步骤执行记录
INSERT INTO step_executions (id, workflow_instance_id, step_id, name, status, agent_id, agent_name, progress, started_at, completed_at, duration, created_at, updated_at) VALUES
('se-001', 'wf-001', 'step1', '需求分析', 'completed', 'agent-001', 'rd-product-researcher', 100, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '15 minutes', 2700, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '15 minutes'),
('se-002', 'wf-001', 'step2', '需求验证', 'completed', 'agent-002', 'rd-commander', 100, NOW() - INTERVAL '14 minutes', NOW() - INTERVAL '5 minutes', 540, NOW() - INTERVAL '14 minutes', NOW() - INTERVAL '5 minutes'),
('se-003', 'wf-001', 'step3', 'PRD 编写', 'running', 'agent-003', 'rd-product-manager', 65, NOW() - INTERVAL '4 minutes', NULL, NULL, NOW() - INTERVAL '4 minutes', NOW());

-- 5.6 插入测试审核记录
INSERT INTO review_records (id, workflow_instance_id, step_execution_id, reviewer_id, reviewer_name, action, comment, created_at, updated_at, timeout_at, timeout_action, review_round) VALUES
('review-001', 'wf-001', 'se-003', 'user-002', '审核人A', NULL, NULL, NOW(), NOW(), NOW() + INTERVAL '24 hours', 'auto_reject', 1);

-- 5.7 插入测试日志
INSERT INTO workflow_logs (workflow_instance_id, step_execution_id, timestamp, level, message, metadata, created_at) VALUES
('wf-001', 'se-001', NOW() - INTERVAL '55 minutes', 'INFO', '开始执行需求分析', '{"agent": "rd-product-researcher"}', NOW() - INTERVAL '55 minutes'),
('wf-001', 'se-001', NOW() - INTERVAL '30 minutes', 'INFO', '需求分析进度更新', '{"progress": 50}', NOW() - INTERVAL '30 minutes'),
('wf-001', 'se-001', NOW() - INTERVAL '16 minutes', 'INFO', '需求分析完成', '{"output": "docs/requirements.md"}', NOW() - INTERVAL '16 minutes'),
('wf-001', 'se-002', NOW() - INTERVAL '14 minutes', 'INFO', '开始执行需求验证', '{"agent": "rd-commander"}', NOW() - INTERVAL '14 minutes'),
('wf-001', 'se-002', NOW() - INTERVAL '6 minutes', 'INFO', '需求验证完成', '{"validation": "passed"}', NOW() - INTERVAL '6 minutes'),
('wf-001', 'se-003', NOW() - INTERVAL '4 minutes', 'INFO', '开始执行 PRD 编写', '{"agent": "rd-product-manager"}', NOW() - INTERVAL '4 minutes'),
('wf-001', 'se-003', NOW() - INTERVAL '2 minutes', 'INFO', 'PRD 编写进度更新', '{"progress": 65}', NOW() - INTERVAL '2 minutes');

-- 5.8 插入测试事件
INSERT INTO workflow_events (workflow_instance_id, step_execution_id, event_type, event_data, actor_type, actor_id, timestamp, created_at) VALUES
('wf-001', NULL, 'workflow.started', '{"input": {"project_name": "测试项目"}}', 'user', 'user-001', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('wf-001', 'se-001', 'step.started', '{"agent": "rd-product-researcher"}', 'agent', 'agent-001', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
('wf-001', 'se-001', 'step.completed', '{"duration": 2700}', 'agent', 'agent-001', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes'),
('wf-001', 'se-002', 'step.started', '{"agent": "rd-commander"}', 'agent', 'agent-002', NOW() - INTERVAL '14 minutes', NOW() - INTERVAL '14 minutes'),
('wf-001', 'se-002', 'step.completed', '{"duration": 540}', 'agent', 'agent-002', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
('wf-001', 'se-003', 'step.started', '{"agent": "rd-product-manager"}', 'agent', 'agent-003', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes'),
('wf-001', 'se-003', 'step.progress', '{"progress": 65, "message": "正在编写功能需求"}', 'agent', 'agent-003', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
('wf-001', 'se-003', 'review.created', '{"reviewer": "user-002", "timeout_at": "' || (NOW() + INTERVAL '24 hours')::text || '"}', 'system', 'system', NOW(), NOW());

-- ============================================================
-- Part 6: 视图定义（可选，便于查询）
-- ============================================================

-- 6.1 工作流实例详情视图
CREATE OR REPLACE VIEW workflow_instance_details AS
SELECT 
    wi.*,
    wt.name AS template_name,
    wt.description AS template_description,
    u.username AS creator_name,
    COUNT(se.id) AS total_steps,
    COUNT(CASE WHEN se.status = 'completed' THEN 1 END) AS completed_steps,
    COUNT(CASE WHEN se.status = 'running' THEN 1 END) AS running_steps,
    COUNT(CASE WHEN se.status = 'failed' THEN 1 END) AS failed_steps,
    COUNT(CASE WHEN se.status = 'awaiting_review' THEN 1 END) AS review_pending_steps
FROM workflow_instances wi
LEFT JOIN workflow_templates wt ON wi.template_id = wt.id
LEFT JOIN users u ON wi.created_by = u.id
LEFT JOIN step_executions se ON wi.id = se.workflow_instance_id
GROUP BY wi.id, wt.name, wt.description, u.username;

-- 6.2 待审核列表视图
CREATE OR REPLACE VIEW pending_reviews_view AS
SELECT 
    rr.*,
    wi.template_id,
    wt.name AS workflow_name,
    se.name AS step_name,
    se.output AS step_output,
    u.username AS reviewer_username,
    EXTRACT(EPOCH FROM (rr.timeout_at - NOW()))::INTEGER AS remaining_seconds
FROM review_records rr
JOIN workflow_instances wi ON rr.workflow_instance_id = wi.id
JOIN workflow_templates wt ON wi.template_id = wt.id
JOIN step_executions se ON rr.step_execution_id = se.id
LEFT JOIN users u ON rr.reviewer_id = u.id
WHERE rr.action IS NULL
ORDER BY rr.timeout_at ASC;

-- 6.3 Agent 负载统计视图
CREATE OR REPLACE VIEW agent_load_stats AS
SELECT 
    a.id,
    a.name,
    a.display_name,
    a.status,
    COUNT(se.id) AS current_tasks,
    COUNT(CASE WHEN se.status = 'running' THEN 1 END) AS running_tasks,
    AVG(se.duration) AS avg_task_duration
FROM agents a
LEFT JOIN step_executions se ON a.id = se.agent_id AND se.status IN ('running', 'assigned')
GROUP BY a.id, a.name, a.display_name, a.status;

-- ============================================================
-- Part 7: 验证 SELECT 语句（测试数据完整性）
-- ============================================================

-- 7.1 验证工作流模板
SELECT 
    id, name, version, status, 
    jsonb_array_length(dag->'steps') AS step_count,
    usage_count, tags
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
    EXTRACT(EPOCH FROM (rr.timeout_at - NOW()))::INTEGER / 3600 AS remaining_hours
FROM review_records rr
JOIN step_executions se ON rr.step_execution_id = se.id
WHERE rr.action IS NULL;

-- 预期结果：1 行，