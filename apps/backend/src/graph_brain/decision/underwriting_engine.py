"""Impact Observatory | مرصد الأثر — Underwriting Intelligence Engine.

Transforms portfolio risk, graph insights, and signal data into
actionable underwriting decisions with risk-based pricing.

Pipeline:
    Entity risk retrieval
    → Portfolio context (optional)
    → Risk scoring fusion
    → Decision logic
    → Pricing adjustment
    → Condition generation
    → Explainability

Uses GraphRepository, RiskPropagationEngine, and PortfolioRiskEngine.
Deterministic. Includes audit hash.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Optional

from src.graph_brain.storage import get_repository, GraphRepository
from src.graph_brain.decision.risk_propagation_engine import (
    propagate_risk,
    PropagationResult,
)
from src.graph_brain.decision.portfolio_risk_engine import (
    analyze_portfolio,
    PortfolioRiskResult,
)
from src.risk_models import _infer_sector


# ---------------------------------------------------------------------------
# Constants — Decision thresholds & weights
# ---------------------------------------------------------------------------

# Fusion weights (must sum to 1.0)
W_ENTITY: float = 0.40      # Entity-level propagated risk
W_PORTFOLIO: float = 0.25   # Portfolio exposure context
W_SECTOR: float = 0.20      # Sector systemic risk
W_HOTSPOT: float = 0.15     # Systemic hotspot overlap

# Decision boundaries
THRESHOLD_APPROVE: float = 0.30
THRESHOLD_CONDITIONAL: float = 0.60
# Above 0.60 → Rejected / High Risk

# Pricing tiers (risk_score → premium adjustment)
PRICING_TIERS: list[tuple[float, float, float, str]] = [
    # (max_score, min_adj, max_adj, label)
    (0.15, 0.00, 0.02, "Preferred — minimal loading"),
    (0.30, 0.02, 0.05, "Standard — base rate"),
    (0.45, 0.05, 0.12, "Moderate — risk loading applied"),
    (0.60, 0.12, 0.20, "Elevated — significant loading"),
    (0.80, 0.20, 0.35, "High — surcharge applied"),
    (1.00, 0.35, 0.50, "Severe — maximum loading"),
]

# Sector risk multipliers (some sectors carry higher base risk)
SECTOR_RISK_MULTIPLIERS: dict[str, float] = {
    "energy": 1.25,
    "maritime": 1.20,
    "insurance": 1.10,
    "banking": 1.05,
    "infrastructure": 1.15,
    "logistics": 1.10,
    "fintech": 1.00,
    "government": 0.90,
}


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class UnderwritingResult:
    """Complete underwriting evaluation result."""
    entity_id: str
    risk_score: float                   # Fused score 0–1
    decision: str                       # APPROVED | CONDITIONAL | REJECTED
    pricing_adjustment: str             # Human-readable pricing
    pricing_factor: float               # Numeric factor (e.g. 0.12 = +12%)
    conditions: list[str]               # Required conditions (if not approved)
    reasoning: list[str]                # Explainability chain
    confidence: float                   # Decision confidence 0–1
    coverage_limit: float               # Recommended max coverage
    requested_coverage: float           # Original request
    sector: str
    entity_risk_detail: dict[str, Any]  # Raw entity risk breakdown
    portfolio_context: dict[str, Any] | None  # Portfolio context if available
    audit_hash: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "risk_score": round(self.risk_score, 6),
            "decision": self.decision,
            "pricing_adjustment": self.pricing_adjustment,
            "pricing_factor": round(self.pricing_factor, 4),
            "conditions": self.conditions,
            "reasoning": self.reasoning,
            "confidence": round(self.confidence, 4),
            "coverage_limit": round(self.coverage_limit, 2),
            "requested_coverage": self.requested_coverage,
            "sector": self.sector,
            "entity_risk_detail": self.entity_risk_detail,
            "portfolio_context": self.portfolio_context,
            "audit_hash": self.audit_hash,
        }


# ---------------------------------------------------------------------------
# Core engine
# ---------------------------------------------------------------------------

def evaluate_underwriting(
    entity_id: str,
    sector: str,
    requested_coverage: float,
    portfolio_id: str | None = None,
    portfolio_entities: list[str] | None = None,
    historical_signals: list[dict[str, Any]] | None = None,
    depth: int = 3,
    repo: GraphRepository | None = None,
) -> UnderwritingResult:
    """Evaluate underwriting decision for an entity.

    Args:
        entity_id: Target entity ID in the knowledge graph.
        sector: Business sector of the entity.
        requested_coverage: Requested coverage amount.
        portfolio_id: Optional preset portfolio name.
        portfolio_entities: Optional explicit portfolio entity list.
        historical_signals: Optional list of historical signal dicts.
        depth: BFS propagation depth.
        repo: Optional GraphRepository override.

    Returns:
        UnderwritingResult with decision, pricing, conditions, and reasoning.
    """
    if repo is None:
        repo = get_repository()

    reasoning: list[str] = []
    conditions: list[str] = []

    # ── Step 1: Entity Risk Retrieval ──────────────────────────────────
    prop_result: PropagationResult = propagate_risk(
        entity_id=entity_id,
        depth=depth,
        min_risk_threshold=0.01,
        max_nodes=50,
        repo=repo,
    )

    # Normalize entity risk to 0–1 range
    # total_system_risk is unbounded; cap at 10.0 for normalization
    entity_risk_raw = prop_result.total_system_risk
    entity_risk_norm = min(entity_risk_raw / 10.0, 1.0)

    entity_risk_detail = {
        "total_system_risk": round(entity_risk_raw, 6),
        "normalized": round(entity_risk_norm, 6),
        "impacted_count": len(prop_result.impacted_nodes),
        "max_chain": round(prop_result.max_chain, 6),
        "critical_paths": prop_result.critical_paths,
    }

    reasoning.append(
        f"Entity '{entity_id}' propagation: total_system_risk={entity_risk_raw:.4f}, "
        f"impacted_nodes={len(prop_result.impacted_nodes)}, "
        f"max_chain={prop_result.max_chain:.4f}"
    )

    # ── Step 2: Portfolio Context ──────────────────────────────────────
    portfolio_risk_norm: float = 0.0
    portfolio_context: dict[str, Any] | None = None

    # Resolve portfolio entities
    resolved_entities = _resolve_portfolio(portfolio_id, portfolio_entities)

    if resolved_entities:
        port_result: PortfolioRiskResult = analyze_portfolio(
            portfolio_entities=resolved_entities,
            depth=depth,
            repo=repo,
        )

        # Normalize portfolio risk (avg_risk capped at 10)
        portfolio_risk_norm = min(port_result.average_risk_score / 10.0, 1.0)

        portfolio_context = {
            "portfolio_entities": port_result.portfolio_entities,
            "total_risk_score": round(port_result.total_risk_score, 6),
            "average_risk_score": round(port_result.average_risk_score, 6),
            "concentration_risk": round(port_result.concentration_risk, 6),
            "hhi_index": round(port_result.hhi_index, 6),
            "systemic_hotspots": port_result.systemic_hotspots[:5],
        }

        reasoning.append(
            f"Portfolio context: {len(resolved_entities)} entities, "
            f"avg_risk={port_result.average_risk_score:.4f}, "
            f"concentration={port_result.concentration_risk:.4f}, "
            f"HHI={port_result.hhi_index:.4f}"
        )

        # Check if entity is in portfolio hotspots
        hotspot_overlap = entity_id in port_result.systemic_hotspots
        if hotspot_overlap:
            reasoning.append(
                f"WARNING: '{entity_id}' is a systemic hotspot in the portfolio"
            )
    else:
        reasoning.append("No portfolio context — entity evaluated standalone")

    # ── Step 3: Risk Scoring Fusion ────────────────────────────────────
    # Sector risk
    sector_multiplier = SECTOR_RISK_MULTIPLIERS.get(
        sector.lower(), 1.0
    )
    sector_risk = entity_risk_norm * sector_multiplier
    sector_risk = min(sector_risk, 1.0)

    reasoning.append(
        f"Sector '{sector}' multiplier: {sector_multiplier}x "
        f"→ sector_risk={sector_risk:.4f}"
    )

    # Hotspot overlap score
    hotspot_score = _compute_hotspot_overlap(
        entity_id, prop_result, resolved_entities, repo
    )

    # Historical signal adjustment
    signal_adjustment = _compute_signal_adjustment(historical_signals)
    if signal_adjustment != 0.0:
        reasoning.append(
            f"Historical signals adjustment: {signal_adjustment:+.4f} "
            f"({len(historical_signals or [])} signals)"
        )

    # Weighted fusion
    fused_score = (
        W_ENTITY * entity_risk_norm
        + W_PORTFOLIO * portfolio_risk_norm
        + W_SECTOR * sector_risk
        + W_HOTSPOT * hotspot_score
        + signal_adjustment
    )
    fused_score = max(0.0, min(fused_score, 1.0))

    reasoning.append(
        f"Fused risk score: {fused_score:.4f} "
        f"(entity={entity_risk_norm:.3f}×{W_ENTITY}, "
        f"portfolio={portfolio_risk_norm:.3f}×{W_PORTFOLIO}, "
        f"sector={sector_risk:.3f}×{W_SECTOR}, "
        f"hotspot={hotspot_score:.3f}×{W_HOTSPOT}"
        f"{f', signal_adj={signal_adjustment:+.3f}' if signal_adjustment else ''})"
    )

    # ── Step 4: Decision Logic ─────────────────────────────────────────
    if fused_score < THRESHOLD_APPROVE:
        decision = "APPROVED"
        reasoning.append(
            f"Decision: APPROVED (score {fused_score:.4f} < {THRESHOLD_APPROVE})"
        )
    elif fused_score <= THRESHOLD_CONDITIONAL:
        decision = "CONDITIONAL"
        reasoning.append(
            f"Decision: CONDITIONAL (score {fused_score:.4f} "
            f"in [{THRESHOLD_APPROVE}, {THRESHOLD_CONDITIONAL}])"
        )
    else:
        decision = "REJECTED"
        reasoning.append(
            f"Decision: REJECTED (score {fused_score:.4f} > {THRESHOLD_CONDITIONAL})"
        )

    # ── Step 5: Pricing Adjustment ─────────────────────────────────────
    pricing_factor, pricing_label = _compute_pricing(fused_score)
    pricing_adjustment = (
        f"+{pricing_factor * 100:.1f}% — {pricing_label}"
    )

    reasoning.append(f"Pricing: {pricing_adjustment}")

    # ── Step 6: Conditions ─────────────────────────────────────────────
    conditions = _generate_conditions(
        decision=decision,
        fused_score=fused_score,
        entity_risk_norm=entity_risk_norm,
        portfolio_context=portfolio_context,
        requested_coverage=requested_coverage,
        sector=sector,
    )

    if conditions:
        reasoning.append(f"Conditions imposed: {len(conditions)}")

    # ── Step 7: Coverage limit ─────────────────────────────────────────
    coverage_limit = _compute_coverage_limit(
        requested_coverage, fused_score, decision
    )

    if coverage_limit < requested_coverage:
        reasoning.append(
            f"Coverage capped: requested={requested_coverage:,.2f}, "
            f"limit={coverage_limit:,.2f} "
            f"(reduction={((1 - coverage_limit / requested_coverage) * 100):.1f}%)"
        )

    # ── Confidence ─────────────────────────────────────────────────────
    confidence = _compute_confidence(
        prop_result=prop_result,
        has_portfolio=portfolio_context is not None,
        has_signals=bool(historical_signals),
    )

    # ── Audit hash ─────────────────────────────────────────────────────
    audit_hash = _compute_audit_hash(
        entity_id, fused_score, decision, pricing_adjustment
    )

    return UnderwritingResult(
        entity_id=entity_id,
        risk_score=fused_score,
        decision=decision,
        pricing_adjustment=pricing_adjustment,
        pricing_factor=pricing_factor,
        conditions=conditions,
        reasoning=reasoning,
        confidence=confidence,
        coverage_limit=coverage_limit,
        requested_coverage=requested_coverage,
        sector=sector,
        entity_risk_detail=entity_risk_detail,
        portfolio_context=portfolio_context,
        audit_hash=audit_hash,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _resolve_portfolio(
    portfolio_id: str | None,
    portfolio_entities: list[str] | None,
) -> list[str]:
    """Resolve portfolio entities from preset ID or explicit list."""
    if portfolio_entities:
        return portfolio_entities

    if portfolio_id:
        # Import presets from API layer
        from src.api.v1.portfolio import PRESETS
        return PRESETS.get(portfolio_id, [])

    return []


def _compute_hotspot_overlap(
    entity_id: str,
    prop_result: PropagationResult,
    portfolio_entities: list[str],
    repo: GraphRepository,
) -> float:
    """Compute overlap between entity's impacted nodes and portfolio entities.

    Returns a 0–1 score. Higher = more overlap with portfolio risk surface.
    """
    if not portfolio_entities:
        return 0.0

    impacted_ids = {nr.node_id for nr in prop_result.impacted_nodes}
    portfolio_set = set(portfolio_entities)

    # How many portfolio entities are in the entity's blast radius?
    overlap = impacted_ids & portfolio_set
    if not portfolio_set:
        return 0.0

    return len(overlap) / len(portfolio_set)


def _compute_signal_adjustment(
    signals: list[dict[str, Any]] | None,
) -> float:
    """Compute risk adjustment from historical signals.

    Positive signals (low severity) reduce risk, negative signals increase it.
    Returns adjustment in [-0.10, +0.10] range.
    """
    if not signals:
        return 0.0

    total_severity = 0.0
    count = 0
    for sig in signals:
        sev = sig.get("severity", 0.5)
        if isinstance(sev, (int, float)) and 0.0 <= sev <= 1.0:
            total_severity += sev
            count += 1

    if count == 0:
        return 0.0

    avg_severity = total_severity / count
    # Center at 0.5: below = risk reduction, above = risk increase
    # Scale to ±0.10
    adjustment = (avg_severity - 0.5) * 0.20
    return max(-0.10, min(adjustment, 0.10))


def _compute_pricing(risk_score: float) -> tuple[float, str]:
    """Map risk score to pricing factor and label.

    Returns:
        (pricing_factor, label) where factor is 0.0–0.50
    """
    for max_score, min_adj, max_adj, label in PRICING_TIERS:
        if risk_score <= max_score:
            # Linear interpolation within tier
            prev_max = 0.0
            for ps, _, _, _ in PRICING_TIERS:
                if ps < max_score:
                    prev_max = ps
                else:
                    break
            tier_progress = (
                (risk_score - prev_max) / (max_score - prev_max)
                if max_score > prev_max else 0.0
            )
            factor = min_adj + tier_progress * (max_adj - min_adj)
            return round(factor, 4), label

    # Fallback — maximum loading
    return 0.50, "Severe — maximum loading"


def _generate_conditions(
    decision: str,
    fused_score: float,
    entity_risk_norm: float,
    portfolio_context: dict[str, Any] | None,
    requested_coverage: float,
    sector: str,
) -> list[str]:
    """Generate underwriting conditions based on risk assessment."""
    conditions: list[str] = []

    if decision == "APPROVED":
        # Clean approval — minimal conditions
        if fused_score > 0.20:
            conditions.append("Standard annual review required")
        return conditions

    # ── CONDITIONAL or REJECTED conditions ─────────────────────────────

    # High entity risk
    if entity_risk_norm > 0.50:
        conditions.append(
            f"Reduce single-entity exposure — entity risk ({entity_risk_norm:.2f}) "
            f"exceeds threshold"
        )

    # Concentration
    if portfolio_context and portfolio_context.get("concentration_risk", 0) > 0.40:
        conditions.append(
            "Portfolio concentration too high — diversification required "
            f"(concentration={portfolio_context['concentration_risk']:.2f})"
        )

    # Sector-specific
    if sector.lower() in ("energy", "maritime"):
        conditions.append(
            f"Sector '{sector}' requires catastrophe reinsurance coverage"
        )

    # Coverage limits
    if decision == "CONDITIONAL" and fused_score > 0.45:
        conditions.append(
            "Increase deductible to minimum 15% of coverage amount"
        )
        conditions.append(
            "Coverage limited to 70% of requested amount pending review"
        )

    if decision == "REJECTED":
        conditions.append("Application declined — resubmit after risk remediation")
        conditions.append("Mandatory risk assessment and mitigation plan required")
        if entity_risk_norm > 0.70:
            conditions.append(
                "Third-party risk audit required before reconsideration"
            )

    # Systemic hotspot exposure
    if portfolio_context and len(portfolio_context.get("systemic_hotspots", [])) >= 3:
        conditions.append(
            f"Systemic exposure detected across "
            f"{len(portfolio_context['systemic_hotspots'])} shared hotspots — "
            f"limit aggregate exposure"
        )

    # Quarterly review for conditional approvals
    if decision == "CONDITIONAL":
        conditions.append("Quarterly risk monitoring and review mandated")

    return conditions


def _compute_coverage_limit(
    requested: float,
    risk_score: float,
    decision: str,
) -> float:
    """Compute recommended maximum coverage based on risk.

    Approved: full coverage
    Conditional: reduced proportionally (50–90% of requested)
    Rejected: 0
    """
    if decision == "APPROVED":
        return requested

    if decision == "REJECTED":
        return 0.0

    # CONDITIONAL — scale between 50% and 90%
    # Higher risk → lower coverage
    # risk 0.30 → 90%, risk 0.60 → 50%
    ratio = 0.90 - (risk_score - THRESHOLD_APPROVE) / (
        THRESHOLD_CONDITIONAL - THRESHOLD_APPROVE
    ) * 0.40
    ratio = max(0.50, min(ratio, 0.90))
    return round(requested * ratio, 2)


def _compute_confidence(
    prop_result: PropagationResult,
    has_portfolio: bool,
    has_signals: bool,
) -> float:
    """Compute confidence in the underwriting decision.

    More data sources = higher confidence.
    More impacted nodes in propagation = more informed.
    """
    base = 0.50  # Minimum confidence (we always have entity risk)

    # Graph depth bonus
    impacted = len(prop_result.impacted_nodes)
    if impacted >= 10:
        base += 0.15
    elif impacted >= 5:
        base += 0.10
    elif impacted >= 2:
        base += 0.05

    # Portfolio context bonus
    if has_portfolio:
        base += 0.15

    # Signal data bonus
    if has_signals:
        base += 0.10

    # Critical path bonus
    if prop_result.critical_paths:
        base += 0.05

    return min(base, 0.95)


def _compute_audit_hash(
    entity_id: str,
    risk_score: float,
    decision: str,
    pricing_adjustment: str,
) -> str:
    """Compute SHA-256 audit hash for traceability."""
    payload = json.dumps({
        "entity_id": entity_id,
        "risk_score": round(risk_score, 6),
        "decision": decision,
        "pricing_adjustment": pricing_adjustment,
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
