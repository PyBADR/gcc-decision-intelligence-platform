"""Macro Intelligence — GCC baseline indicators and metadata.

Seed data representing typical GCC macro conditions.
Used as defaults when external data sources are unavailable.
"""

from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# GCC baseline indicators (neutral-state reference point)
# ---------------------------------------------------------------------------

GCC_BASELINE_INDICATORS: dict[str, float] = {
    "brent_crude": 80.0,            # USD/barrel
    "interest_rate": 0.050,         # 5.0% (follows Fed)
    "inflation": 0.025,             # 2.5% CPI
    "gdp_growth": 0.035,            # 3.5% real GDP
    "fx_usd_sar": 3.75,             # SAR peg
    "credit_growth": 0.06,          # 6% credit expansion
    "pmi": 52.0,                    # Purchasing Managers Index
    "real_estate_index": 100.0,     # Baseline = 100
    "trade_balance": 12.0,          # Billion USD surplus
    "govt_spending_growth": 0.04,   # 4% spending growth
    "vix": 16.0,                    # VIX baseline
    "shipping_cost_index": 100.0,   # Baseline = 100
}


# ---------------------------------------------------------------------------
# Indicator metadata — thresholds, units, descriptions
# ---------------------------------------------------------------------------

GCC_INDICATOR_METADATA: dict[str, dict[str, Any]] = {
    "brent_crude": {
        "unit": "USD/barrel",
        "label": "Brent Crude Oil",
        "label_ar": "خام برنت",
        "baseline": 80.0,
        "low_threshold": 50.0,
        "high_threshold": 100.0,
        "critical_high": 120.0,
        "critical_low": 35.0,
        "description": "Brent crude benchmark — primary GCC revenue driver",
    },
    "interest_rate": {
        "unit": "%",
        "label": "Policy Rate",
        "label_ar": "سعر الفائدة",
        "baseline": 0.050,
        "low_threshold": 0.020,
        "high_threshold": 0.060,
        "critical_high": 0.080,
        "critical_low": 0.005,
        "description": "Central bank policy rate (GCC pegged to USD → follows Fed)",
    },
    "inflation": {
        "unit": "%",
        "label": "CPI Inflation",
        "label_ar": "التضخم",
        "baseline": 0.025,
        "low_threshold": 0.010,
        "high_threshold": 0.040,
        "critical_high": 0.060,
        "critical_low": -0.010,
        "description": "Consumer Price Index — year-over-year",
    },
    "gdp_growth": {
        "unit": "%",
        "label": "GDP Growth",
        "label_ar": "نمو الناتج المحلي",
        "baseline": 0.035,
        "low_threshold": 0.010,
        "high_threshold": 0.060,
        "critical_high": 0.100,
        "critical_low": -0.020,
        "description": "Real GDP growth rate — annualized",
    },
    "fx_usd_sar": {
        "unit": "SAR/USD",
        "label": "USD/SAR Rate",
        "label_ar": "سعر الدولار/ريال",
        "baseline": 3.75,
        "low_threshold": 3.70,
        "high_threshold": 3.80,
        "critical_high": 3.85,
        "critical_low": 3.65,
        "description": "Exchange rate — SAR peg to USD (deviation = stress signal)",
    },
    "credit_growth": {
        "unit": "%",
        "label": "Credit Growth",
        "label_ar": "نمو الائتمان",
        "baseline": 0.06,
        "low_threshold": 0.02,
        "high_threshold": 0.12,
        "critical_high": 0.18,
        "critical_low": -0.02,
        "description": "Banking sector credit growth rate",
    },
    "pmi": {
        "unit": "index",
        "label": "PMI",
        "label_ar": "مؤشر مديري المشتريات",
        "baseline": 52.0,
        "low_threshold": 48.0,
        "high_threshold": 56.0,
        "critical_high": 60.0,
        "critical_low": 44.0,
        "description": "Purchasing Managers Index — 50 = neutral threshold",
    },
    "real_estate_index": {
        "unit": "index",
        "label": "Real Estate Index",
        "label_ar": "مؤشر العقارات",
        "baseline": 100.0,
        "low_threshold": 85.0,
        "high_threshold": 115.0,
        "critical_high": 130.0,
        "critical_low": 70.0,
        "description": "Real estate price index — 100 = baseline year",
    },
    "trade_balance": {
        "unit": "B USD",
        "label": "Trade Balance",
        "label_ar": "الميزان التجاري",
        "baseline": 12.0,
        "low_threshold": 0.0,
        "high_threshold": 25.0,
        "critical_high": 40.0,
        "critical_low": -5.0,
        "description": "Monthly trade balance — billion USD",
    },
    "govt_spending_growth": {
        "unit": "%",
        "label": "Government Spending Growth",
        "label_ar": "نمو الإنفاق الحكومي",
        "baseline": 0.04,
        "low_threshold": 0.00,
        "high_threshold": 0.08,
        "critical_high": 0.15,
        "critical_low": -0.05,
        "description": "Government fiscal spending growth rate",
    },
    "vix": {
        "unit": "index",
        "label": "VIX Volatility",
        "label_ar": "مؤشر التقلب",
        "baseline": 16.0,
        "low_threshold": 12.0,
        "high_threshold": 25.0,
        "critical_high": 35.0,
        "critical_low": 9.0,
        "description": "CBOE Volatility Index — global risk appetite proxy",
    },
    "shipping_cost_index": {
        "unit": "index",
        "label": "Shipping Cost Index",
        "label_ar": "مؤشر تكلفة الشحن",
        "baseline": 100.0,
        "low_threshold": 80.0,
        "high_threshold": 130.0,
        "critical_high": 180.0,
        "critical_low": 60.0,
        "description": "Composite shipping cost index — 100 = baseline",
    },
}
