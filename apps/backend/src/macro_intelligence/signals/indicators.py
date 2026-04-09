"""Macro Intelligence — Signal rules and indicator definitions.

Each rule defines:
  - condition: lambda that takes indicators dict → bool
  - signal_name: unique identifier
  - strength_fn: lambda that takes indicators dict → 0–1 strength
  - direction: "up" / "down" / "neutral"
  - source_indicators: which indicators feed this signal
  - description / description_ar: human-readable explanation

GCC-specific rules tuned for Gulf economies.
"""

from __future__ import annotations

from typing import Any, Callable


# ---------------------------------------------------------------------------
# Signal rule type
# ---------------------------------------------------------------------------

class SignalRule:
    """Declarative signal rule — evaluated against indicator state."""

    __slots__ = (
        "name", "condition", "strength_fn", "direction",
        "source_indicators", "description", "description_ar",
    )

    def __init__(
        self,
        name: str,
        condition: Callable[[dict[str, float]], bool],
        strength_fn: Callable[[dict[str, float]], float],
        direction: str,
        source_indicators: list[str],
        description: str = "",
        description_ar: str = "",
    ) -> None:
        self.name = name
        self.condition = condition
        self.strength_fn = strength_fn
        self.direction = direction
        self.source_indicators = source_indicators
        self.description = description
        self.description_ar = description_ar


# ---------------------------------------------------------------------------
# GCC signal rules
# ---------------------------------------------------------------------------

