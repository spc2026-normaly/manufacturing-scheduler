from datetime import datetime

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    database: str
    version: str


class ErrorResponse(BaseModel):
    detail: str
