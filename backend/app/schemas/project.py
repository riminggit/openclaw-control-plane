from pydantic import BaseModel


class ProjectItem(BaseModel):
    id: str
    code: str
    name: str
    status: str
    ownerRole: str
    taskCount: int
    blockedTaskCount: int
    archiveFolderToken: str | None = None
    updatedAt: str


class ProjectListResponse(BaseModel):
    items: list[ProjectItem]
    total: int
    page: int = 1
    page_size: int = 50
