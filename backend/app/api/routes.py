from fastapi import APIRouter, Depends, Query, Body, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db, Project, Task
from app.schemas.common import HealthResponse, ReadyResponse
from app.schemas.project import ProjectItem, ProjectListResponse
from app.schemas.task import TaskItem, TaskListResponse

router = APIRouter(prefix="/api")


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
        docSyncRisk=t.doc_sync_risk or "low",
        createdAt=str(t.created_at) if t.created_at else None,
        updatedAt=str(t.updated_at),
    )


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
            id=str(p.id), code=p.code, name=p.name, status=p.status,
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
    rows = q.order_by(Task.updated_at.desc()).all()
    items = []
    for t in rows:
        project = db.query(Project).filter(Project.id == t.project_id).first()
        items.append(_task_to_item(t, project))
    return TaskListResponse(items=items, total=len(items))


@router.get("/tasks/{task_id}", response_model=TaskItem)
def get_task(task_id: str, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    project = db.query(Project).filter(Project.id == t.project_id).first()
    return _task_to_item(t, project)


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
    return ProjectItem(id=str(p.id), code=p.code, name=p.name, status=p.status, ownerRole=p.owner_role or "", taskCount=0, blockedTaskCount=0, archiveFolderToken=p.archive_root_folder_token, updatedAt=str(p.updated_at))


@router.get("/projects/{project_id}", response_model=ProjectItem)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    task_count = db.query(Task).filter(Task.project_id == p.id).count()
    blocked_count = db.query(Task).filter(Task.project_id == p.id, Task.status == "blocked").count()
    return ProjectItem(id=str(p.id), code=p.code, name=p.name, status=p.status, ownerRole=p.owner_role or "", taskCount=task_count, blockedTaskCount=blocked_count, archiveFolderToken=p.archive_root_folder_token, updatedAt=str(p.updated_at))


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    db.delete(p)
    db.commit()


@router.post("/tasks", response_model=TaskItem, status_code=201)
def create_task(body: dict, db: Session = Depends(get_db)):
    import uuid, time
    now = time.strftime("%Y-%m-%dT%H:%M:%S")
    t = Task(
        id=str(uuid.uuid4()),
        project_id=body.get('project_id', body.get('projectId', '')),
        title=body.get('title', ''),
        description=body.get('description'),
        category=body.get('category', 'backend'),
        priority=body.get('priority', 'medium'),
        status=body.get('status', 'planned'),
        phase=body.get('phase', ''),
        owner_role=body.get('owner_role', body.get('ownerRole', '')),
        created_at=now,
        updated_at=now,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    project = db.query(Project).filter(Project.id == t.project_id).first()
    return _task_to_item(t, project)


@router.put("/tasks/{task_id}", response_model=TaskItem)
def update_task(task_id: str, body: dict = Body(default={}), db: Session = Depends(get_db)):
    import time
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    if 'title' in body: t.title = body['title']
    if 'description' in body: t.description = body['description']
    if 'status' in body: t.status = body['status']
    if 'priority' in body: t.priority = body['priority']
    if 'owner_role' in body or 'ownerRole' in body: t.owner_role = body.get('owner_role', body.get('ownerRole', ''))
    if 'category' in body: t.category = body['category']
    if 'phase' in body: t.phase = body['phase']
    t.updated_at = time.strftime("%Y-%m-%dT%H:%M:%S")
    db.commit()
    db.refresh(t)
    project = db.query(Project).filter(Project.id == t.project_id).first()
    return _task_to_item(t, project)


@router.post("/tasks/{task_id}/action", response_model=TaskItem)
def task_action(task_id: str, body: dict = Body(default={}), db: Session = Depends(get_db)):
    """Task workflow actions: reject, restart, complete, start_review"""
    import time
    action = body.get('action', '')
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")

    transitions = {
        'reject': ('planned', 'review → planned'),
        'restart': ('planned', 'any → planned'),
        'start': ('in_progress', 'planned → in_progress'),
        'complete': ('done', 'in_progress/review → done'),
        'block': ('blocked', 'any → blocked'),
        'review': ('review', 'in_progress → review'),
    }

    if action not in transitions:
        raise HTTPException(400, f"Invalid action: {action}. Valid: {', '.join(transitions.keys())}")

    new_status, _ = transitions[action]
    t.status = new_status
    t.updated_at = time.strftime("%Y-%m-%dT%H:%M:%S")
    db.commit()
    db.refresh(t)
    project = db.query(Project).filter(Project.id == t.project_id).first()
    return _task_to_item(t, project)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str, db: Session = Depends(get_db)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t)
    db.commit()
