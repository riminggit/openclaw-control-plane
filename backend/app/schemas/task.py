from pydantic import BaseModel


class TaskItem(BaseModel):
    id: str
    title: str
    projectId: str
    category: str
    phase: str
    priority: str
    status: str
    ownerRole: str
    ownerAgentId: str | None = None
    riskLevel: str = "medium"
    docSyncRisk: str = "low"
    updatedAt: str


class TaskListResponse(BaseModel):
    items: list[TaskItem]
    total: int
