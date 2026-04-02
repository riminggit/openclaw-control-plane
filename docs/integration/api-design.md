# API 设计

> **文档版本**: 1.0.0  
> **创建日期**: 2026-04-02  
> **最后更新**: 2026-04-02  

---

## 1. API 概览

### 1.1 基础信息

- **基础 URL**: `https://api.openclaw.example.com/api/v1`
- **认证方式**: JWT Bearer Token
- **内容格式**: JSON
- **字符编码**: UTF-8

### 1.2 通用响应格式

#### 成功响应
```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "request_id": "req_123456",
    "timestamp": "2026-04-02T21:49:00Z"
  }
}
```

#### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "Tool 'invalid_tool' not found",
    "details": {
      "tool_name": "invalid_tool"
    }
  },
  "metadata": {
    "request_id": "req_123456",
    "timestamp": "2026-04-02T21:49:00Z"
  }
}
```

### 1.3 认证

**请求头**:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## 2. 工具管理 API

### 2.1 获取工具列表

**端点**: `GET /api/v1/tools`

**描述**: 获取所有可用工具的列表

**权限**: `tools:read`

**查询参数**:
| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `category` | string | 否 | 按类别过滤 |
| `permission` | string | 否 | 按权限过滤 |
| `search` | string | 否 | 搜索关键词 |
| `page` | integer | 否 | 页码（默认 1） |
| `page_size` | integer | 否 | 每页数量（默认 20） |

**请求示例**:
```http
GET /api/v1/tools?category=search&page=1&page_size=10
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tools": [
      {
        "name": "web_search",
        "display_name": "Web Search",
        "description": "Search the web using search engines",
        "category": "search",
        "version": "1.0.0",
        "permissions": ["web:search"],
        "parameters": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Search query"
            },
            "count": {
              "type": "integer",
              "default": 10,
              "description": "Number of results"
            }
          },
          "required": ["query"]
        },
        "tags": ["search", "web", "internet"]
      },
      {
        "name": "file_read",
        "display_name": "Read File",
        "description": "Read file contents from local filesystem",
        "category": "file",
        "version": "1.0.0",
        "permissions": ["file:read"],
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string",
              "description": "File path"
            }
          },
          "required": ["path"]
        },
        "tags": ["file", "read", "filesystem"]
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 45,
      "total_pages": 5
    }
  }
}
```

### 2.2 获取工具详情

**端点**: `GET /api/v1/tools/:name`

**描述**: 获取单个工具的详细信息

**权限**: `tools:read`

**路径参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `name` | string | 工具名称 |

**请求示例**:
```http
GET /api/v1/tools/web_search
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "web_search",
    "display_name": "Web Search",
    "description": "Search the web using DuckDuckGo",
    "category": "search",
    "version": "1.0.0",
    "permissions": ["web:search"],
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query string",
          "minLength": 1,
          "maxLength": 500
        },
        "count": {
          "type": "integer",
          "description": "Number of results (1-50)",
          "default": 10,
          "minimum": 1,
          "maximum": 50
        },
        "region": {
          "type": "string",
          "description": "Region code (e.g., us-en, zh-cn)",
          "default": "us-en"
        },
        "safesearch": {
          "type": "string",
          "enum": ["strict", "moderate", "off"],
          "default": "moderate"
        }
      },
      "required": ["query"]
    },
    "examples": [
      {
        "params": {
          "query": "OpenClaw AI",
          "count": 5
        },
        "result": "Returns 5 search results about OpenClaw AI"
      }
    ],
    "rate_limit": {
      "requests_per_minute": 60,
      "requests_per_day": 1000
    },
    "timeout_seconds": 30,
    "tags": ["search", "web", "internet", "duckduckgo"]
  }
}
```

### 2.3 执行工具

**端点**: `POST /api/v1/tools/:name/execute`

**描述**: 执行指定的工具

**权限**: `tools:execute` + 工具特定权限

**路径参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `name` | string | 工具名称 |

**请求体**:
```json
{
  "params": {
    "query": "OpenClaw Control Plane",
    "count": 5
  },
  "context": {
    "session_id": "sess_123456",
    "agent_id": "agent_789",
    "workflow_instance_id": "wf_012"
  },
  "options": {
    "timeout_seconds": 30,
    "retry_count": 2,
    "dry_run": false
  }
}
```

**请求示例**:
```http
POST /api/v1/tools/web_search/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "params": {
    "query": "OpenClaw Control Plane",
    "count": 5
  },
  "context": {
    "session_id": "sess_123456",
    "agent_id": "agent_789"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "execution_id": "exec_345678",
    "tool": "web_search",
    "status": "completed",
    "result": [
      {
        "title": "OpenClaw Control Plane Documentation",
        "url": "https://docs.openclaw.ai",
        "snippet": "OpenClaw Control Plane is an AI agent orchestration platform..."
      },
      {
        "title": "OpenClaw GitHub Repository",
        "url": "https://github.com/openclaw/control-plane",
        "snippet": "Official repository for OpenClaw Control Plane..."
      }
    ],
    "metadata": {
      "execution_time_ms": 1234,
      "result_count": 2,
      "timestamp": "2026-04-02T21:49:00Z"
    }
  }
}
```

### 2.4 获取工具执行历史

**端点**: `GET /api/v1/tools/:name/executions`

**描述**: 获取工具的执行历史记录

**权限**: `tools:read`

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `agent_id` | string | 按 Agent 过滤 |
| `session_id` | string | 按会话过滤 |
| `status` | string | 按状态过滤 |
| `start_time` | string | 开始时间（ISO 8601） |
| `end_time` | string | 结束时间（ISO 8601） |
| `page` | integer | 页码 |
| `page_size` | integer | 每页数量 |

**请求示例**:
```http
GET /api/v1/tools/web_search/executions?agent_id=agent_789&page=1
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "execution_id": "exec_345678",
        "tool": "web_search",
        "agent_id": "agent_789",
        "session_id": "sess_123456",
        "status": "completed",
        "params": {
          "query": "OpenClaw"
        },
        "result_summary": {
          "result_count": 5,
          "execution_time_ms": 1234
        },
        "created_at": "2026-04-02T21:49:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 45
    }
  }
}
```

---

## 3. 命令管理 API

### 3.1 获取命令列表

**端点**: `GET /api/v1/commands`

**描述**: 获取所有可用命令的列表

**权限**: `commands:read`

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `category` | string | 按类别过滤 |
| `search` | string | 搜索关键词 |
| `page` | integer | 页码 |
| `page_size` | integer | 每页数量 |

**请求示例**:
```http
GET /api/v1/commands
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "commands": [
      {
        "name": "git_commit",
        "display_name": "Git Commit",
        "description": "Create a git commit with staged changes",
        "category": "version_control",
        "port": 8081,
        "arguments": {
          "type": "object",
          "properties": {
            "message": {
              "type": "string",
              "description": "Commit message"
            },
            "allow_empty": {
              "type": "boolean",
              "default": false
            }
          },
          "required": ["message"]
        },
        "permissions": ["git:commit"]
      },
      {
        "name": "npm_install",
        "display_name": "NPM Install",
        "description": "Install npm dependencies",
        "category": "package_management",
        "port": 8082,
        "arguments": {
          "type": "object",
          "properties": {
            "packages": {
              "type": "array",
              "items": {"type": "string"}
            },
            "dev": {
              "type": "boolean",
              "default": false
            }
          }
        },
        "permissions": ["npm:install"]
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 30
    }
  }
}
```

### 3.2 执行命令

**端点**: `POST /api/v1/commands/:name/execute`

**描述**: 执行指定的命令

**权限**: `commands:execute` + 命令特定权限

**路径参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `name` | string | 命令名称 |

**请求体**:
```json
{
  "arguments": {
    "message": "feat: add claw-code integration"
  },
  "context": {
    "agent_id": "agent_789",
    "working_directory": "/workspace/project"
  },
  "options": {
    "timeout_seconds": 60,
    "async": false
  }
}
```

**请求示例**:
```http
POST /api/v1/commands/git_commit/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "arguments": {
    "message": "feat: add claw-code integration"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "execution_id": "cmd_exec_456789",
    "command": "git_commit",
    "status": "completed",
    "result": {
      "exit_code": 0,
      "stdout": "[main 3a4b5c6] feat: add claw-code integration\n 5 files changed, 123 insertions(+)\n",
      "stderr": "",
      "commit_hash": "3a4b5c6d7890abcdef"
    },
    "metadata": {
      "execution_time_ms": 567,
      "timestamp": "2026-04-02T21:50:00Z"
    }
  }
}
```

### 3.3 获取命令积压

**端点**: `GET /api/v1/commands/backlog`

**描述**: 获取命令执行积压状态

**权限**: `commands:read`

**请求示例**:
```http
GET /api/v1/commands/backlog
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "backlog": {
      "pending_count": 5,
      "running_count": 2,
      "completed_count": 1234,
      "failed_count": 12,
      "commands": [
        {
          "execution_id": "cmd_exec_456790",
          "command": "npm_install",
          "status": "pending",
          "priority": 5,
          "queued_at": "2026-04-02T21:48:00Z"
        },
        {
          "execution_id": "cmd_exec_456791",
          "command": "git_push",
          "status": "running",
          "started_at": "2026-04-02T21:48:30Z"
        }
      ]
    }
  }
}
```

---

## 4. 任务管理 API

### 4.1 获取任务列表

**端点**: `GET /api/v1/tasks`

**描述**: 获取所有任务的列表

**权限**: `tasks:read`

**查询参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `status` | string | 按状态过滤 (pending/running/completed/failed) |
| `agent_id` | string | 按 Agent 过滤 |
| `workflow_id` | string | 按工作流实例过滤 |
| `parent_task_id` | string | 按父任务过滤 |
| `page` | integer | 页码 |
| `page_size` | integer | 每页数量 |

**请求示例**:
```http
GET /api/v1/tasks?status=running&page=1
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "task_id": "task_123456",
        "name": "Code Review Task",
        "description": "Review code changes and provide feedback",
        "status": "running",
        "agent_id": "agent_789",
        "workflow_instance_id": "wf_012",
        "parent_task_id": null,
        "subtask_count": 3,
        "progress": {
          "completed_steps": 2,
          "total_steps": 5,
          "percentage": 40
        },
        "created_at": "2026-04-02T21:45:00Z",
        "updated_at": "2026-04-02T21:50:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 15
    }
  }
}
```

### 4.2 创建任务

**端点**: `POST /api/v1/tasks`

**描述**: 创建新任务

**权限**: `tasks:create`

**请求体**:
```json
{
  "name": "Data Processing Task",
  "description": "Process uploaded CSV files",
  "agent_id": "agent_789",
  "spec": {
    "type": "data_processing",
    "inputs": {
      "file_paths": ["/data/upload1.csv", "/data/upload2.csv"]
    },
    "outputs": {
      "format": "json",
      "destination": "/data/output/"
    },
    "options": {
      "parallel": true,
      "max_workers": 4
    }
  },
  "parent_task_id": null,
  "workflow_instance_id": "wf_012"
}
```

**请求示例**:
```http
POST /api/v1/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Data Processing Task",
  "description": "Process uploaded CSV files",
  "agent_id": "agent_789",
  "spec": {
    "type": "data_processing",
    "inputs": {
      "file_paths": ["/data/upload1.csv"]
    }
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "task_id": "task_789012",
    "name": "Data Processing Task",
    "description": "Process uploaded CSV files",
    "status": "pending",
    "agent_id": "agent_789",
    "spec": {
      "type": "data_processing",
      "inputs": {
        "file_paths": ["/data/upload1.csv"]
      }
    },
    "created_at": "2026-04-02T21:51:00Z"
  }
}
```

### 4.3 更新任务

**端点**: `PUT /api/v1/tasks/:id`

**描述**: 更新任务信息

**权限**: `tasks:update`

**路径参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | 任务 ID |

**请求体**:
```json
{
  "status": "paused",
  "priority": 10,
  "metadata": {
    "notes": "Paused due to system maintenance"
  }
}
```

**请求示例**:
```http
PUT /api/v1/tasks/task_789012
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "paused"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "task_id": "task_789012",
    "status": "paused",
    "updated_at": "2026-04-02T21:52:00Z"
  }
}
```

### 4.4 获取任务详情

**端点**: `GET /api/v1/tasks/:id`

**描述**: 获取任务详细信息

**权限**: `tasks:read`

**请求示例**:
```http
GET /api/v1/tasks/task_123456
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "task_id": "task_123456",
    "name": "Code Review Task",
    "description": "Review code changes and provide feedback",
    "status": "completed",
    "agent_id": "agent_789",
    "workflow_instance_id": "wf_012",
    "spec": {
      "type": "code_review",
      "inputs": {
        "repository": "openclaw/control-plane",
        "pr_number": 42
      },
      "outputs": {
        "review_report": "/reports/pr42_review.md"
      }
    },
    "result": {
      "status": "success",
      "summary": "Code review completed with 3 suggestions",
      "artifacts": [
        "/reports/pr42_review.md"
      ]
    },
    "subtasks": [
      {
        "task_id": "task_123457",
        "name": "Analyze Code Style",
        "status": "completed"
      },
      {
        "task_id": "task_123458",
        "name": "Check Security Issues",
        "status": "completed"
      }
    ],
    "execution_log": [
      {
        "timestamp": "2026-04-02T21:45:00Z",
        "event": "task_started"
      },
      {
        "timestamp": "2026-04-02T21:46:00Z",
        "event": "subtask_created",
        "details": {"subtask_id": "task_123457"}
      },
      {
        "timestamp": "2026-04-02T21:50:00Z",
        "event": "task_completed"
      }
    ],
    "created_at": "2026-04-02T21:45:00Z",
    "updated_at": "2026-04-02T21:50:00Z",
    "completed_at": "2026-04-02T21:50:00Z"
  }
}
```

---

## 5. Agent Harness API

### 5.1 执行 Agent

**端点**: `POST /api/v1/agents/:id/execute`

**描述**: 启动 Agent 执行

**权限**: `agents:execute`

**路径参数**:
| 参数 | 类型 | 描述 |
|------|------|------|
| `id` | string | Agent ID |

**请求体**:
```json
{
  "input": {
    "task": "Analyze the repository structure",
    "repository": "openclaw/control-plane"
  },
  "context": {
    "session_id": "sess_123456",
    "workflow_instance_id": "wf_012"
  },
  "options": {
    "mode": "sync",
    "timeout_seconds": 300,
    "enable_logging": true
  }
}
```

**请求示例**:
```http
POST /api/v1/agents/agent_789/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "input": {
    "task": "Analyze the repository structure"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "execution_id": "agent_exec_567890",
    "agent_id": "agent_789",
    "status": "running",
    "mode": "sync",
    "websocket_url": "wss://api.openclaw.example.com/ws/agents/agent_789/executions/agent_exec_567890",
    "created_at": "2026-04-02T21:53:00Z"
  }
}
```

### 5.2 获取 Agent 状态

**端点**: `GET /api/v1/agents/:id/status`

**描述**: 获取 Agent 当前状态

**权限**: `agents:read`

**请求示例**:
```http
GET /api/v1/agents/agent_789/status
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent_789",
    "status": "busy",
    "current_execution": {
      "execution_id": "agent_exec_567890",
      "task": "Analyze the repository structure",
      "started_at": "2026-04-02T21:53:00Z",
      "progress": {
        "step": "analyzing_structure",
        "percentage": 65,
        "tools_used": ["file_read", "directory_list"]
      }
    },
    "statistics": {
      "total_executions": 234,
      "successful_executions": 228,
      "failed_executions": 6,
      "average_execution_time_ms": 12345
    },
    "last_execution": {
      "execution_id": "agent_exec_567889",
      "status": "completed",
      "completed_at": "2026-04-02T21:50:00Z"
    }
  }
}
```

### 5.3 WebSocket 实时通信

**端点**: `WebSocket /ws/agents/:id`

**描述**: 建立 WebSocket 连接以实时接收 Agent 状态更新

**连接 URL**: `wss://api.openclaw.example.com/ws/agents/agent_789`

