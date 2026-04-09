"""Impact Observatory | مرصد الأثر — Macro Signal Schema.

Canonical data contract for macro intelligence signals entering the
Knowledge Graph. Supports 4 domain-specific payload types with a
discriminated union, plus a flexible extensions escape hatch.

Signal flow: POST /ingest/signal → validate → map → Neo4j MERGE
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.schemas.base import VersionedModel


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class SignalType(str, Enum):
    macroeconomic = "macroeconomic"
    insurance = "insurance"
    operational = "operational"
    geopolitical = "geopolitical"


class SignalSource(str, Enum):
    manual = "manual"
    feed = "feed"
    simulation = "simulation"
    connector = "connector"
    api = "api"


class ConfidenceTier(str, Enum):
    quarantine = "quarantine"    # < 0.30
    low = "low"                  # 0.30–0.69
    standard = "standard"        # >= 0.70


# ---------------------------------------------------------------------------
# Domain-specific payloads
# ---------------------------------------------------------------------------

class MacroPayload(BaseModel):
    """Macroeconomic signal payload (oil prices, FX, rates, GDP, etc.)."""
    domain: Literal["macroeconomic"] = "macroeconomic"
    indicator: str = Field(..., description="e.g. oil_price, gdp_growth, cpi")
    value: float
    change: float | None = None
    unit: str | None = None
    region: str | None = None


class InsurancePayload(BaseModel):
    """Insurance signal payload (claims, solvency, treaty triggers)."""
    domain: Literal["insurance"] = "insurance"
    line_of_business: str = Field(..., description="e.g. property, marine_cargo, energy")
    claims_count: int | None = None
    claims_value_usd: float | None = None
    loss_ratio: float | None = None
    cat_event_id: str | None = None


class OperationalPayload(BaseModel):
    """Operational disruption payload (port closures, route blocks)."""
    domain: Literal["operational"] = "operational"
    asset_type: str = Field(..., description="e.g. port, corridor, pipeline, airport")
    asset_id: str
    disruption_level: float = Field(..., ge=0, le=1)
    estimated_duration_hours: float | None = None


class GeopoliticalPayload(BaseModel):
    """Geopolitical signal payload (conflicts, sanctions, policy shifts)."""
    domain: Literal["geopolitical"] = "geopolitical"
    event_type: str = Field(..., description="e.g. conflict, sanction, treaty, election")
    actors: list[str] = Field(default_factory=list)
    severity: float = Field(..., ge=0, le=1)
    region: str


# Union of all payload types
SignalPayload = MacroPayload | InsurancePayload | OperationalPayload | GeopoliticalPayload


# ---------------------------------------------------------------------------
# Main schema
# ---------------------------------------------------------------------------

class MacroSignal(VersionedModel):
    """Canonical macro intelligence signal entering the Knowledge Graph.

    Every signal becomes a :Signal node in Neo4j, triggers an :Event node,
    and links via [:TRIGGERS] relationship. Low-confidence signals (< 0.30)
    are quarantined and never written to the KG.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": "signal-001",
                "type": "macroeconomic",
                "source": "manual",
                "event_time": "2026-04-09T20:00:00Z",
                "confidence": 0.85,
                "payload": {
                    "domain": "macroeconomic",
                    "indicator": "oil_price",
                    "value": 85.2,
                    "change": -2.1,
                },
            }
        }
    )

    # ── Identity ────────────────────────────────────────────────────────
    id: str = Field(..., min_length=1, description="Unique signal identifier")
    type: SignalType = Field(..., description="Signal domain type")
    source: SignalSource = Field(..., description="Origin of the signal")

    # ── Timestamps ──────────────────────────────────────────────────────
    event_time: datetime = Field(..., description="When the event actually happened (UTC)")
    ingested_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="When we received the signal (auto-set if omitted)",
    )

    # ── Quality ─────────────────────────────────────────────────────────
    confidence: float = Field(..., ge=0.0, le=1.0, description="Signal confidence [0–1]")

    # ── Payload ─────────────────────────────────────────────────────────
    payload: SignalPayload | dict[str, Any] = Field(
        ...,
        description="Domain-specific payload (typed) or flexible dict for rapid prototyping",
    )

    # ── Extensions ──────────────────────────────────────────────────────
    extensions: dict[str, Any] = Field(
        default_factory=dict,
        description="Escape hatch for new fields before promoting to typed payloads",
    )
    tags: list[str] = Field(default_factory=list, description="Free-form signal tags")

    # ── Computed ────────────────────────────────────────────────────────
    lineage_hash: str | None = Field(None, description="SHA-256 of id+type+event_time for audit")
    confidence_tier: ConfidenceTier | None = Field(None, description="Auto-computed from confidence")

    # ── Validators ──────────────────────────────────────────────────────

    @field_validator("confidence")
    @classmethod
    def confidence_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError(f"confidence must be 0–1, got {v}")
        return v

    @model_validator(mode="after")
    def compute_derived_fields(self) -> "MacroSignal":
        # Lineage hash
        raw = f"{self.id}|{self.type.value}|{self.event_time.isoformat()}"
        self.lineage_hash = hashlib.sha256(raw.encode()).hexdigest()

        # Confidence tier
        if self.confidence < 0.30:
            self.confidence_tier = ConfidenceTier.quarantine
        elif self.confidence < 0.70:
            self.confidence_tier = ConfidenceTier.low
        else:
            self.confidence_tier = ConfidenceTier.standard

        return self

    # ── Helpers ──────────────────────────────────────────────────────────

    @property
    def should_quarantine(self) -> bool:
        """Signals below 0.30 confidence are quarantined (never enter KG)."""
        return self.confidence_tier == ConfidenceTier.quarantine

    @property
    def event_id(self) -> str:
        """Derived Event node ID."""
        return f"{self.id}-event"


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class IngestResult(BaseModel):
    """Response from POST /ingest/signal."""
    signal_id: str
    event_id: str
    confidence_tier: ConfidenceTier
    quarantined: bool
    neo4j_written: bool
    lineage_hash: str
