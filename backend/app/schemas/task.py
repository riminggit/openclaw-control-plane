from pydantic import BaseModel


class TaskItem(BaseModel):
    id: str
    title: str
    description: str | None = None
    projectId: str
    projectCode: str | None = None
    projectName: str | None = None
    category: str | None = None
    phase: str | None = None
    priority: str
    status: str
    ownerRole: str | None = None
    ownerAgentId: str | None = None
    riskLevel: str = "low"
    docSyncRisk: str = "low"
    createdAt: str | None = None
    updatedAt: str


class TaskListResponse(BaseModel):
    items: list[TaskItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 50