**认证**: 通过查询参数传递 token
```
wss://api.openclaw.example.com/ws/agents/agent_789?token=<jwt_token>
```

#### 消息类型

**客户端 → 服务端**:

1. **订阅执行**
```json
{
  "type": "subscribe",
  "execution_id": "agent_exec_567890"
}
```

2. **取消执行**
```json
{
  "type": "cancel",
  "execution_id": "agent_exec_567890"
}
```

3. **发送输入**
```json
{
  "type": "input",
  "execution_id": "agent_exec_567890",
  "data": {
    "action": "continue",
    "params": {}
  }
}
```

**服务端 → 客户端**:

1. **连接确认**
```json
{
  "type": "connected",
  "agent_id": "agent_789",
  "timestamp": "2026-04-02T21:54:00Z"
}
```

2. **执行状态更新**
```json
{
  "type": "execution_update",
  "execution_id": "agent_exec_567890",
  "status": "running",
  "progress": {
    "step": "analyzing_files",
    "percentage": 75,
    "message": "Analyzing Python files..."
  },
  "timestamp": "2026-04-02T21:54:30Z"
}
```

3. **工具调用事件**
```json
{
  "type": "tool_event",
  "execution_id": "agent_exec_567890",
  "tool": "file_read",
  "event": "started",
  "params": {
    "path": "/src/main.py"
  },
  "timestamp": "2026-04-02T21:54:31Z"
}
```

