"""Audit API — Decision governance and traceability endpoints.

GET  /api/v1/audit/decisions                — List logged decisions
GET  /api/v1/audit/decisions/{id}           — Get decision detail
GET  /api/v1/audit/decisions/{id}/trail     — Get audit trail (hash chain)
GET  /api/v1/audit/decisions/{id}/outcomes  — Get decision outcomes
POST /api/v1/audit/outcomes                 — Record decision outcome
PUT  /api/v1/audit/decisions/{id}/status    — Update decision status
GET  /api/v1/audit/statistics               — Aggregate statistics
GET  /api/v1/audit/chain/verify             — Verify audit chain integrity
GET  /api/v1/audit/health                   — Audit system health
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from src.core.audit.repository import get_audit_repository
from src.core.audit.models import DecisionStatus
from src.api.v1.audit.schemas import OutcomeRequest, StatusUpdateRequest

router = APIRouter(prefix="/audit", tags=["audit-governance"])


# ---------------------------------------------------------------------------
# Decision queries
# ---------------------------------------------------------------------------

@router.get(
    "/decisions",
    summary="List logged decisions",
    description="Paginated list of all logged decisions with optional filters.",
)
async def list_decisions(
    entity_id: str | None = Query(default=None),
    sector: str | None = Query(default=None),
    decision: str | None = Query(default=None, description="APPROVED/CONDITIONAL/REJECTED"),
    status: str | None = Query(default=None, description="active/superseded/expired/revoked"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List decisions with optional filters."""
    repo = get_audit_repository()
    records = repo.list_decisions(
        entity_id=entity_id,
        sector=sector,
        decision=decision,
        status=status,
        limit=limit,
        offset=offset,
    )
    total = repo.count_decisions(entity_id=entity_id, decision=decision)
    return {
        "total": total,
        "count": len(records),
        "offset": offset,
        "limit": limit,
        "decisions": [r.to_dict() for r in records],
    }


@router.get(
    "/decisions/{decision_id}",
    summary="Get decision detail",
    description="Full decision record with all layer contexts.",
)
async def get_decision(decision_id: str):
    """Get a specific decision by ID."""
    repo = get_audit_repository()
    record = repo.get_decision(decision_id)
    if not record:
        return {"error": f"Decision '{decision_id}' not found"}
    return record.to_dict()


@router.get(
    "/decisions/{decision_id}/trail",
    summary="Get audit trail",
    description="Immutable hash chain for a decision — proves no tampering.",
)
async def get_audit_trail(decision_id: str):
    """Get the audit trail for a decision."""
    repo = get_audit_repository()
    decision = repo.get_decision(decision_id)
    if not decision:
        return {"error": f"Decision '{decision_id}' not found"}

    trail = repo.get_audit_trail(decision_id)
    return {
        "decision_id": decision_id,
        "entity_id": decision.entity_id,
        "decision": decision.decision,
        "audit_records": [r.to_dict() for r in trail],
        "chain_length": len(trail),
    }


@router.get(
    "/decisions/{decision_id}/outcomes",
    summary="Get decision outcomes",
    description="Feedback loop — what actually happened after the decision.",
)
async def get_outcomes(decision_id: str):
    """Get outcomes recorded for a decision."""
    repo = get_audit_repository()
    outcomes = repo.get_outcomes(decision_id)
    return {
        "decision_id": decision_id,
        "outcomes": [o.to_dict() for o in outcomes],
        "count": len(outcomes),
    }


# ---------------------------------------------------------------------------
# Outcome recording
# ---------------------------------------------------------------------------

@router.post(
    "/outcomes",
    summary="Record decision outcome",
    description=(
        "Record what actually happened after a decision was made. "
        "Feeds the feedback loop for model improvement."
    ),
)
async def record_outcome(body: OutcomeRequest):
    """Record an outcome for a logged decision."""
    repo = get_audit_repository()

    # Verify decision exists
    decision = repo.get_decision(body.decision_id)
    if not decision:
        return {"error": f"Decision '{body.decision_id}' not found"}

    from src.core.audit.logger import get_decision_logger
    dl = get_decision_logger()
    outcome_id = dl.log_outcome(
        decision_id=body.decision_id,
        outcome=body.outcome,
        severity=body.severity,
        actual_loss_amount=body.actual_loss_amount,
        notes=body.notes,
    )

    return {
        "outcome_id": outcome_id,
        "decision_id": body.decision_id,
        "outcome": body.outcome,
        "recorded": True,
    }


# ---------------------------------------------------------------------------
# Status management
# ---------------------------------------------------------------------------

@router.put(
    "/decisions/{decision_id}/status",
    summary="Update decision status",
    description="Change decision lifecycle status (active/superseded/expired/revoked).",
)
async def update_status(decision_id: str, body: StatusUpdateRequest):
    """Update the status of a decision."""
    repo = get_audit_repository()

    try:
        new_status = DecisionStatus(body.status)
    except ValueError:
        return {
            "error": f"Invalid status '{body.status}'",
            "valid": [s.value for s in DecisionStatus],
        }

    success = repo.update_status(decision_id, new_status)
    if not success:
        return {"error": f"Decision '{decision_id}' not found"}

    return {
        "decision_id": decision_id,
        "status": new_status.value,
        "updated": True,
    }


# ---------------------------------------------------------------------------
# Chain integrity & statistics
# ---------------------------------------------------------------------------

@router.get(
    "/chain/verify",
    summary="Verify audit chain integrity",
    description=(
        "Validates the entire audit hash chain to detect any tampering. "
        "Returns valid=true if all chain links are intact."
    ),
)
async def verify_chain():
    """Verify the integrity of the audit hash chain."""
    repo = get_audit_repository()
    return repo.verify_chain_integrity()


@router.get(
    "/statistics",
    summary="Decision statistics",
    description="Aggregate analytics across all logged decisions.",
)
async def get_statistics():
    """Get aggregate decision statistics."""
    repo = get_audit_repository()
    return repo.get_statistics()


@router.get(
    "/health",
    summary="Audit system health",
    description="Health check for the audit/governance system.",
)
async def audit_health():
    """Audit system health check."""
    repo = get_audit_repository()
    stats = repo.get_statistics()
    chain = repo.verify_chain_integrity()

    return {
        "status": "healthy" if chain["valid"] else "integrity_warning",
        "total_decisions": stats["total_decisions"],
        "total_audit_records": stats["total_audit_records"],
        "chain_valid": chain["valid"],
        "chain_breaks": len(chain["breaks"]),
        "db_path": repo._db_path,
    }
