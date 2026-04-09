"""Audit API — Request/Response Schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OutcomeRequest(BaseModel):
    """Record a decision outcome for feedback loop."""
    decision_id: str = Field(..., description="Decision UUID to attach outcome to")
    outcome: str = Field(
        ...,
        description="Outcome type: LOSS / NO_LOSS / CLAIM / PARTIAL_LOSS",
        json_schema_extra={"example": "NO_LOSS"},
    )
    severity: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Outcome severity 0–1",
    )
    actual_loss_amount: float = Field(
        default=0.0,
        ge=0.0,
        description="Actual loss amount if applicable",
    )
    notes: str = Field(
        default="",
        description="Free-text notes on the outcome",
    )


class StatusUpdateRequest(BaseModel):
    """Update a decision's lifecycle status."""
    status: str = Field(
        ...,
        description="New status: active / superseded / expired / revoked",
        json_schema_extra={"example": "superseded"},
    )