SIGNAL_RULES: list[SignalRule] = [
    # ── Oil price signals ─────────────────────────────────────────────
    SignalRule(
        name="oil_price_surge",
        condition=lambda d: d.get("brent_crude", 80) > 100,
        strength_fn=lambda d: min((d.get("brent_crude", 80) - 100) / 30, 1.0),
        direction="up",
        source_indicators=["brent_crude"],
        description="Oil price above $100/bbl — GCC revenue boost, global cost pressure",
        description_ar="ارتفاع أسعار النفط فوق 100$ — تعزيز إيرادات الخليج",
    ),
    SignalRule(
        name="oil_price_collapse",
        condition=lambda d: d.get("brent_crude", 80) < 50,
        strength_fn=lambda d: min((50 - d.get("brent_crude", 80)) / 20, 1.0),
        direction="down",
        source_indicators=["brent_crude"],
        description="Oil price below $50/bbl — GCC fiscal stress, budget pressure",
        description_ar="انخفاض أسعار النفط تحت 50$ — ضغط مالي على دول الخليج",
    ),
    SignalRule(
        name="oil_price_moderate_decline",
        condition=lambda d: 50 <= d.get("brent_crude", 80) < 65,
        strength_fn=lambda d: min((65 - d.get("brent_crude", 80)) / 15, 0.7),
        direction="down",
        source_indicators=["brent_crude"],
        description="Oil price in $50–65 range — moderate fiscal pressure",
        description_ar="أسعار النفط في نطاق 50-65$ — ضغط مالي معتدل",
    ),

    # ── Interest rate signals ─────────────────────────────────────────
    SignalRule(
        name="interest_rate_hike",
        condition=lambda d: d.get("interest_rate", 0.05) > 0.06,
        strength_fn=lambda d: min((d.get("interest_rate", 0.05) - 0.06) / 0.03, 1.0),
        direction="up",
        source_indicators=["interest_rate"],
        description="Policy rate above 6% — tightening financial conditions",
        description_ar="سعر الفائدة فوق 6% — تشديد الأوضاع المالية",
    ),
    SignalRule(
        name="ultra_low_rates",
        condition=lambda d: d.get("interest_rate", 0.05) < 0.015,
        strength_fn=lambda d: min((0.015 - d.get("interest_rate", 0.05)) / 0.01, 1.0),
        direction="down",
        source_indicators=["interest_rate"],
        description="Ultra-low rates below 1.5% — risk of asset bubbles",
        description_ar="أسعار فائدة منخفضة جداً — خطر فقاعات الأصول",
    ),

    # ── Inflation signals ─────────────────────────────────────────────
    SignalRule(
        name="high_inflation",
        condition=lambda d: d.get("inflation", 0.025) > 0.04,
        strength_fn=lambda d: min((d.get("inflation", 0.025) - 0.04) / 0.03, 1.0),
        direction="up",
        source_indicators=["inflation"],
        description="Inflation above 4% — eroding purchasing power, claims pressure",
        description_ar="تضخم فوق 4% — تآكل القوة الشرائية",
    ),
    SignalRule(
        name="deflation_risk",
        condition=lambda d: d.get("inflation", 0.025) < 0.005,
        strength_fn=lambda d: min((0.005 - d.get("inflation", 0.025)) / 0.01, 1.0),
        direction="down",
        source_indicators=["inflation"],
        description="Near-zero or negative inflation — demand weakness signal",
        description_ar="تضخم قريب من الصفر — إشارة ضعف في الطلب",
    ),

    # ── GDP growth signals ────────────────────────────────────────────
    SignalRule(
        name="strong_growth",
        condition=lambda d: d.get("gdp_growth", 0.035) > 0.06,
        strength_fn=lambda d: min((d.get("gdp_growth", 0.035) - 0.06) / 0.04, 1.0),
        direction="up",
        source_indicators=["gdp_growth"],
        description="GDP growth above 6% — expansion phase",
        description_ar="نمو اقتصادي فوق 6% — مرحلة توسع",
    ),
    SignalRule(
        name="recession_signal",
        condition=lambda d: d.get("gdp_growth", 0.035) < 0.0,
        strength_fn=lambda d: min(abs(d.get("gdp_growth", 0.035)) / 0.03, 1.0),
        direction="down",
        source_indicators=["gdp_growth"],
        description="Negative GDP growth — recession indicator",
        description_ar="نمو اقتصادي سالب — مؤشر ركود",
    ),

    # ── PMI signals ───────────────────────────────────────────────────
    SignalRule(
        name="pmi_contraction",
        condition=lambda d: d.get("pmi", 52) < 48,
        strength_fn=lambda d: min((48 - d.get("pmi", 52)) / 6, 1.0),
        direction="down",
        source_indicators=["pmi"],
        description="PMI below 48 — manufacturing contraction",
        description_ar="مؤشر مديري المشتريات تحت 48 — انكماش التصنيع",
    ),
    SignalRule(
        name="pmi_strong_expansion",
        condition=lambda d: d.get("pmi", 52) > 56,
        strength_fn=lambda d: min((d.get("pmi", 52) - 56) / 6, 1.0),
        direction="up",
        source_indicators=["pmi"],
        description="PMI above 56 — strong manufacturing expansion",
        description_ar="مؤشر مديري المشتريات فوق 56 — توسع قوي في التصنيع",
    ),

    # ── Credit signals ────────────────────────────────────────────────
    SignalRule(
        name="credit_boom",
        condition=lambda d: d.get("credit_growth", 0.06) > 0.12,
        strength_fn=lambda d: min((d.get("credit_growth", 0.06) - 0.12) / 0.08, 1.0),
        direction="up",
        source_indicators=["credit_growth"],
        description="Credit growth above 12% — overheating risk",
        description_ar="نمو ائتماني فوق 12% — خطر فرط النشاط",
    ),
    SignalRule(
        name="credit_crunch",
        condition=lambda d: d.get("credit_growth", 0.06) < 0.01,
        strength_fn=lambda d: min((0.01 - d.get("credit_growth", 0.06)) / 0.03, 1.0),
        direction="down",
        source_indicators=["credit_growth"],
        description="Credit growth below 1% — lending freeze signal",
        description_ar="نمو ائتماني أقل من 1% — تجمد الإقراض",
    ),

    # ── VIX / Global risk ─────────────────────────────────────────────
    SignalRule(
        name="global_fear",
        condition=lambda d: d.get("vix", 16) > 30,
        strength_fn=lambda d: min((d.get("vix", 16) - 30) / 15, 1.0),
        direction="up",
        source_indicators=["vix"],
        description="VIX above 30 — global risk-off, capital flight risk",
        description_ar="مؤشر الخوف فوق 30 — نفور عالمي من المخاطر",
    ),

    # ── FX peg stress ─────────────────────────────────────────────────
    SignalRule(
        name="fx_peg_stress",
        condition=lambda d: abs(d.get("fx_usd_sar", 3.75) - 3.75) > 0.05,
        strength_fn=lambda d: min(
            abs(d.get("fx_usd_sar", 3.75) - 3.75) / 0.10, 1.0
        ),
        direction="down",
        source_indicators=["fx_usd_sar"],
        description="SAR peg deviation > 5 halalas — currency stress signal",
        description_ar="انحراف ربط الريال > 5 هللات — إشارة ضغط على العملة",
    ),

    # ── Shipping / Trade signals ──────────────────────────────────────
    SignalRule(
        name="shipping_cost_spike",
        condition=lambda d: d.get("shipping_cost_index", 100) > 140,
        strength_fn=lambda d: min(
            (d.get("shipping_cost_index", 100) - 140) / 50, 1.0
        ),
        direction="up",
        source_indicators=["shipping_cost_index"],
        description="Shipping costs 40%+ above baseline — supply chain stress",
        description_ar="تكاليف شحن مرتفعة 40% فوق الأساس — ضغط سلاسل الإمداد",
    ),

    # ── Real estate signals ───────────────────────────────────────────
    SignalRule(
        name="real_estate_bubble",
        condition=lambda d: d.get("real_estate_index", 100) > 125,
        strength_fn=lambda d: min(
            (d.get("real_estate_index", 100) - 125) / 20, 1.0
        ),
        direction="up",
        source_indicators=["real_estate_index"],
        description="Real estate 25%+ above baseline — bubble risk",
        description_ar="العقارات مرتفعة 25% فوق الأساس — خطر فقاعة عقارية",
    ),
    SignalRule(
        name="real_estate_crash",
        condition=lambda d: d.get("real_estate_index", 100) < 80,
        strength_fn=lambda d: min(
            (80 - d.get("real_estate_index", 100)) / 15, 1.0
        ),
        direction="down",
        source_indicators=["real_estate_index"],
        description="Real estate 20%+ below baseline — market crash signal",
        description_ar="العقارات منخفضة 20% تحت الأساس — إشارة انهيار سوقي",
    ),

    # ── Compound signals ──────────────────────────────────────────────
    SignalRule(
        name="stagflation_risk",
        condition=lambda d: (
            d.get("gdp_growth", 0.035) < 0.01
            and d.get("inflation", 0.025) > 0.04
        ),
        strength_fn=lambda d: min(
            (0.5 * abs(d.get("gdp_growth", 0.035))
             + 0.5 * (d.get("inflation", 0.025) - 0.04)) / 0.04,
            1.0,
        ),
        direction="up",
        source_indicators=["gdp_growth", "inflation"],
        description="Low growth + high inflation — stagflation scenario",
        description_ar="نمو منخفض + تضخم مرتفع — سيناريو الركود التضخمي",
    ),
    SignalRule(
        name="fiscal_squeeze",
        condition=lambda d: (
            d.get("brent_crude", 80) < 60
            and d.get("govt_spending_growth", 0.04) > 0.06
        ),
        strength_fn=lambda d: min(
            (0.5 * (60 - d.get("brent_crude", 80)) / 25
             + 0.5 * (d.get("govt_spending_growth", 0.04) - 0.06) / 0.06),
            1.0,
        ),
        direction="down",
        source_indicators=["brent_crude", "govt_spending_growth"],
        description="Low oil + high govt spending — fiscal sustainability risk",
        description_ar="نفط منخفض + إنفاق حكومي مرتفع — خطر استدامة مالية",
    ),
]
