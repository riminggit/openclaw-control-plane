from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.orm import Session

from app.db import get_db, Project, Task
from app.schemas.common import HealthResponse, ReadyResponse
from app.schemas.project import ProjectItem, ProjectListResponse
from app.schemas.task import TaskItem, TaskListResponse

router = APIRouter(prefix="/api")


@router.get("/health", response_model=HealthResponse)
def health(db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
        storage = "ok"
    except Exception:
        storage = "error"
    from app.core.config import settings
    return HealthResponse(status="ok", service=settings.app_name, env=settings.app_env)


@router.get("/ready", response_model=ReadyResponse)
def ready(db: Session = Depends(get_db)):
    return ReadyResponse(status="ready", checks={"api": "ok", "storage": "db", "adapter": "pending"})


@router.get("/projects", response_model=ProjectListResponse)
def list_projects(db: Session = Depends(get_db)):
    rows = db.query(Project).all()
    items = []
    for p in rows:
        task_count = db.query(Task).filter(Task.project_id == p.id).count()
        blocked_count = db.query(Task).filter(Task.project_id == p.id, Task.status == "blocked").count()
        items.append(ProjectItem(
            id=p.id, code=p.code, name=p.name, status=p.status,
            ownerRole=p.owner_role or "", taskCount=task_count,
            blockedTaskCount=blocked_count,
            archiveFolderToken=p.archive_root_folder_token,
            updatedAt=str(p.updated_at),
        ))
    return ProjectListResponse(items=items, total=len(items))


@router.get("/tasks", response_model=TaskListResponse)
def list_tasks(project_id: str | None = Query(None), status: str | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(Task)
    if project_id:
        q = q.filter(Task.project_id == project_id)
    if status:
        q = q.filter(Task.status == status)
    rows = q.all()
    items = [
        TaskItem(
            id=t.id, title=t.title, projectId=t.project_id,
            category=t.category, phase=t.phase or "", priority=t.priority,
            status=t.status, ownerRole=t.owner_role or "",
            ownerAgentId=t.owner_agent_id, riskLevel=t.risk_level,
            docSyncRisk="high" if t.doc_sync_risk else "low",
            updatedAt=str(t.updated_at),
        )
        for t in rows
    ]
    return TaskListResponse(items=items, total=len(items))


@router.get("/tasks/{task_id}", response_model=TaskItem)
def get_task(task_id: str, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        from fastapi import HTTPException
        raise HTTPException(404, "Task not found")
    return TaskItem(
        id=t.id, title=t.title, projectId=t.project_id,
        category=t.category, phase=t.phase or "", priority=t.priority,
        status=t.status, ownerRole=t.owner_role or "",
        ownerAgentId=t.owner_agent_id, riskLevel=t.risk_level,
        docSyncRisk="high" if t.doc_sync_risk else "low",
        updatedAt=str(t.updated_at),
    )


@router.post("/projects", response_model=ProjectItem, status_code=201)
def create_project(body: dict, db: Session = Depends(get_db)):
    name = body.get('name', '')
    code = body.get('code', '')
    description = body.get('description')
    import uuid, time
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    p = Project(id=str(uuid.uuid4()), code=code, name=name, description=description, status="active", created_at=now, updated_at=now)
    db.add(p)
    db.commit()
    db.refresh(p)
    return ProjectItem(id=p.id, code=p.code, name=p.name, status=p.status, ownerRole=p.owner_role or "", taskCount=0, blockedTaskCount=0, archiveFolderToken=p.archive_root_folder_token, updatedAt=str(p.updated_at))


@router.get("/projects/{project_id}", response_model=ProjectItem)
def get_project(project_id: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    task_count = db.query(Task).filter(Task.project_id == p.id).count()
    blocked_count = db.query(Task).filter(Task.project_id == p.id, Task.status == "blocked").count()
    return ProjectItem(id=p.id, code=p.code, name=p.name, status=p.status, ownerRole=p.owner_role or "", taskCount=task_count, blockedTaskCount=blocked_count, archiveFolderToken=p.archive_root_folder_token, updatedAt=str(p.updated_at))


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    db.delete(p)
    db.commit()


@router.post("/tasks", response_model=TaskItem, status_code=201)
def create_task(body: dict, db: Session = Depends(get_db)):
    project_id = body.get('project_id', body.get('projectId', ''))
    title = body.get('title', '')
    category = body.get('category', 'backend')
    priority = body.get('priority', 'medium')
    status = body.get('status', 'planned')
    phase = body.get('phase', '')
    owner_role = body.get('owner_role', body.get('ownerRole', ''))
    import uuid, time
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    t = Task(id=str(uuid.uuid4()), project_id=project_id, title=title, category=category, priority=priority, status=status, phase=phase, owner_role=owner_role, created_at=now, updated_at=now)
    db.add(t)
    db.commit()
    db.refresh(t)
    return TaskItem(id=t.id, title=t.title, projectId=t.project_id, category=t.category, phase=t.phase or "", priority=t.priority, status=t.status, ownerRole=t.owner_role or "", ownerAgentId=t.owner_agent_id, riskLevel=t.risk_level, docSyncRisk="low", updatedAt=str(t.updated_at))


@router.put("/tasks/{task_id}", response_model=TaskItem)
def update_task(task_id: str, body: dict = Body(default={}), db: Session = Depends(get_db)):
    from fastapi import HTTPException
    import time
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    if 'title' in body: t.title = body['title']
    if 'status' in body: t.status = body['status']
    if 'priority' in body: t.priority = body['priority']
    if 'owner_role' in body or 'ownerRole' in body: t.owner_role = body.get('owner_role', body.get('ownerRole', ''))
    if 'category' in body: t.category = body['category']
    if 'phase' in body: t.phase = body['phase']
    t.updated_at = time.strftime("%Y-%m-%dT%H:%M:%S")
    db.commit()
    db.refresh(t)
    return TaskItem(id=t.id, title=t.title, projectId=t.project_id, category=t.category, phase=t.phase or "", priority=t.priority, status=t.status, ownerRole=t.owner_role or "", ownerAgentId=t.owner_agent_id, riskLevel=t.risk_level, docSyncRisk="high" if t.doc_sync_risk else "low", updatedAt=str(t.updated_at))


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t)
    db.commit()