```json
{
  "type": "tool_event",
  "execution_id": "agent_exec_567890",
  "tool": "file_read",
  "event": "completed",
  "duration_ms": 45,
  "success": true,
  "timestamp": "2026-04-02T21:54:31Z"
}
```

4. **执行完成**
```json
{
  "type": "execution_completed",
  "execution_id": "agent_exec_567890",
  "status": "success",
  "result": {
    "summary": "Repository analysis completed",
    "files_analyzed": 45,
    "recommendations": [...]
  },
  "execution_time_ms": 12345,
  "timestamp": "2026-04-02T21:55:00Z"
}
```

5. **错误通知**
```json
{
  "type": "error",
  "execution_id": "agent_exec_567890",
  "error": {
    "code": "TIMEOUT",
    "message": "Execution timed out after 300 seconds"
  },
  "timestamp": "2026-04-02T21:58:00Z"
}
```

---

## 6. 权限管理 API

### 6.1 获取工具权限配置

**端点**: `GET /api/v1/agents/:id/permissions/tools`

**描述**: 获取 Agent 的工具权限配置

**权限**: `agents:manage`

**请求示例**:
```http
GET /api/v1/agents/agent_789/permissions/tools
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent_789",
    "permissions": {
      "allowed_tools": [
        "web_search",
        "file_read",
        "file_write"
      ],
      "denied_tools": [
        "system_command"
      ],
      "tool_categories": {
        "search": "allow",
        "file": "allow",
        "system": "deny"
      },
      "permission_context": {
        "file_paths": ["/workspace/*"],
        "network_access": true
      }
    }
  }
}
```

