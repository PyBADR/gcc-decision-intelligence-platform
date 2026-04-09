"""Impact Observatory | مرصد الأثر — Underwriting Intelligence Service.

Orchestration layer over the Underwriting Engine.
Enriches results with entity metadata from GraphRepository.
"""

from __future__ import annotations

from typing import Any

from src.graph_brain.storage import get_repository, GraphRepository
from src.graph_brain.decision.underwriting_engine import (
    evaluate_underwriting,
    UnderwritingResult,
)
from src.risk_models import _infer_sector, classify_risk


def run_underwriting(
    entity_id: str,
    sector: str | None = None,
    requested_coverage: float = 1_000_000.0,
    portfolio_id: str | None = None,
    portfolio_entities: list[str] | None = None,
    historical_signals: list[dict[str, Any]] | None = None,
    depth: int = 3,
    repo: GraphRepository | None = None,
) -> dict[str, Any]:
    """Run underwriting evaluation with enriched metadata.

    Args:
        entity_id: Target entity ID.
        sector: Business sector (auto-inferred if not provided).
        requested_coverage: Requested coverage amount.
        portfolio_id: Optional preset portfolio name.
        portfolio_entities: Optional explicit portfolio entity list.
        historical_signals: Optional historical signal data.
        depth: BFS propagation depth.
        repo: Optional GraphRepository override.

    Returns:
        Enriched UnderwritingResult as dict.
    """
    if repo is None:
        repo = get_repository()

    # Auto-infer sector from graph if not provided
    if not sector:
        sector = _infer_sector(entity_id)

    result: UnderwritingResult = evaluate_underwriting(
        entity_id=entity_id,
        sector=sector,
        requested_coverage=requested_coverage,
        portfolio_id=portfolio_id,
        portfolio_entities=portfolio_entities,
        historical_signals=historical_signals,
        depth=depth,
        repo=repo,
    )

    # ── Enrich entity metadata ─────────────────────────────────────────
    node = repo.get_node(entity_id)
    entity_label = node.properties.get("label", entity_id) if node else entity_id
    entity_label_ar = node.properties.get("label_ar", "") if node else ""
    entity_layer = node.type if node else "unknown"
    entity_found = node is not None

    # Risk level classification
    risk_level = classify_risk(result.risk_score)

    # ── Decision summary ───────────────────────────────────────────────
    decision_summary = _build_decision_summary(result, entity_label)

    # ── Build enriched response ────────────────────────────────────────
    response = {
        "entity_id": result.entity_id,
        "entity_label": entity_label,
        "entity_label_ar": entity_label_ar,
        "entity_layer": entity_layer,
        "entity_found": entity_found,
        "risk_score": round(result.risk_score, 6),
        "risk_level": risk_level,
        "decision": result.decision,
        "decision_summary": decision_summary,
        "pricing": {
            "adjustment": result.pricing_adjustment,
            "factor": round(result.pricing_factor, 4),
            "premium_impact": f"+{result.pricing_factor * 100:.1f}%",
        },
        "coverage": {
            "requested": result.requested_coverage,
            "approved_limit": result.coverage_limit,
            "utilization": round(
                result.coverage_limit / max(result.requested_coverage, 1) * 100, 1
            ),
        },
        "conditions": result.conditions,
        "reasoning": result.reasoning,
        "confidence": round(result.confidence, 4),
        "sector": result.sector,
        "entity_risk_detail": result.entity_risk_detail,
        "portfolio_context": result.portfolio_context,
        "audit_hash": result.audit_hash,
        "parameters": {
            "depth": depth,
            "portfolio_id": portfolio_id,
            "has_signals": bool(historical_signals),
            "signal_count": len(historical_signals) if historical_signals else 0,
        },
    }

    return response


def run_batch_underwriting(
    entities: list[dict[str, Any]],
    depth: int = 3,
    repo: GraphRepository | None = None,
) -> dict[str, Any]:
    """Run underwriting evaluation for multiple entities.

    Args:
        entities: List of dicts with entity_id, sector, requested_coverage, etc.
        depth: BFS propagation depth.
        repo: Optional GraphRepository override.

    Returns:
        Batch result with individual evaluations and summary.
    """
    if repo is None:
        repo = get_repository()

    results: list[dict[str, Any]] = []
    decisions_count = {"APPROVED": 0, "CONDITIONAL": 0, "REJECTED": 0}
    total_requested = 0.0
    total_approved = 0.0

    for entry in entities:
        eid = entry.get("entity_id", "")
        if not eid:
            continue

        result = run_underwriting(
            entity_id=eid,
            sector=entry.get("sector"),
            requested_coverage=float(entry.get("requested_coverage", 1_000_000)),
            portfolio_id=entry.get("portfolio_id"),
            portfolio_entities=entry.get("portfolio_entities"),
            historical_signals=entry.get("historical_signals"),
            depth=depth,
            repo=repo,
        )

        results.append(result)
        decisions_count[result["decision"]] += 1
        total_requested += result["coverage"]["requested"]
        total_approved += result["coverage"]["approved_limit"]

    # Summary
    approval_rate = (
        (decisions_count["APPROVED"] / len(results) * 100) if results else 0.0
    )

    return {
        "batch_size": len(results),
        "summary": {
            "approved": decisions_count["APPROVED"],
            "conditional": decisions_count["CONDITIONAL"],
            "rejected": decisions_count["REJECTED"],
            "approval_rate": round(approval_rate, 1),
            "total_requested_coverage": round(total_requested, 2),
            "total_approved_coverage": round(total_approved, 2),
            "coverage_ratio": round(
                total_approved / max(total_requested, 1) * 100, 1
            ),
        },
        "evaluations": results,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_decision_summary(
    result: UnderwritingResult,
    entity_label: str,
) -> str:
    """Build a human-readable decision summary."""
    if result.decision == "APPROVED":
        return (
            f"{entity_label} — APPROVED at {result.pricing_adjustment}. "
            f"Full coverage of {result.requested_coverage:,.2f} granted. "
            f"Confidence: {result.confidence:.0%}."
        )
    elif result.decision == "CONDITIONAL":
        return (
            f"{entity_label} — CONDITIONAL APPROVAL at {result.pricing_adjustment}. "
            f"Coverage limited to {result.coverage_limit:,.2f} "
            f"({result.coverage_limit / max(result.requested_coverage, 1) * 100:.0f}% of requested). "
            f"{len(result.conditions)} condition(s) apply. "
            f"Confidence: {result.confidence:.0%}."
        )
    else:
        return (
            f"{entity_label} — REJECTED. Risk score {result.risk_score:.4f} "
            f"exceeds acceptable threshold. "
            f"{len(result.conditions)} remediation requirement(s). "
            f"Confidence: {result.confidence:.0%}."
        )
