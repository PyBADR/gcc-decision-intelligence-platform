"""Macro Intelligence — Regime Detector.

Classifies the current macroeconomic regime based on indicator state.
GCC-tuned: oil price is a first-class regime driver.

Regime types:
    expansion      — high growth, low inflation, favorable conditions
    tightening     — rising rates, slowing growth, restrictive policy
    inflationary   — high inflation, potential stagflation
    recession      — negative growth, weak PMI, contracting credit
    oil_boom       — oil above $100, strong fiscal position
    oil_shock      — oil below $50, fiscal stress
    neutral        — no clear regime signal

Deterministic — same indicators always produce same regime.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.macro_intelligence.schemas.macro_schemas import RegimeType


@dataclass
class RegimeClassification:
    """Regime classification result with confidence."""
    regime: RegimeType
    confidence: float  # 0–1
    primary_drivers: list[str]
    description: str
    description_ar: str


class RegimeDetector:
    """Classifies macro regime from indicators.

    Uses a priority-ordered rule cascade.
    First matching regime wins (with confidence weighting).
    """

    def classify(
        self,
        indicators: dict[str, float],
    ) -> RegimeClassification:
        """Classify current macro regime.

        Args:
            indicators: Complete indicator dict.

        Returns:
            RegimeClassification with type, confidence, and drivers.
        """
        # Extract key indicators with defaults
        oil = indicators.get("brent_crude", 80.0)
        rate = indicators.get("interest_rate", 0.05)
        inflation = indicators.get("inflation", 0.025)
        growth = indicators.get("gdp_growth", 0.035)
        pmi = indicators.get("pmi", 52.0)
        credit = indicators.get("credit_growth", 0.06)
        vix = indicators.get("vix", 16.0)

        # Accumulate regime scores
        scores: dict[RegimeType, float] = {r: 0.0 for r in RegimeType}
        drivers: dict[RegimeType, list[str]] = {r: [] for r in RegimeType}

        # ── Oil-driven regimes (highest priority for GCC) ─────────────
        if oil > 100:
            s = min((oil - 100) / 30, 1.0) * 0.8
            scores[RegimeType.OIL_BOOM] += s
            drivers[RegimeType.OIL_BOOM].append(f"brent_crude={oil:.1f}")
        if oil < 50:
            s = min((50 - oil) / 20, 1.0) * 0.9
            scores[RegimeType.OIL_SHOCK] += s
            drivers[RegimeType.OIL_SHOCK].append(f"brent_crude={oil:.1f}")

        # ── Recession ─────────────────────────────────────────────────
        if growth < 0:
            s = min(abs(growth) / 0.03, 1.0) * 0.7
            scores[RegimeType.RECESSION] += s
            drivers[RegimeType.RECESSION].append(f"gdp_growth={growth:.3f}")
        if pmi < 48:
            s = min((48 - pmi) / 6, 1.0) * 0.3
            scores[RegimeType.RECESSION] += s
            drivers[RegimeType.RECESSION].append(f"pmi={pmi:.1f}")
        if credit < 0.01:
            s = min((0.01 - credit) / 0.03, 1.0) * 0.2
            scores[RegimeType.RECESSION] += s
            drivers[RegimeType.RECESSION].append(f"credit_growth={credit:.3f}")

        # ── Inflationary ──────────────────────────────────────────────
        if inflation > 0.04:
            s = min((inflation - 0.04) / 0.03, 1.0) * 0.6
            scores[RegimeType.INFLATIONARY] += s
            drivers[RegimeType.INFLATIONARY].append(f"inflation={inflation:.3f}")
        if inflation > 0.04 and growth < 0.01:
            # Stagflation boost
            s = 0.3
            scores[RegimeType.INFLATIONARY] += s
            drivers[RegimeType.INFLATIONARY].append("stagflation_compound")

        # ── Tightening ────────────────────────────────────────────────
        if rate > 0.06:
            s = min((rate - 0.06) / 0.03, 1.0) * 0.5
            scores[RegimeType.TIGHTENING] += s
            drivers[RegimeType.TIGHTENING].append(f"interest_rate={rate:.3f}")
        if growth > 0 and growth < 0.02 and rate > 0.05:
            s = 0.3
            scores[RegimeType.TIGHTENING] += s
            drivers[RegimeType.TIGHTENING].append("slow_growth_high_rates")

        # ── Expansion ─────────────────────────────────────────────────
        if growth > 0.04:
            s = min((growth - 0.04) / 0.04, 1.0) * 0.5
            scores[RegimeType.EXPANSION] += s
            drivers[RegimeType.EXPANSION].append(f"gdp_growth={growth:.3f}")
        if pmi > 54:
            s = min((pmi - 54) / 6, 1.0) * 0.3
            scores[RegimeType.EXPANSION] += s
            drivers[RegimeType.EXPANSION].append(f"pmi={pmi:.1f}")
        if inflation < 0.03 and growth > 0.03:
            s = 0.2
            scores[RegimeType.EXPANSION] += s
            drivers[RegimeType.EXPANSION].append("low_inflation_good_growth")

        # ── VIX amplifier (increases non-neutral regimes) ─────────────
        if vix > 25:
            vix_boost = min((vix - 25) / 15, 1.0) * 0.15
            for regime in [
                RegimeType.RECESSION,
                RegimeType.INFLATIONARY,
                RegimeType.OIL_SHOCK,
            ]:
                if scores[regime] > 0:
                    scores[regime] += vix_boost
                    drivers[regime].append(f"vix_amplifier={vix:.1f}")

        # ── Select winning regime ─────────────────────────────────────
        best_regime = max(scores, key=lambda r: scores[r])
        best_score = scores[best_regime]

        if best_score < 0.15:
            # No regime has enough signal — neutral
            return RegimeClassification(
                regime=RegimeType.NEUTRAL,
                confidence=0.60,
                primary_drivers=["no_clear_signal"],
                description="Neutral macro environment — no strong regime signals",
                description_ar="بيئة اقتصادية محايدة — لا إشارات واضحة لنظام معين",
            )

        # Confidence = score capped at 0.95
        confidence = min(best_score, 0.95)

        return RegimeClassification(
            regime=best_regime,
            confidence=round(confidence, 4),
            primary_drivers=drivers[best_regime],
            description=_REGIME_DESCRIPTIONS[best_regime]["en"],
            description_ar=_REGIME_DESCRIPTIONS[best_regime]["ar"],
        )


# ---------------------------------------------------------------------------
# Regime descriptions
# ---------------------------------------------------------------------------

_REGIME_DESCRIPTIONS: dict[RegimeType, dict[str, str]] = {
    RegimeType.EXPANSION: {
        "en": "Expansion — strong growth, favorable conditions, low systemic risk",
        "ar": "توسع — نمو قوي وأوضاع مواتية ومخاطر منخفضة",
    },
    RegimeType.TIGHTENING: {
        "en": "Tightening — rising rates, restrictive policy, slowing momentum",
        "ar": "تشديد — ارتفاع أسعار الفائدة وسياسة تقييدية",
    },
    RegimeType.INFLATIONARY: {
        "en": "Inflationary — high inflation, purchasing power erosion, claims pressure",
        "ar": "تضخمي — تضخم مرتفع وتآكل القوة الشرائية",
    },
    RegimeType.RECESSION: {
        "en": "Recession — negative growth, weak demand, elevated default risk",
        "ar": "ركود — نمو سالب وضعف الطلب وارتفاع مخاطر التعثر",
    },
    RegimeType.OIL_BOOM: {
        "en": "Oil Boom — high oil revenue, fiscal surplus, GCC growth acceleration",
        "ar": "طفرة نفطية — إيرادات مرتفعة وفائض مالي وتسارع نمو الخليج",
    },
    RegimeType.OIL_SHOCK: {
        "en": "Oil Shock — low oil prices, fiscal stress, austerity risk",
        "ar": "صدمة نفطية — أسعار منخفضة وضغط مالي وخطر تقشف",
    },
    RegimeType.NEUTRAL: {
        "en": "Neutral — no clear regime signal, baseline conditions",
        "ar": "محايد — لا إشارات واضحة، أوضاع أساسية مستقرة",
    },
}
