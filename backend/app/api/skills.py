"""Phase 5: Skill management API — list, install, uninstall, update, search."""

import os, subprocess, json
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/skills")

SKILL_DIRS = [
    Path.home() / ".openclaw" / "skills",
    Path.home() / ".openclaw" / "workspace" / "skills",
]

# Also check pnpm global
_pnpm_base = Path.home() / ".local" / "share" / "pnpm" / "global"


def _scan_skill_dirs():
    """Scan all known skill directories."""
    skills = []
    seen = set()
    for d in SKILL_DIRS:
        if not d.exists():
            continue
        for item in sorted(d.iterdir()):
            if item.is_dir() and item.name not in seen and (item / "SKILL.md").exists():
                seen.add(item.name)
                try:
                    md = (item / "SKILL.md").read_text(errors="ignore")
                    first_line = md.split("\n")[0].lstrip("# ").strip()[:120]
                except Exception:
                    first_line = ""
                skills.append({"name": item.name, "path": str(item), "description": first_line})
    return skills


# ── Schemas ──

class SkillInstall(BaseModel):
    name: str
    source: str | None = None


# ── Endpoints ──

@router.get("/list")
def list_skills():
    """Simple list of installed skill names."""
    skills = _scan_skill_dirs()
    return {"skills": [{"name": s["name"]} for s in skills]}


@router.get("/installed")
def list_installed():
    """Installed skills with details."""
    return {"skills": _scan_skill_dirs()}


@router.post("/install")
def install_skill(body: SkillInstall):
    cmd = ["clawhub", "install", body.name]
    if body.source:
        cmd = ["openclaw", "skills", "install", body.name, body.source]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            raise HTTPException(400, f"Install failed: {r.stderr.strip() or r.stdout.strip()}")
        return {"ok": True, "name": body.name, "output": r.stdout.strip()}
    except FileNotFoundError:
        raise HTTPException(400, "clawhub or openclaw CLI not found")
    except subprocess.TimeoutExpired:
        raise HTTPException(408, "Install timed out (60s)")


@router.post("/uninstall/{name}")
def uninstall_skill(name: str):
    cmd = ["clawhub", "uninstall", name]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            raise HTTPException(400, f"Uninstall failed: {r.stderr.strip() or r.stdout.strip()}")
        return {"ok": True, "name": name}
    except FileNotFoundError:
        raise HTTPException(400, "clawhub CLI not found")


@router.post("/update/{name}")
def update_skill(name: str):
    cmd = ["clawhub", "update", name]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if r.returncode != 0:
            raise HTTPException(400, f"Update failed: {r.stderr.strip() or r.stdout.strip()}")
        return {"ok": True, "name": name, "output": r.stdout.strip()}
    except FileNotFoundError:
        raise HTTPException(400, "clawhub CLI not found")


@router.get("/search")
def search_skills(q: str = Query(..., min_length=1)):
    cmd = ["clawhub", "search", q]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        return {"query": q, "results": r.stdout.strip(), "ok": r.returncode == 0}
    except FileNotFoundError:
        raise HTTPException(400, "clawhub CLI not found")
