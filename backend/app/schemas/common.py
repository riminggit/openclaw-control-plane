from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    env: str


class ReadyResponse(BaseModel):
    status: str
    checks: dict[str, str]
