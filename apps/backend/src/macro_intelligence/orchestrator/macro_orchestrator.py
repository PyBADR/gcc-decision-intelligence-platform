"""Macro Intelligence — Orchestrator.

Central coordination layer that:
  1. Resolves indicators via DataProvider
  2. Generates signals via SignalEngine
  3. Classifies regime via RegimeDetector
  4. Maps sector impacts via SectorMappingEngine
  5. Produces MacroContext for downstream layers
  6. Generates portfolio and underwriting overlays

Integrates with:
  - GraphRepository (node/edge enrichment)
  - PortfolioRiskEngine (portfolio overlay)
  - UnderwritingEngine (underwriting overlay)

Singleton via get_orchestrator().
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from src.macro_intelligence.ingestion.macro_data_provider import (
    MacroDataProvider,
    get_data_provider,
)
from src.macro_intelligence.signals.signal_engine import SignalEngine
from src.macro_intelligence.regime.regime_detector import RegimeDetector
from src.macro_intelligence.mapping.sector_mapping import SectorMappingEngine
from src.macro_intelligence.schemas.macro_schemas import (
    MacroContext,
    MacroPortfolioOverlay,
    MacroUnderwritingOverlay,
    SectorImpact,
    RegimeType,
    compute_macro_audit_hash,
)

_instance: MacroOrchestrator | None = None


class MacroOrchestrator:
    """Central macro intelligence coordinator.

    Composes all sub-engines into a unified analysis pipeline.
    Stateless per-request — all state flows through indicators.
    """

    def __init__(
        self,
        data_provider: MacroDataProvider | None = None,
        signal_engine: SignalEngine | None = None,
        regime_detector: RegimeDetector | None = None,
        sector_mapper: SectorMappingEngine | None = None,
    ) -> None:
        self.data_provider = data_provider or get_data_provider()
        self.signal_engine = signal_engine or SignalEngine()
        self.regime_detector = regime_detector or RegimeDetector()
        self.sector_mapper = sector_mapper or SectorMappingEngine()

    # -------------------------------------------------------------------
    # Core analysis
    # -------------------------------------------------------------------

    def analyze(
        self,
        indicators_input: dict[str, float],
    ) -> MacroContext:
        """Run full macro analysis pipeline.

        Args:
            indicators_input: Partial or complete indicator dict.

        Returns:
            MacroContext with regime, signals, sector impacts, and risk overlay.
        """
        # Step 1: Resolve indicators (merge with baselines)
        indicators = self.data_provider.resolve_indicators(indicators_input)

        # Step 2: Generate signals
        signals = self.signal_engine.generate_signals(indicators)

        # Step 3: Classify regime
        regime_result = self.regime_detector.classify(indicators)

        # Step 4: Map to sector impacts
        sector_impacts = self.sector_mapper.map(signals, regime_result.regime)

        # Step 5: Compute aggregate risk overlay
        risk_overlay = self.signal_engine.compute_aggregate_risk_adjustment(signals)

        # Step 6: Audit hash
        audit_hash = compute_macro_audit_hash(
            regime=regime_result.regime.value,
            signals_count=len(signals),
            risk_overlay=risk_overlay,
            indicators=indicators,
        )

        return MacroContext(
            regime=regime_result.regime,
            regime_confidence=regime_result.confidence,
            signals=signals,
            sector_impacts=sector_impacts,
            indicators_snapshot=indicators,
            risk_overlay=risk_overlay,
            audit_hash=audit_hash,
        )

    # -------------------------------------------------------------------
    # Portfolio overlay
    # -------------------------------------------------------------------

    def portfolio_overlay(
        self,
        indicators_input: dict[str, float],
        portfolio_entities: list[str],
        depth: int = 3,
    ) -> dict[str, Any]:
        """Generate macro overlay for portfolio risk.

        Adjusts portfolio risk based on macro regime and sector impacts.
        """
        from src.graph_brain.storage import get_repository
        from src.graph_brain.decision.portfolio_risk_engine import analyze_portfolio
        from src.risk_models import _infer_sector

        # Macro analysis
        macro = self.analyze(indicators_input)
        repo = get_repository()

        # Portfolio analysis
        port_result = analyze_portfolio(
            portfolio_entities=portfolio_entities,
            depth=depth,
            repo=repo,
        )

        base_risk = port_result.average_risk_score

        # Build sector impact lookup
        sector_impact_map: dict[str, float] = {
            si.sector: si.impact_score for si in macro.sector_impacts
        }

        # Per-entity sector adjustments
        sector_adjustments: list[dict[str, Any]] = []
        total_sector_adj = 0.0

        for entity_risk in port_result.entity_risks:
            entity_sector = _infer_sector(entity_risk.entity_id)
            sector_adj = sector_impact_map.get(entity_sector, 0.0)

            sector_adjustments.append({
                "entity_id": entity_risk.entity_id,
                "sector": entity_sector,
                "base_risk": round(entity_risk.total_system_risk, 6),
                "sector_impact": round(sector_adj, 4),
                "macro_adjusted_risk": round(
                    entity_risk.total_system_risk * (1.0 + sector_adj * 0.5), 6
                ),
            })
            total_sector_adj += sector_adj

        # Average sector adjustment
        avg_sector_adj = (
            total_sector_adj / len(sector_adjustments)
            if sector_adjustments
            else 0.0
        )

        # Macro adjustment = risk overlay + sector adjustment
        macro_adjustment = macro.risk_overlay + avg_sector_adj * 0.3
        macro_adjustment = max(-0.50, min(macro_adjustment, 0.50))

        macro_adjusted_risk = base_risk * (1.0 + macro_adjustment)
        macro_adjusted_risk = max(0.0, macro_adjusted_risk)

        reasoning = [
            f"Macro regime: {macro.regime.value} "
            f"(confidence={macro.regime_confidence:.2f})",
            f"Active signals: {len(macro.signals)}",
            f"Risk overlay: {macro.risk_overlay:+.4f}",
            f"Average sector adjustment: {avg_sector_adj:+.4f}",
            f"Combined macro adjustment: {macro_adjustment:+.4f}",
            f"Portfolio risk: {base_risk:.4f} → {macro_adjusted_risk:.4f} "
            f"({macro_adjustment:+.1%})",
        ]

        audit_hash = hashlib.sha256(json.dumps({
            "type": "portfolio_overlay",
            "regime": macro.regime.value,
            "base_risk": round(base_risk, 6),
            "adjusted_risk": round(macro_adjusted_risk, 6),
        }, sort_keys=True).encode()).hexdigest()

        return {
            "portfolio_entities": portfolio_entities,
            "macro_context": {
                "regime": macro.regime.value,
                "regime_confidence": round(macro.regime_confidence, 4),
                "active_signals": len(macro.signals),
                "risk_overlay": round(macro.risk_overlay, 6),
            },
            "base_portfolio_risk": round(base_risk, 6),
            "macro_adjusted_risk": round(macro_adjusted_risk, 6),
            "macro_adjustment": round(macro_adjustment, 6),
            "adjustment_pct": f"{macro_adjustment:+.1%}",
            "sector_adjustments": sector_adjustments,
            "reasoning": reasoning,
            "audit_hash": audit_hash,
        }

    # -------------------------------------------------------------------
    # Underwriting overlay
    # -------------------------------------------------------------------

    def underwriting_overlay(
        self,
        indicators_input: dict[str, float],
        entity_id: str,
        sector: str | None = None,
    ) -> dict[str, Any]:
        """Generate macro overlay for underwriting decisions.

        Adjusts entity risk score based on macro context.
        """
        from src.graph_brain.storage import get_repository
        from src.graph_brain.decision.risk_propagation_engine import propagate_risk
        from src.risk_models import _infer_sector

        macro = self.analyze(indicators_input)
        repo = get_repository()

        if not sector:
            sector = _infer_sector(entity_id)

        # Entity risk
        prop_result = propagate_risk(
            entity_id=entity_id, depth=3, repo=repo,
        )
        entity_risk_norm = min(prop_result.total_system_risk / 10.0, 1.0)

        # Sector impact for this entity
        sector_impact: SectorImpact | None = None
        for si in macro.sector_impacts:
            if si.sector == sector:
                sector_impact = si
                break

        sector_adj = sector_impact.impact_score if sector_impact else 0.0

        # Macro adjustment
        macro_adj = macro.risk_overlay + sector_adj * 0.4
        macro_adj = max(-0.30, min(macro_adj, 0.30))

        adjusted_score = entity_risk_norm + macro_adj
        adjusted_score = max(0.0, min(adjusted_score, 1.0))

        # Pricing impact
        if macro_adj > 0.10:
            pricing_impact = f"Premium increase +{macro_adj * 50:.1f}% due to macro stress"
        elif macro_adj > 0.0:
            pricing_impact = f"Moderate premium loading +{macro_adj * 30:.1f}%"
        elif macro_adj < -0.05:
            pricing_impact = f"Premium discount {macro_adj * 30:.1f}% from favorable macro"
        else:
            pricing_impact = "No significant macro pricing impact"

        # Conditions from macro
        conditions: list[str] = []
        if macro.regime in (RegimeType.RECESSION, RegimeType.OIL_SHOCK):
            conditions.append(
                f"Macro regime '{macro.regime.value}' requires enhanced monitoring"
            )
        if macro.regime == RegimeType.INFLATIONARY:
            conditions.append("Inflation-linked coverage exclusion clause recommended")
        if abs(macro_adj) > 0.15:
            conditions.append(
                "Significant macro stress — quarterly re-evaluation mandated"
            )
        if sector_impact and abs(sector_impact.impact_score) > 0.5:
            conditions.append(
                f"Sector '{sector}' under severe macro pressure — "
                f"exposure limits recommended"
            )

        reasoning = [
            f"Entity '{entity_id}' base risk: {entity_risk_norm:.4f}",
            f"Macro regime: {macro.regime.value}",
            f"Macro risk overlay: {macro.risk_overlay:+.4f}",
            f"Sector '{sector}' macro impact: {sector_adj:+.4f}",
            f"Combined macro adjustment: {macro_adj:+.4f}",
            f"Adjusted risk: {entity_risk_norm:.4f} → {adjusted_score:.4f}",
        ]

        audit_hash = hashlib.sha256(json.dumps({
            "type": "underwriting_overlay",
            "entity_id": entity_id,
            "base_score": round(entity_risk_norm, 6),
            "adjusted_score": round(adjusted_score, 6),
            "regime": macro.regime.value,
        }, sort_keys=True).encode()).hexdigest()

        return {
            "entity_id": entity_id,
            "sector": sector,
            "base_risk_score": round(entity_risk_norm, 6),
            "macro_adjusted_score": round(adjusted_score, 6),
            "macro_adjustment": round(macro_adj, 6),
            "macro_context": {
                "regime": macro.regime.value,
                "regime_confidence": round(macro.regime_confidence, 4),
                "active_signals": len(macro.signals),
                "risk_overlay": round(macro.risk_overlay, 6),
            },
            "sector_impact": sector_impact.model_dump() if sector_impact else None,
            "pricing_impact": pricing_impact,
            "conditions_added": conditions,
            "reasoning": reasoning,
            "audit_hash": audit_hash,
        }

    # -------------------------------------------------------------------
    # Indicator diagnostics
    # -------------------------------------------------------------------

    def diagnose_indicators(
        self,
        indicators_input: dict[str, float],
    ) -> dict[str, Any]:
        """Diagnostic view of all indicators with deviations and states."""
        indicators = self.data_provider.resolve_indicators(indicators_input)
        deviations = self.data_provider.compute_deviations(indicators)

        classified: dict[str, str] = {}
        for key, value in indicators.items():
            classified[key] = self.data_provider.classify_indicator_state(key, value)

        alerts = [
            {"indicator": k, "state": v, "value": indicators[k]}
            for k, v in classified.items()
            if v.startswith("critical")
        ]

        return {
            "indicators": indicators,
            "deviations": deviations,
            "states": classified,
            "alerts": alerts,
            "alert_count": len(alerts),
        }


def get_orchestrator() -> MacroOrchestrator:
    """Singleton orchestrator."""
    global _instance
    if _instance is None:
        _instance = MacroOrchestrator()
    return _instance
