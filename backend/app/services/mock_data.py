from datetime import datetime

now = datetime.utcnow().isoformat()

PROJECTS = [
    {
        "id": "proj-ocp-001",
        "code": "OCP",
        "name": "OpenClaw Control Plane MVP",
        "status": "IN_PROGRESS",
        "ownerRole": "rd-commander",
        "taskCount": 32,
        "blockedTaskCount": 2,
        "archiveFolderToken": "FSvSfETUbljDWtdVwWacfV27n9H",
        "updatedAt": now,
    }
]

TASKS = [
    {
        "id": "task-rpm-01",
        "title": "冻结核心字段",
        "projectId": "proj-ocp-001",
        "category": "requirement",
        "phase": "Sprint 0",
        "priority": "P0",
        "status": "PLANNED",
        "ownerRole": "rd-product-manager",
        "ownerAgentId": None,
        "riskLevel": "medium",
        "docSyncRisk": "low",
        "updatedAt": now,
    },
    {
        "id": "task-rba-01",
        "title": "初始化后端骨架",
        "projectId": "proj-ocp-001",
        "category": "backend",
        "phase": "Sprint 1",
        "priority": "P0",
        "status": "IN_PROGRESS",
        "ownerRole": "rd-backend-arch",
        "ownerAgentId": None,
        "riskLevel": "low",
        "docSyncRisk": "low",
        "updatedAt": now,
    },
]