### 6.2 更新工具权限配置

**端点**: `PUT /api/v1/agents/:id/permissions/tools`

**描述**: 更新 Agent 的工具权限配置

**权限**: `agents:manage`

**请求体**:
```json
{
  "allowed_tools": ["web_search", "file_read"],
  "denied_tools": ["system_command"],
  "permission_context": {
    "file_paths": ["/workspace/project/*"],
    "network_access": false
  }
}
```

**请求示例**:
```http
PUT /api/v1/agents/agent_789/permissions/tools
Authorization: Bearer <token>
Content-Type: application/json

{
  "allowed_tools": ["web_search", "file_read"]
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "agent_id": "agent_789",
    "message": "Tool permissions updated successfully",
    "updated_at": "2026-04-02T21:56:00Z"
  }
}
```

---

## 7. 错误码定义

### 7.1 通用错误码

| 错误码 | HTTP 状态 | 描述 |
|--------|-----------|------|
| `INVALID_REQUEST` | 400 | 请求参数无效 |
| `UNAUTHORIZED` | 401 | 未授权访问 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 |

### 7.2 工具相关错误码

| 错误码 | HTTP 状态 | 描述 |
|--------|-----------|------|
| `TOOL_NOT_FOUND` | 404 | 工具不存在 |
| `TOOL_EXECUTION_FAILED` | 500 | 工具执行失败 |
| `TOOL_TIMEOUT` | 408 | 工具执行超时 |
| `TOOL_PERMISSION_DENIED` | 403 | 无工具执行权限 |
| `INVALID_TOOL_PARAMS` | 400 | 工具参数无效 |

### 7.3 命令相关错误码

| 错误码 | HTTP 状态 | 描述 |
|--------|-----------|------|
| `COMMAND_NOT_FOUND` | 404 | 命令不存在 |
| `COMMAND_EXECUTION_FAILED` | 500 | 命令执行失败 |
| `COMMAND_TIMEOUT` | 408 | 命令执行超时 |
| `COMMAND_PERMISSION_DENIED` | 403 | 无命令执行权限 |

### 7.4 任务相关错误码

| 错误码 | HTTP 状态 | 描述 |
|--------|-----------|------|
| `TASK_NOT_FOUND` | 404 | 任务不存在 |
| `TASK_ALREADY_RUNNING` | 409 | 任务已在运行 |
| `TASK_CANCELLATION_FAILED` | 500 | 任务取消失败 |
| `INVALID_TASK_STATUS` | 400 | 无效的任务状态 |

---

## 8. 版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| 1.0.0 | 2026-04-02 | rd-commander | 初始版本 |
