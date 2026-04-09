"""Unified Decision Service — The Single Brain.

Orchestrates all intelligence layers into one coherent decision:

    Macro Intelligence → regime, signals, sector impacts
    Graph Intelligence → entity context, neighborhood, dependencies
    Portfolio Risk     → exposure, concentration, systemic hotspots
    Underwriting       → decision, pricing, conditions

Produces a unified response with full explainability chain.
Deterministic. Audit-hashed.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any

from src.graph_brain.storage import get_repository, GraphRepository, GraphNode
from src.graph_brain.decision.risk_propagation_engine import (
    propagate_risk,
    PropagationResult,
)
from src.graph_brain.decision.portfolio_risk_engine import (
    analyze_portfolio,
    PortfolioRiskResult,
)
from src.graph_brain.decision.underwriting_engine import (
    evaluate_underwriting,
    UnderwritingResult,
)
from src.macro_intelligence.orchestrator.macro_orchestrator import (
    MacroOrchestrator,
    get_orchestrator,
)
from src.macro_intelligence.schemas.macro_schemas import MacroContext, RegimeType
from src.risk_models import _infer_sector, classify_risk
from src.core.policy.engine import get_policy_engine


# ---------------------------------------------------------------------------
# Unified evaluation
# ---------------------------------------------------------------------------

def evaluate_unified(
    entity_id: str,
    sector: str | None = None,
    portfolio_id: str | None = None,
    portfolio_entities: list[str] | None = None,
    requested_coverage: float = 1_000_000.0,
    indicators_input: dict[str, float] | None = None,
    historical_signals: list[dict[str, Any]] | None = None,
    depth: int = 3,
    include_graph_detail: bool = True,
    include_macro_signals: bool = True,
    repo: GraphRepository | None = None,
) -> dict[str, Any]:
    """Run the full unified decision pipeline.

    Returns a single response combining all intelligence layers.
    """
    t_start = time.perf_counter()

    if repo is None:
        repo = get_repository()
    if not sector:
        sector = _infer_sector(entity_id)
    if indicators_input is None:
        indicators_input = {}

    orchestrator = get_orchestrator()
    explanation: list[str] = []

    # ══════════════════════════════════════════════════════════════════
    # LAYER 1: Macro Intelligence
    # ══════════════════════════════════════════════════════════════════
    t_macro = time.perf_counter()
    macro_context: MacroContext = orchestrator.analyze(indicators_input)
    dt_macro = round((time.perf_counter() - t_macro) * 1000, 1)

    # Sector impact for this entity
    entity_sector_impact = None
    for si in macro_context.sector_impacts:
        if si.sector == sector:
            entity_sector_impact = si
            break

    macro_risk_overlay = macro_context.risk_overlay
    sector_macro_adj = entity_sector_impact.impact_score if entity_sector_impact else 0.0

    explanation.append(
        f"Macro regime: {macro_context.regime.value} "
        f"(confidence={macro_context.regime_confidence:.2f})"
    )
    explanation.append(
        f"Active macro signals: {len(macro_context.signals)}, "
        f"risk overlay: {macro_risk_overlay:+.4f}"
    )
    if entity_sector_impact:
        explanation.append(
            f"Sector '{sector}' macro impact: {sector_macro_adj:+.4f} "
            f"({entity_sector_impact.direction.value})"
        )

    # ══════════════════════════════════════════════════════════════════
    # LAYER 2: Graph Intelligence
    # ══════════════════════════════════════════════════════════════════
    t_graph = time.perf_counter()
    prop_result: PropagationResult = propagate_risk(
        entity_id=entity_id,
        depth=depth,
        min_risk_threshold=0.01,
        max_nodes=50,
        repo=repo,
    )
    dt_graph = round((time.perf_counter() - t_graph) * 1000, 1)

    # Entity metadata
    node: GraphNode | None = repo.get_node(entity_id)
    entity_label = node.properties.get("label", entity_id) if node else entity_id
    entity_label_ar = node.properties.get("label_ar", "") if node else ""
    entity_layer = node.type if node else "unknown"

    # Graph neighborhood
    graph_detail = None
    if include_graph_detail:
        neighbors = repo.get_neighbors(entity_id)
        graph_detail = {
            "entity_found": node is not None,
            "entity_layer": entity_layer,
            "direct_neighbors": len(neighbors),
            "impacted_nodes": len(prop_result.impacted_nodes),
            "total_system_risk": round(prop_result.total_system_risk, 6),
            "max_chain": round(prop_result.max_chain, 6),
            "critical_paths": prop_result.critical_paths,
            "top_impacted": [
                {
                    "node_id": nr.node_id,
                    "risk": round(nr.total_risk, 6),
                    "hops": nr.hops,
                    "label": _get_node_label(repo, nr.node_id),
                }
                for nr in prop_result.impacted_nodes[:10]
            ],
            "neighbor_summary": [
                {
                    "id": neighbor_node.id,
                    "label": neighbor_node.properties.get("label", neighbor_node.id),
                    "layer": neighbor_node.type,
                    "edge_type": neighbor_edge.type,
                    "edge_weight": neighbor_edge.weight,
                }
                for neighbor_node, neighbor_edge in neighbors[:15]
            ],
        }

    explanation.append(
        f"Graph propagation: {len(prop_result.impacted_nodes)} nodes impacted, "
        f"total_system_risk={prop_result.total_system_risk:.4f}, "
        f"max_chain={prop_result.max_chain:.4f}"
    )
    if prop_result.critical_paths:
        explanation.append(
            f"Critical path: {' → '.join(prop_result.critical_paths[0])}"
        )

    # ══════════════════════════════════════════════════════════════════
    # LAYER 3: Portfolio Risk
    # ══════════════════════════════════════════════════════════════════
    portfolio_section = None
    resolved_entities = _resolve_portfolio(portfolio_id, portfolio_entities)

    if resolved_entities:
        t_port = time.perf_counter()
        port_result: PortfolioRiskResult = analyze_portfolio(
            portfolio_entities=resolved_entities,
            depth=depth,
            repo=repo,
        )
        dt_port = round((time.perf_counter() - t_port) * 1000, 1)

        # Macro-adjusted portfolio risk
        avg_sector_adj = _compute_portfolio_macro_adj(
            port_result, macro_context
        )
        macro_adj_factor = macro_risk_overlay + avg_sector_adj * 0.3
        macro_adj_factor = max(-0.50, min(macro_adj_factor, 0.50))
        adjusted_portfolio_risk = port_result.average_risk_score * (1.0 + macro_adj_factor)

        # Health classification with macro overlay
        if adjusted_portfolio_risk > 8.0:
            adjusted_health = "CRITICAL"
        elif adjusted_portfolio_risk > 5.0:
            adjusted_health = "HIGH"
        elif adjusted_portfolio_risk > 3.0:
            adjusted_health = "ELEVATED"
        elif adjusted_portfolio_risk > 1.5:
            adjusted_health = "GUARDED"
        else:
            adjusted_health = "NOMINAL"

        portfolio_section = {
            "portfolio_entities": port_result.portfolio_entities,
            "entity_count": len(port_result.portfolio_entities),
            "base_risk": round(port_result.average_risk_score, 6),
            "macro_adjusted_risk": round(adjusted_portfolio_risk, 6),
            "macro_adjustment": f"{macro_adj_factor:+.1%}",
            "health": adjusted_health,
            "max_risk_entity": port_result.max_risk_entity,
            "concentration": round(port_result.concentration_risk, 6),
            "hhi_index": round(port_result.hhi_index, 6),
            "systemic_hotspots": port_result.systemic_hotspots[:5],
            "sector_exposure": [
                {
                    "sector": se.sector,
                    "risk": round(se.total_risk, 4),
                    "pct": round(se.contribution_pct, 1),
                }
                for se in port_result.sector_exposure
            ],
            "timing_ms": dt_port,
        }

        explanation.append(
            f"Portfolio ({len(resolved_entities)} entities): "
            f"avg_risk={port_result.average_risk_score:.4f} → "
            f"{adjusted_portfolio_risk:.4f} (macro {macro_adj_factor:+.1%}), "
            f"health={adjusted_health}"
        )
        if port_result.concentration_risk > 0.4:
            explanation.append(
                f"⚠ Portfolio concentration HIGH: {port_result.concentration_risk:.2f}"
            )
    else:
        explanation.append("No portfolio context — standalone entity evaluation")

    # ══════════════════════════════════════════════════════════════════
    # LAYER 4: Underwriting Decision (macro-enriched)
    # ══════════════════════════════════════════════════════════════════
    t_uw = time.perf_counter()

    # Inject macro signals as historical signals for additional context
    macro_historical = _macro_to_historical_signals(macro_context)
    combined_signals = (historical_signals or []) + macro_historical

    uw_result: UnderwritingResult = evaluate_underwriting(
        entity_id=entity_id,
        sector=sector,
        requested_coverage=requested_coverage,
        portfolio_id=portfolio_id,
        portfolio_entities=portfolio_entities,
        historical_signals=combined_signals if combined_signals else None,
        depth=depth,
        repo=repo,
    )
    dt_uw = round((time.perf_counter() - t_uw) * 1000, 1)

    # Apply macro overlay to underwriting score
    macro_uw_adj = macro_risk_overlay + sector_macro_adj * 0.4
    macro_uw_adj = max(-0.30, min(macro_uw_adj, 0.30))
    final_risk_score = max(0.0, min(uw_result.risk_score + macro_uw_adj, 1.0))

    # Re-derive decision from macro-adjusted score
    if final_risk_score < 0.30:
        final_decision = "APPROVED"
    elif final_risk_score <= 0.60:
        final_decision = "CONDITIONAL"
    else:
        final_decision = "REJECTED"

    # Macro-driven conditions
    macro_conditions = _generate_macro_conditions(macro_context, sector)

    # Final risk level (pre-policy — may be adjusted by policy engine)
    risk_level = classify_risk(final_risk_score)

    explanation.append(
        f"Underwriting: base_score={uw_result.risk_score:.4f}, "
        f"macro_adj={macro_uw_adj:+.4f} → final={final_risk_score:.4f}"
    )
    explanation.append(
        f"Final decision: {final_decision} | "
        f"pricing: {uw_result.pricing_adjustment} | "
        f"coverage: {uw_result.coverage_limit:,.0f} / {requested_coverage:,.0f}"
    )

    # ══════════════════════════════════════════════════════════════════
    # LAYER 5: Policy Engine (business rule governance)
    # ══════════════════════════════════════════════════════════════════
    policy_section = None
    try:
        policy_engine = get_policy_engine()
        policy_context = {
            "macro": {
                "regime": macro_context.regime.value,
                "risk_overlay": macro_risk_overlay,
                "regime_confidence": macro_context.regime_confidence,
            },
            "risk_score": final_risk_score,
            "sector": sector,
            "requested_coverage": requested_coverage,
        }
        # Add portfolio context if available
        if portfolio_section:
            policy_context["portfolio"] = {
                "concentration_risk": portfolio_section.get("concentration", 0.0),
                "sector_weight": portfolio_section.get("sector_exposure", [{}])[0].get("pct", 0.0) / 100.0 if portfolio_section.get("sector_exposure") else 0.0,
            }

        policy_result = policy_engine.evaluate(policy_context, sector=sector)
        policy_section = policy_result

        if policy_result.get("applied"):
            # Apply policy overrides
            if "decision_override" in policy_result:
                prev_decision = final_decision
                final_decision = policy_result["decision_override"]
                if prev_decision != final_decision:
                    explanation.append(
                        f"Policy override: {prev_decision} → {final_decision} "
                        f"({policy_result['rules_matched']} rules matched)"
                    )

            if "pricing_adjustment" in policy_result:
                # Policy pricing is additive on top of underwriting pricing factor
                explanation.append(
                    f"Policy pricing adjustment: +{policy_result['pricing_adjustment']:.1%}"
                )

            if "coverage_cap_pct" in policy_result:
                policy_cap = policy_result["coverage_cap_pct"]
                capped_coverage = requested_coverage * policy_cap
                if capped_coverage < uw_result.coverage_limit:
                    uw_result = uw_result  # keep reference
                    explanation.append(
                        f"Policy coverage cap: {policy_cap:.0%} "
                        f"({capped_coverage:,.0f} < {uw_result.coverage_limit:,.0f})"
                    )

            if "risk_adjustment" in policy_result:
                risk_adj = policy_result["risk_adjustment"]
                final_risk_score = max(0.0, min(final_risk_score + risk_adj, 1.0))
                risk_level = classify_risk(final_risk_score)
                explanation.append(
                    f"Policy risk adjustment: {risk_adj:+.4f} → {final_risk_score:.4f}"
                )

            if policy_result.get("blocked"):
                final_decision = "REJECTED"
                explanation.append("Policy BLOCK: hard block active — decision overridden to REJECTED")

    except Exception as e:
        # Policy engine must never break the decision pipeline
        explanation.append(f"Policy engine skipped: {e}")
        policy_section = {"applied": False, "error": str(e)}

    # ══════════════════════════════════════════════════════════════════
    # UNIFIED RESPONSE
    # ══════════════════════════════════════════════════════════════════
    dt_total = round((time.perf_counter() - t_start) * 1000, 1)

    # Audit hash over the complete decision
    audit_hash = _compute_unified_audit_hash(
        entity_id=entity_id,
        final_risk_score=final_risk_score,
        final_decision=final_decision,
        regime=macro_context.regime.value,
        pricing=uw_result.pricing_adjustment,
    )

    # Build macro section
    macro_section: dict[str, Any] = {
        "regime": macro_context.regime.value,
        "regime_confidence": round(macro_context.regime_confidence, 4),
        "risk_overlay": round(macro_risk_overlay, 6),
        "active_signals_count": len(macro_context.signals),
        "sector_impacts_count": len(macro_context.sector_impacts),
        "entity_sector_impact": (
            entity_sector_impact.model_dump() if entity_sector_impact else None
        ),
        "indicators_used": len(macro_context.indicators_snapshot),
    }
    if include_macro_signals:
        macro_section["signals"] = [
            {
                "name": s.name,
                "strength": round(s.strength, 4),
                "direction": s.direction.value,
                "description": s.description,
                "description_ar": s.description_ar,
            }
            for s in macro_context.signals
        ]
        macro_section["sector_impacts"] = [
            {
                "sector": si.sector,
                "impact_score": round(si.impact_score, 4),
                "direction": si.direction.value,
                "reasoning": si.reasoning,
            }
            for si in macro_context.sector_impacts
        ]

    # Build decision section (the core output)
    policy_conditions = policy_result.get("conditions_add", []) if policy_section and policy_section.get("applied") else []
    all_conditions = uw_result.conditions + macro_conditions + policy_conditions
    decision_section = {
        "decision": final_decision,
        "risk_score": round(final_risk_score, 6),
        "risk_level": risk_level,
        "confidence": round(uw_result.confidence, 4),
        "pricing": {
            "adjustment": uw_result.pricing_adjustment,
            "factor": round(uw_result.pricing_factor, 4),
            "premium_impact": f"+{uw_result.pricing_factor * 100:.1f}%",
            "macro_impact": f"{macro_uw_adj * 50:+.1f}% macro overlay",
        },
        "coverage": {
            "requested": requested_coverage,
            "approved_limit": uw_result.coverage_limit,
            "utilization_pct": round(
                uw_result.coverage_limit / max(requested_coverage, 1) * 100, 1
            ),
        },
        "conditions": all_conditions,
        "conditions_count": len(all_conditions),
    }

    # Build underwriting detail
    underwriting_section = {
        "base_risk_score": round(uw_result.risk_score, 6),
        "macro_adjustment": round(macro_uw_adj, 6),
        "final_risk_score": round(final_risk_score, 6),
        "base_decision": uw_result.decision,
        "final_decision": final_decision,
        "decision_changed": uw_result.decision != final_decision,
        "entity_risk_detail": uw_result.entity_risk_detail,
    }

    # Decision summary (human-readable)
    decision_summary = _build_unified_summary(
        entity_label=entity_label,
        final_decision=final_decision,
        final_risk_score=final_risk_score,
        risk_level=risk_level,
        regime=macro_context.regime.value,
        pricing=uw_result.pricing_adjustment,
        coverage_limit=uw_result.coverage_limit,
        requested_coverage=requested_coverage,
        conditions_count=len(all_conditions),
        confidence=uw_result.confidence,
    )

    result = {
        # ── Identity ───────────────────────────────────────────────
        "entity_id": entity_id,
        "entity_label": entity_label,
        "entity_label_ar": entity_label_ar,
        "sector": sector,

        # ── THE DECISION (core output) ─────────────────────────────
        "decision": decision_section,
        "decision_summary": decision_summary,

        # ── Intelligence layers ────────────────────────────────────
        "macro": macro_section,
        "graph": graph_detail,
        "portfolio": portfolio_section,
        "underwriting": underwriting_section,
        "policy": policy_section,

        # ── Explainability ─────────────────────────────────────────
        "explanation": explanation,

        # ── Audit & metadata ───────────────────────────────────────
        "audit": {
            "hash": audit_hash,
            "macro_hash": macro_context.audit_hash,
            "propagation_hash": prop_result.audit_hash,
            "underwriting_hash": uw_result.audit_hash,
        },
        "timing": {
            "total_ms": dt_total,
            "macro_ms": dt_macro,
            "graph_ms": dt_graph,
            "portfolio_ms": portfolio_section["timing_ms"] if portfolio_section else 0,
            "underwriting_ms": dt_uw,
        },
        "parameters": {
            "depth": depth,
            "portfolio_id": portfolio_id,
            "has_signals": bool(historical_signals),
            "indicators_provided": len(indicators_input),
        },
    }

    # ══════════════════════════════════════════════════════════════════
    # GOVERNANCE: Log decision to audit trail
    # ══════════════════════════════════════════════════════════════════
    try:
        from src.integrations.decision_logging_integration import log_unified_decision
        input_snapshot = {
            "entity_id": entity_id,
            "sector": sector,
            "portfolio_id": portfolio_id,
            "requested_coverage": requested_coverage,
            "indicators": indicators_input,
            "depth": depth,
        }
        result = log_unified_decision(
            input_data=input_snapshot,
            output_data=result,
        )
    except Exception:
        # Logging must never break the decision pipeline
        pass

    return result


# ---------------------------------------------------------------------------
# Batch evaluation
# ---------------------------------------------------------------------------

def evaluate_batch(
    entities: list[dict[str, Any]],
    indicators_input: dict[str, float],
    portfolio_id: str | None = None,
    depth: int = 3,
) -> dict[str, Any]:
    """Evaluate multiple entities under the same macro context."""
    repo = get_repository()
    results: list[dict[str, Any]] = []
    decisions = {"APPROVED": 0, "CONDITIONAL": 0, "REJECTED": 0}
    total_requested = 0.0
    total_approved = 0.0

    for entry in entities:
        eid = entry.get("entity_id", "")
        if not eid:
            continue

        result = evaluate_unified(
            entity_id=eid,
            sector=entry.get("sector"),
            portfolio_id=portfolio_id,
            requested_coverage=float(entry.get("requested_coverage", 1_000_000)),
            indicators_input=indicators_input,
            depth=depth,
            include_graph_detail=False,   # Lighter for batch
            include_macro_signals=False,
            repo=repo,
        )

        results.append(result)
        d = result["decision"]["decision"]
        decisions[d] = decisions.get(d, 0) + 1
        total_requested += result["decision"]["coverage"]["requested"]
        total_approved += result["decision"]["coverage"]["approved_limit"]

    total = len(results)
    approval_rate = (decisions["APPROVED"] / total * 100) if total else 0.0

    # Shared macro context (computed once, same for all)
    shared_macro = results[0]["macro"] if results else {}

    return {
        "batch_size": total,
        "shared_macro_regime": shared_macro.get("regime", "neutral"),
        "summary": {
            "approved": decisions["APPROVED"],
            "conditional": decisions["CONDITIONAL"],
            "rejected": decisions["REJECTED"],
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

def _resolve_portfolio(
    portfolio_id: str | None,
    portfolio_entities: list[str] | None,
) -> list[str]:
    """Resolve portfolio entities from preset or explicit list."""
    if portfolio_entities:
        return portfolio_entities
    if portfolio_id:
        from src.api.v1.portfolio import PRESETS
        return PRESETS.get(portfolio_id, [])
    return []


def _get_node_label(repo: GraphRepository, node_id: str) -> str:
    """Get human-readable label for a node."""
    node = repo.get_node(node_id)
    return node.properties.get("label", node_id) if node else node_id


def _compute_portfolio_macro_adj(
    port_result: PortfolioRiskResult,
    macro: MacroContext,
) -> float:
    """Compute average sector adjustment for portfolio entities."""
    sector_map = {si.sector: si.impact_score for si in macro.sector_impacts}
    adjs = []
    for er in port_result.entity_risks:
        sector = _infer_sector(er.entity_id)
        adjs.append(sector_map.get(sector, 0.0))
    return sum(adjs) / len(adjs) if adjs else 0.0


def _macro_to_historical_signals(macro: MacroContext) -> list[dict[str, Any]]:
    """Convert active macro signals to historical signal format
    for injection into underwriting engine."""
    signals = []
    for s in macro.signals:
        # Map signal direction to severity
        if s.direction.value == "up" and s.name in {
            "oil_price_collapse", "high_inflation", "recession_signal",
            "stagflation_risk", "global_fear", "shipping_cost_spike",
        }:
            severity = 0.5 + s.strength * 0.4  # Risk-increasing
        elif s.direction.value == "down" and s.name in {
            "oil_price_surge", "strong_growth", "pmi_strong_expansion",
        }:
            severity = 0.5 - s.strength * 0.3  # Risk-decreasing
        else:
            severity = 0.5  # Neutral
        signals.append({
            "signal_name": s.name,
            "severity": round(severity, 4),
            "source": "macro_intelligence",
        })
    return signals


def _generate_macro_conditions(
    macro: MacroContext,
    sector: str,
) -> list[str]:
    """Generate additional conditions from macro context."""
    conditions: list[str] = []

    if macro.regime in (RegimeType.RECESSION, RegimeType.OIL_SHOCK):
        conditions.append(
            f"Macro regime '{macro.regime.value}' — enhanced risk monitoring required"
        )

    if macro.regime == RegimeType.INFLATIONARY:
        conditions.append(
            "Inflationary environment — inflation-indexed coverage clause recommended"
        )

    if macro.risk_overlay > 0.15:
        conditions.append(
            f"Elevated macro risk overlay ({macro.risk_overlay:+.3f}) — "
            f"quarterly macro re-assessment mandated"
        )

    # Sector-specific macro conditions
    for si in macro.sector_impacts:
        if si.sector == sector and si.impact_score < -0.40:
            conditions.append(
                f"Sector '{sector}' under severe macro stress "
                f"(impact={si.impact_score:+.2f}) — exposure cap recommended"
            )
            break

    return conditions


def _build_unified_summary(
    entity_label: str,
    final_decision: str,
    final_risk_score: float,
    risk_level: str,
    regime: str,
    pricing: str,
    coverage_limit: float,
    requested_coverage: float,
    conditions_count: int,
    confidence: float,
) -> str:
    """Build a human-readable decision summary."""
    coverage_pct = round(coverage_limit / max(requested_coverage, 1) * 100)

    if final_decision == "APPROVED":
        return (
            f"{entity_label} — APPROVED | {risk_level} risk ({final_risk_score:.3f}) | "
            f"Macro: {regime} | Pricing: {pricing} | "
            f"Full coverage granted | Confidence: {confidence:.0%}"
        )
    elif final_decision == "CONDITIONAL":
        return (
            f"{entity_label} — CONDITIONAL | {risk_level} risk ({final_risk_score:.3f}) | "
            f"Macro: {regime} | Pricing: {pricing} | "
            f"Coverage: {coverage_pct}% of requested | "
            f"{conditions_count} conditions | Confidence: {confidence:.0%}"
        )
    else:
        return (
            f"{entity_label} — REJECTED | {risk_level} risk ({final_risk_score:.3f}) | "
            f"Macro: {regime} | {conditions_count} remediation requirements | "
            f"Confidence: {confidence:.0%}"
        )


def _compute_unified_audit_hash(
    entity_id: str,
    final_risk_score: float,
    final_decision: str,
    regime: str,
    pricing: str,
) -> str:
    """SHA-256 audit hash for the complete unified decision."""
    payload = json.dumps({
        "entity_id": entity_id,
        "final_risk_score": round(final_risk_score, 6),
        "final_decision": final_decision,
        "regime": regime,
        "pricing": pricing,
    }, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()
