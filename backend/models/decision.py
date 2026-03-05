from typing import Any

from pydantic import BaseModel, Field


class DecisionResponse(BaseModel):
    id: str | None = None
    topic: str
    additional_details: str | None = None
    documents: list[dict[str, str]] = Field(default_factory=list)
    analysis: dict[str, Any]
    web_context: dict[str, Any] | None = None
    debate: dict[str, Any]
    judge: dict[str, Any]
    summary: dict[str, Any]
    saved: bool
    timestamp: str
