"""Macro Intelligence — Data Provider.

Merges external indicator inputs with GCC baseline defaults.
Normalizes and validates all indicator values.
Singleton pattern via get_data_provider().
"""

from __future__ import annotations

from typing import Any

from src.macro_intelligence.ingestion.data_models import (
    GCC_BASELINE_INDICATORS,
    GCC_INDICATOR_METADATA,
)

_instance: MacroDataProvider | None = None


class MacroDataProvider:
    """Provides normalized macro indicator data.

    Merges user-supplied indicators with GCC baselines.
    Validates ranges and computes deviations from baseline.
    """

    def __init__(self) -> None:
        self._baselines = GCC_BASELINE_INDICATORS.copy()
        self._metadata = GCC_INDICATOR_METADATA

    def resolve_indicators(
        self,
        user_input: dict[str, float],
    ) -> dict[str, float]:
        """Merge user input with baselines — user values override.

        Args:
            user_input: Partial indicator dict from API.

        Returns:
            Complete indicator dict with all 12 indicators.
        """
        resolved = self._baselines.copy()
        for key, value in user_input.items():
            if key in resolved:
                resolved[key] = float(value)
        return resolved

    def compute_deviations(
        self,
        indicators: dict[str, float],
    ) -> dict[str, dict[str, float]]:
        """Compute deviation from baseline for each indicator.

        Returns:
            Dict of indicator → {value, baseline, deviation, pct_deviation, z_score}
        """
        deviations: dict[str, dict[str, float]] = {}
        for key, value in indicators.items():
            baseline = self._baselines.get(key, value)
            meta = self._metadata.get(key, {})
            deviation = value - baseline

            # Pct deviation (avoid div-by-zero)
            pct_dev = (deviation / abs(baseline)) if baseline != 0 else 0.0

            # Z-score relative to threshold range
            low = meta.get("low_threshold", baseline * 0.8)
            high = meta.get("high_threshold", baseline * 1.2)
            range_width = high - low
            z_score = (
                (value - baseline) / (range_width / 2)
                if range_width > 0
                else 0.0
            )

            deviations[key] = {
                "value": value,
                "baseline": baseline,
                "deviation": round(deviation, 6),
                "pct_deviation": round(pct_dev, 6),
                "z_score": round(z_score, 4),
            }

        return deviations

    def classify_indicator_state(
        self,
        key: str,
        value: float,
    ) -> str:
        """Classify indicator as critical_low / low / normal / high / critical_high."""
        meta = self._metadata.get(key, {})
        if not meta:
            return "normal"

        crit_low = meta.get("critical_low", float("-inf"))
        low = meta.get("low_threshold", float("-inf"))
        high = meta.get("high_threshold", float("inf"))
        crit_high = meta.get("critical_high", float("inf"))

        if value <= crit_low:
            return "critical_low"
        if value <= low:
            return "low"
        if value >= crit_high:
            return "critical_high"
        if value >= high:
            return "high"
        return "normal"

    @property
    def indicator_names(self) -> list[str]:
        return list(self._baselines.keys())


def get_data_provider() -> MacroDataProvider:
    """Singleton data provider."""
    global _instance
    if _instance is None:
        _instance = MacroDataProvider()
    return _instance
