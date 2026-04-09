"""Core Audit — Data models for decision logging.

Three tables:
  decisions        — full decision record with all layer contexts
  decision_audit   — immutable hash chain for traceability
  decision_outcomes — future feedback loop (loss/claim tracking)

Schema is PostgreSQL-compatible. Local dev uses SQLite.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class DecisionStatus(str, Enum):
    """Decision lifecycle status."""
    ACTIVE = "active"
    SUPERSEDED = "superseded"   # Replaced by a newer decision
    EXPIRED = "expired"         # Time-based expiry
    REVOKED = "revoked"         # Manually revoked


@dataclass
class DecisionRecord:
    """Persistent decision record — maps to `decisions` table."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_id: str = ""
    entity_label: str = ""
    portfolio_id: str | None = None
    sector: str = ""

    # Core decision
    decision: str = ""              # APPROVED / CONDITIONAL / REJECTED
    risk_score: float = 0.0
    risk_level: str = ""
    confidence: float = 0.0

    # Pricing & coverage
    pricing: dict[str, Any] = field(default_factory=dict)
    coverage: dict[str, Any] = field(default_factory=dict)
    conditions: list[str] = field(default_factory=list)

    # Layer contexts (JSONB)
    macro_context: dict[str, Any] = field(default_factory=dict)
    graph_context: dict[str, Any] = field(default_factory=dict)
    portfolio_context: dict[str, Any] | None = None
    underwriting_context: dict[str, Any] = field(default_factory=dict)

    # Explainability
    explanation: list[str] = field(default_factory=list)
    decision_summary: str = ""

    # Input parameters
    input_params: dict[str, Any] = field(default_factory=dict)

    # Model versions
    model_versions: dict[str, str] = field(default_factory=dict)

    # Metadata
    status: DecisionStatus = DecisionStatus.ACTIVE
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    timing_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "entity_id": self.entity_id,
            "entity_label": self.entity_label,
            "portfolio_id": self.portfolio_id,
            "sector": self.sector,
            "decision": self.decision,
            "risk_score": round(self.risk_score, 6),
            "risk_level": self.risk_level,
            "confidence": round(self.confidence, 4),
            "pricing": self.pricing,
            "coverage": self.coverage,
            "conditions": self.conditions,
            "macro_context": self.macro_context,
            "graph_context": self.graph_context,
            "portfolio_context": self.portfolio_context,
            "underwriting_context": self.underwriting_context,
            "explanation": self.explanation,
            "decision_summary": self.decision_summary,
            "input_params": self.input_params,
            "model_versions": self.model_versions,
            "status": self.status.value,
            "created_at": self.created_at,
            "timing_ms": self.timing_ms,
        }


@dataclass
class AuditRecord:
    """Immutable audit trail — maps to `decision_audit` table.

    Hash chain ensures no decision record can be tampered with.
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    decision_id: str = ""

    # Layer-specific hashes (from each engine)
    macro_hash: str = ""
    graph_hash: str = ""
    underwriting_hash: str = ""
    unified_hash: str = ""

    # Input/output integrity
    input_hash: str = ""
    output_hash: str = ""

    # Chain hash (links to previous audit record)
    previous_hash: str = ""
    chain_hash: str = ""

    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "decision_id": self.decision_id,
            "macro_hash": self.macro_hash,
            "graph_hash": self.graph_hash,
            "underwriting_hash": self.underwriting_hash,
            "unified_hash": self.unified_hash,
            "input_hash": self.input_hash,
            "output_hash": self.output_hash,
            "previous_hash": self.previous_hash,
            "chain_hash": self.chain_hash,
            "created_at": self.created_at,
        }

    @staticmethod
    def compute_chain_hash(
        decision_id: str,
        input_hash: str,
        output_hash: str,
        previous_hash: str,
    ) -> str:
        """Compute chain hash linking this audit to the previous one."""
        payload = json.dumps({
            "decision_id": decision_id,
            "input_hash": input_hash,
            "output_hash": output_hash,
            "previous_hash": previous_hash,
        }, sort_keys=True)
        return hashlib.sha256(payload.encode()).hexdigest()


@dataclass
class OutcomeRecord:
    """Decision outcome tracking — maps to `decision_outcomes` table.

    Used for feedback loops: did the decision prove correct?
    """
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    decision_id: str = ""
    outcome: str = ""               # LOSS / NO_LOSS / CLAIM / PARTIAL_LOSS
    severity: float = 0.0           # 0–1
    actual_loss_amount: float = 0.0
    notes: str = ""
    observed_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "decision_id": self.decision_id,
            "outcome": self.outcome,
            "severity": round(self.severity, 6),
            "actual_loss_amount": round(self.actual_loss_amount, 2),
            "notes": self.notes,
            "observed_at": self.observed_at,
        }
