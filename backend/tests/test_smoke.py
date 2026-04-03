"""Smoke tests for the Control Plane API."""
import os
import uuid
import pytest
from fastapi.testclient import TestClient

TEST_DB = "sqlite:///./test_control_plane.db"
os.environ["DATABASE_URL"] = TEST_DB

# Remove stale test DB to ensure clean slate
_db_path = TEST_DB.split("///")[-1]
if os.path.exists(_db_path):
    os.unlink(_db_path)

from app.main import app
from app.db import init_db, seed_db

init_db()
seed_db()

client = TestClient(app)


class TestHealth:
    def test_health(self):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_ready(self):
        r = client.get("/api/ready")
        assert r.status_code == 200
        assert r.json()["status"] == "ready"


class TestProjects:
    def test_list_projects(self):
        r = client.get("/api/projects")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_create_project(self):
        code = f"TST{uuid.uuid4().hex[:4].upper()}"
        r = client.post(
            "/api/projects",
            json={"name": "Test Proj", "code": code},
        )
        assert r.status_code == 201
        assert r.json()["code"] == code


class TestTasks:
    def test_list_tasks(self):
        r = client.get("/api/tasks")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_get_task(self):
        r = client.get("/api/tasks")
        tasks = r.json()["items"]
        if tasks:
            tid = tasks[0]["id"]
            r2 = client.get(f"/api/tasks/{tid}")
            assert r2.status_code == 200

    def test_get_task_404(self):
        r = client.get("/api/tasks/nonexistent")
        assert r.status_code == 404

    def test_create_task(self):
        r = client.post(
            "/api/tasks",
            json={
                "project_id": "proj-ocp-001",
                "title": "Smoke Task",
                "category": "test",
                "priority": "low",
            },
        )
        assert r.status_code == 201
        assert r.json()["title"] == "Smoke Task"

    def test_update_task(self):
        r = client.get("/api/tasks")
        tasks = r.json()["items"]
        if tasks:
            tid = tasks[0]["id"]
            r2 = client.put(f"/api/tasks/{tid}", json={"status": "done"})
            assert r2.status_code == 200
            assert r2.json()["status"] == "done"

    def test_delete_task(self):
        r = client.post(
            "/api/tasks",
            json={
                "project_id": "proj-ocp-001",
                "title": "To Delete",
                "category": "test",
                "priority": "low",
            },
        )
        assert r.status_code == 201
        tid = r.json()["id"]
        r2 = client.delete(f"/api/tasks/{tid}")
        assert r2.status_code == 204

    def test_filter_tasks_by_status(self):
        r = client.get("/api/tasks?status=done")
        assert r.status_code == 200
        for t in r.json()["items"]:
            assert t["status"] == "done"
