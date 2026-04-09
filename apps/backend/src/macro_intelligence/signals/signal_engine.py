"""Macro Intelligence — Signal Engine.

Evaluates indicator state against declarative signal rules.
Produces ranked, typed MacroSignal objects.
Deterministic — same indicators always produce same signals.
"""

from __future__ import annotations

from src.macro_intelligence.schemas.macro_schemas import MacroSignal, SignalDirection
from src.macro_intelligence.signals.indicators import SIGNAL_RULES, SignalRule


class SignalEngine:
    """Evaluates macro indicators against signal rules.

    Stateless — all state comes from the indicators dict.
    """

    def __init__(self, rules: list[SignalRule] | None = None) -> None:
        self._rules = rules or SIGNAL_RULES

    def generate_signals(
        self,
        indicators: dict[str, float],
    ) -> list[MacroSignal]:
        """Evaluate all rules against indicators.

        Args:
            indicators: Complete indicator dict (12 GCC indicators).

        Returns:
            List of active MacroSignal, sorted by strength descending.
        """
        active: list[MacroSignal] = []

        for rule in self._rules:
            try:
                if rule.condition(indicators):
                    strength = max(0.0, min(rule.strength_fn(indicators), 1.0))
                    active.append(MacroSignal(
                        name=rule.name,
                        strength=round(strength, 4),
                        direction=SignalDirection(rule.direction),
                        source_indicators=rule.source_indicators,
                        description=rule.description,
                        description_ar=rule.description_ar,
                    ))
            except (KeyError, TypeError, ZeroDivisionError):
                # Rule depends on missing indicator — skip silently
                continue

        # Sort by strength descending
        active.sort(key=lambda s: -s.strength)
        return active

    def compute_aggregate_risk_adjustment(
        self,
        signals: list[MacroSignal],
    ) -> float:
        """Compute aggregate risk adjustment from active signals.

        Negative signals (down direction) increase risk.
        Positive signals (up direction on favorable indicators) may decrease risk.
        Range: [-0.30, +0.30]
        """
        if not signals:
            return 0.0

        adjustment = 0.0
        for signal in signals:
            weight = signal.strength

            if signal.name in _RISK_INCREASING_SIGNALS:
                adjustment += weight * 0.10  # Each risk signal adds up to +0.10
            elif signal.name in _RISK_DECREASING_SIGNALS:
                adjustment -= weight * 0.05  # Each favorable signal removes up to -0.05
            else:
                # Neutral impact signals
                if signal.direction == SignalDirection.DOWN:
                    adjustment += weight * 0.05
                elif signal.direction == SignalDirection.UP:
                    adjustment -= weight * 0.02

        return max(-0.30, min(adjustment, 0.30))

    @property
    def rule_count(self) -> int:
        return len(self._rules)


# ---------------------------------------------------------------------------
# Signal classification for risk adjustment
# ---------------------------------------------------------------------------

_RISK_INCREASING_SIGNALS: set[str] = {
    "oil_price_collapse",
    "oil_price_moderate_decline",
    "interest_rate_hike",
    "high_inflation",
    "recession_signal",
    "pmi_contraction",
    "credit_crunch",
    "global_fear",
    "fx_peg_stress",
    "shipping_cost_spike",
    "real_estate_crash",
    "stagflation_risk",
    "fiscal_squeeze",
    "deflation_risk",
}

_RISK_DECREASING_SIGNALS: set[str] = {
    "oil_price_surge",
    "strong_growth",
    "pmi_strong_expansion",
    "ultra_low_rates",
}
