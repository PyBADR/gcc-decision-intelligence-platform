"""Core Audit — Decision Logger.

Captures unified decision output and persists:
  1. DecisionRecord (full decision + contexts)
  2. AuditRecord (hash chain for immutable traceability)

Automatically called by the Unified Decision API.
Thread-safe singleton via get_decision_logger().
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
from typing import Any

from src.core.audit.models import DecisionRecord, AuditRecord, DecisionStatus
from src.core.audit.repository import AuditRepository, get_audit_repository

_instance: DecisionLogger | None = None
_lock = threading.Lock()

logger = logging.getLogger("observatory.audit")


class DecisionLogger:
    """Logs unified decision results with full audit trail.

    Converts raw decision API output into persistent records.
    Maintains a hash chain across all audit records.
    """

    MODEL_VERSION = "2.1.0"

    def __init__(self, repo: AuditRepository | None = None) -> None:
        self._repo = repo or get_audit_repository()

    def log_decision(
        self,
        input_data: dict[str, Any],
        output_data: dict[str, Any],
    ) -> dict[str, str]:
        """Log a unified decision evaluation.

        Args:
            input_data: Original request parameters.
            output_data: Full unified decision response.

        Returns:
            Dict with decision_id and audit_id.
        """
        try:
            # ── Build DecisionRecord ───────────────────────────────
            decision_section = output_data.get("decision", {})
            timing = output_data.get("timing", {})

            record = DecisionRecord(
                entity_id=output_data.get("entity_id", ""),
                entity_label=output_data.get("entity_label", ""),
                portfolio_id=input_data.get("portfolio_id"),
                sector=output_data.get("sector", ""),
                decision=decision_section.get("decision", ""),
                risk_score=decision_section.get("risk_score", 0.0),
                risk_level=decision_section.get("risk_level", ""),
                confidence=decision_section.get("confidence", 0.0),
                pricing=decision_section.get("pricing", {}),
                coverage=decision_section.get("coverage", {}),
                conditions=decision_section.get("conditions", []),
                macro_context=output_data.get("macro", {}),
                graph_context=output_data.get("graph") or {},
                portfolio_context=output_data.get("portfolio"),
                underwriting_context=output_data.get("underwriting", {}),
                explanation=output_data.get("explanation", []),
                decision_summary=output_data.get("decision_summary", ""),
                input_params=input_data,
                model_versions={
                    "engine": self.MODEL_VERSION,
                    "macro": "1.0.0",
                    "graph": "1.0.0",
                    "underwriting": "1.0.0",
                    "unified": "1.0.0",
                },
                status=DecisionStatus.ACTIVE,
                timing_ms=timing.get("total_ms", 0.0),
            )

            decision_id = self._repo.save_decision(record)

            # ── Build AuditRecord with hash chain ──────────────────
            input_hash = self._compute_hash(input_data)
            output_hash = self._compute_hash(output_data)

            audit_hashes = output_data.get("audit", {})
            previous_hash = self._repo.get_latest_chain_hash()

            chain_hash = AuditRecord.compute_chain_hash(
                decision_id=decision_id,
                input_hash=input_hash,
                output_hash=output_hash,
                previous_hash=previous_hash,
            )

            audit = AuditRecord(
                decision_id=decision_id,
                macro_hash=audit_hashes.get("macro_hash", ""),
                graph_hash=audit_hashes.get("propagation_hash", ""),
                underwriting_hash=audit_hashes.get("underwriting_hash", ""),
                unified_hash=audit_hashes.get("hash", ""),
                input_hash=input_hash,
                output_hash=output_hash,
                previous_hash=previous_hash,
                chain_hash=chain_hash,
            )

            audit_id = self._repo.save_audit(audit)

            logger.info(
                "DECISION_LOGGED",
                extra={
                    "decision_id": decision_id,
                    "audit_id": audit_id,
                    "entity_id": record.entity_id,
                    "decision": record.decision,
                    "risk_score": record.risk_score,
                    "chain_hash": chain_hash[:16],
                },
            )

            return {
                "decision_id": decision_id,
                "audit_id": audit_id,
                "chain_hash": chain_hash,
            }

        except Exception as e:
            # Logging must never break the decision pipeline
            logger.error(f"Decision logging failed: {e}", exc_info=True)
            return {
                "decision_id": "",
                "audit_id": "",
                "error": str(e),
            }

    def log_outcome(
        self,
        decision_id: str,
        outcome: str,
        severity: float = 0.0,
        actual_loss_amount: float = 0.0,
        notes: str = "",
    ) -> str:
        """Record the actual outcome of a decision.

        Returns outcome_id.
        """
        from src.core.audit.models import OutcomeRecord
        record = OutcomeRecord(
            decision_id=decision_id,
            outcome=outcome,
            severity=severity,
            actual_loss_amount=actual_loss_amount,
            notes=notes,
        )
        return self._repo.save_outcome(record)

    @staticmethod
    def _compute_hash(data: dict[str, Any]) -> str:
        """SHA-256 of JSON-serialized data."""
        # Filter out non-serializable and volatile fields
        clean = {k: v for k, v in data.items() if k not in ("timing",)}
        try:
            payload = json.dumps(clean, sort_keys=True, default=str)
        except (TypeError, ValueError):
            payload = str(clean)
        return hashlib.sha256(payload.encode()).hexdigest()


def get_decision_logger(repo: AuditRepository | None = None) -> DecisionLogger:
    """Singleton decision logger."""
    global _instance
    with _lock:
        if _instance is None:
            _instance = DecisionLogger(repo)
        return _instance
