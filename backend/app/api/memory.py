"""Phase 5: Memory browser API — list, read, write, delete, search, export."""

import os, zipfile, io, tempfile
from pathlib import Path
from datetime import datetime, timezone
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

router = APIRouter(prefix="/api/memory")

WORKSPACE = Path.home() / ".openclaw" / "workspace"


def _safe_path(base: Path, user_path: str) -> Path:
    """Resolve and validate path is within base directory."""
    resolved = (base / user_path).resolve()
    if not str(resolved).startswith(str(base.resolve())):
        raise HTTPException(403, "Path traversal not allowed")
    return resolved


# ── Schemas ──

class FileWrite(BaseModel):
    path: str
    content: str


# ── Endpoints ──

@router.get("/files")
def list_files(agent: str = Query("main"), category: str = Query("memory")):
    """List memory files for an agent."""
    base = WORKSPACE / category
    if not base.exists():
        return {"files": [], "base": str(base)}
    files = []
    for f in sorted(base.rglob("*")):
        if f.is_file() and not f.name.startswith("."):
            rel = f.relative_to(base)
            stat = f.stat()
            files.append({
                "name": f.name,
                "path": str(rel),
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })
    return {"files": files, "base": str(base)}


@router.get("/file")
def read_file(path: str = Query(...)):
    """Read a file's content from workspace."""
    resolved = _safe_path(WORKSPACE, path)
    if not resolved.exists():
        raise HTTPException(404, "File not found")
    if not resolved.is_file():
        raise HTTPException(400, "Not a file")
    try:
        content = resolved.read_text(errors="replace")
    except Exception as e:
        raise HTTPException(500, str(e))
    return {"path": path, "content": content, "size_bytes": len(content)}


@router.post("/file")
def write_file(body: FileWrite):
    """Create or overwrite a file in workspace."""
    resolved = _safe_path(WORKSPACE, body.path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    try:
        resolved.write_text(body.content, ensure_ascii=False)
        return {"ok": True, "path": body.path, "size_bytes": len(body.content)}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/file")
def delete_file(path: str = Query(...)):
    """Delete a file from workspace."""
    resolved = _safe_path(WORKSPACE, path)
    if not resolved.exists():
        raise HTTPException(404, "File not found")
    if not resolved.is_file():
        raise HTTPException(400, "Not a file")
    try:
        resolved.unlink()
        return {"ok": True, "path": path}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/search")
def search_memory(q: str = Query(..., min_length=1), agent: str = Query("main")):
    """Search file content in workspace."""
    results = []
    query_lower = q.lower()
    for f in WORKSPACE.rglob("*"):
        if not f.is_file() or f.name.startswith(".") or f.suffix in (".pyc", ".db", ".sqlite"):
            continue
        try:
            text = f.read_text(errors="replace")
            if query_lower in text.lower():
                rel = f.relative_to(WORKSPACE)
                lines = []
                for i, line in enumerate(text.splitlines(), 1):
                    if query_lower in line.lower():
                        lines.append({"line": i, "text": line.strip()[:200]})
                        if len(lines) >= 10:
                            break
                results.append({
                    "path": str(rel),
                    "matches": len([l for l in text.splitlines() if query_lower in l.lower()]),
                    "preview_lines": lines,
                })
        except Exception:
            continue
        if len(results) >= 50:
            break
    return {"query": q, "total": len(results), "results": results}


@router.post("/export")
def export_memory(category: str = Query("memory")):
    """Export workspace files as a zip."""
    base = WORKSPACE / category
    if not base.exists():
        raise HTTPException(404, f"Category '{category}' not found")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in base.rglob("*"):
            if f.is_file() and not f.name.startswith("."):
                rel = f.relative_to(base)
                zf.write(f, str(rel))
    buf.seek(0)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=memory-{category}-{ts}.zip"},
    )
