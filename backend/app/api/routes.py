import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy import text

from app.db import get_db, Project, Task
from app.schemas.common import HealthResponse, ReadyResponse
from app.schemas.project import ProjectItem, ProjectListResponse
from app.schemas.task import TaskItem, TaskListResponse
router = APIRouter(prefix="/api")


# ── Pydantic Request Schemas ────────────────────────────────

class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=50, pattern=r'^[a-zA-Z0-9_-]+$')
    description: Optional[str] = None

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern=r'^(active|archived|suspended)$')

class CreateTaskRequest(BaseModel):
    project_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1, max_length=500)
    category: str = Field("backend")
    priority: str = Field("medium")
    status: str = Field("planned")
    phase: Optional[str] = None
    owner_role: Optional[str] = None
    description: Optional[str] = None

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    category: Optional[str] = None
    phase: Optional[str] = None
    owner_role: Optional[str] = None

class PaginatedResponse(BaseModel):
    items: list = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 50


def _task_to_item(t: Task, project: Project | None = None) -> TaskItem:
    return TaskItem(
        id=str(t.id),
        title=t.title,
        description=t.description,
        projectId=str(t.project_id),
        projectCode=project.code if project else None,
        projectName=project.name if project else None,
        category=t.category,
        phase=t.phase or "",
        priority=t.priority,
        status=t.status,
        ownerRole=t.owner_role or "",
        ownerAgentId=str(t.owner_agent_id) if t.owner_agent_id else None,
        riskLevel=t.risk_level or "low",
        docSyncRisk="high" if t.doc_sync_risk else "low",
        createdAt=str(t.created_at) if t.created_at else None,
        updatedAt=str(t.updated_at) if t.updated_at else None,
    )


def _project_to_item(p: Project, task_count: int = 0, blocked_count: int = 0) -> ProjectItem:
    return ProjectItem(
        id=str(p.id),
        code=p.code,
        name=p.name,
        status=p.status,
        ownerRole=p.owner_role or "",
        taskCount=task_count,
        blockedTaskCount=blocked_count,
        archiveFolderToken=p.archive_root_folder_token,
        updatedAt=str(p.updated_at),
    )


# ── Health ───────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)):
    return HealthResponse(status="ok", service="OpenClaw Control Plane API", env="dev")


@router.get("/ready", response_model=ReadyResponse)
def ready(db: Session = Depends(get_db)):
    return ReadyResponse(status="ready", checks={"api": "ok", "storage": "db", "adapter": "pending"})


# ── Projects ─────────────────────────────────────────────────────

@router.get("/projects", response_model=ProjectListResponse)
def list_projects(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    total = db.query(Project).count()
    # P1-V2-1: Fix N+1 — use subqueries instead of per-row COUNT
    task_count_sq = db.query(Task.project_id, func.count().label("cnt")).group_by(Task.project_id).subquery()
    blocked_count_sq = db.query(Task.project_id, func.count().label("cnt")).filter(Task.status == "blocked").group_by(Task.project_id).subquery()
    rows = (db.query(Project, func.coalesce(task_count_sq.c.cnt, 0), func.coalesce(blocked_count_sq.c.cnt, 0))
            .outerjoin(task_count_sq, Project.id == task_count_sq.c.project_id)
            .outerjoin(blocked_count_sq, Project.id == blocked_count_sq.c.project_id)
            .order_by(Project.updated_at.desc())
            .offset((page - 1) * page_size).limit(page_size).all())
    items = [_project_to_item(p, tc, bc) for p, tc, bc in rows]
    return ProjectListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/projects/{project_id}", response_model=ProjectItem)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return _project_to_item(p)


@router.post("/projects", response_model=ProjectItem, status_code=201)
def create_project(body: CreateProjectRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    try:
        p = Project(id=str(uuid.uuid4()), code=body.code, name=body.name, description=body.description, status="active", created_at=now, updated_at=now)
        db.add(p)
        db.commit()
        db.refresh(p)
        return _project_to_item(p)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Project with this code already exists")


@router.put("/projects/{project_id}", response_model=ProjectItem)
def update_project(project_id: str, body: UpdateProjectRequest, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if body.name is not None: p.name = body.name
    if body.description is not None: p.description = body.description
    p.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(p)
    return _project_to_item(p)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    # P1-6: Cascade delete associated tasks
    task_count = db.query(Task).filter(Task.project_id == project_id).count()
    if task_count > 0:
        db.query(Task).filter(Task.project_id == project_id).delete()
    db.delete(p)
    db.commit()
    return None


# ── Tasks ───────────────────────────────────────────────────────────

@router.get("/tasks", response_model=TaskListResponse)
def list_tasks(
    project_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Task)
    if project_id:
        q = q.filter(Task.project_id == project_id)
    if status:
        q = q.filter(Task.status == status)
    if category:
        q = q.filter(Task.category == category)
    total = q.count()
    rows = q.order_by(Task.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    # P1-V2-2: Fix with_entities bug — batch load projects after fetching tasks
    project_ids = list(set(t.project_id for t in rows if t.project_id))
    projects = {p.id: p for p in db.query(Project).filter(Project.id.in_(project_ids)).all()} if project_ids else {}
    items = [_task_to_item(t, projects.get(t.project_id)) for t in rows]
    return TaskListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/tasks/{task_id}", response_model=TaskItem)
def get_task(task_id: str, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    return _task_to_item(t, db.query(Project).filter(Project.id == t.project_id).first())


@router.post("/tasks", response_model=TaskItem, status_code=201)
def create_task(body: CreateTaskRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    try:
        t = Task(
            id=str(uuid.uuid4()),
            project_id=body.project_id,
            title=body.title,
            description=body.description,
            category=body.category,
            priority=body.priority,
            status=body.status,
            phase=body.phase or "",
            owner_role=body.owner_role,
            created_at=now, updated_at=now,
        )
        db.add(t)
        db.commit()
        db.refresh(t)
        return _task_to_item(t, db.query(Project).filter(Project.id == t.project_id).first())
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Task creation failed")


@router.put("/tasks/{task_id}", response_model=TaskItem)
def update_task(task_id: str, body: UpdateTaskRequest, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(t, field):
            setattr(t, field, value)
    t.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(t)
    return _task_to_item(t, db.query(Project).filter(Project.id == t.project_id).first())


@router.patch("/tasks/{task_id}", response_model=TaskItem)
def patch_task(task_id: str, body: UpdateTaskRequest, db: Session = Depends(get_db)):
    """Partial update a task (e.g. change status only)."""
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if hasattr(t, field):
            setattr(t, field, value)
    t.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(t)
    return _task_to_item(t, db.query(Project).filter(Project.id == t.project_id).first())


@router.post("/tasks/{task_id}/transition")
def transition_task(task_id: str, body: dict, db: Session = Depends(get_db)):
    """Transition task status (for Kanban drag-and-drop)."""
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    new_status = body.get("status") or body.get("new_status")
    if not new_status:
        raise HTTPException(400, "Missing 'status' field")
    valid = [
        "planned", "approved", "in_progress", "review", "blocked",
        "completed", "done", "cancelled", "stopped",
    ]
    if new_status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")
    old_status = t.status
    t.status = new_status
    t.updated_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(t)
    return _task_to_item(t, db.query(Project).filter(Project.id == t.project_id).first())


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t)
    db.commit()
    return None
