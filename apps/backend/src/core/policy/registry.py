"""Policy Engine — Default GCC Policy Registry.

Seeds production-ready policy presets for GCC decision intelligence.
Policies are idempotent — calling seed_default_policies() multiple times
will not duplicate entries.
"""

from __future__ import annotations

import logging
from typing import Any

from src.core.policy.engine import PolicyEngine, get_policy_engine

logger = logging.getLogger("observatory.policy")

# -------------------------------------------------------------------
# GCC Default Policy Definitions
# -------------------------------------------------------------------

_DEFAULT_POLICIES: list[dict[str, Any]] = [
    # ---------------------------------------------------------------
    # 1. Inflationary Regime Guard
    # ---------------------------------------------------------------
    {
        "name": "gcc_inflationary_guard",
        "description": "Restrict underwriting during inflationary regimes with elevated risk",
        "description_ar": "تقييد الاكتتاب خلال فترات التضخم مع المخاطر المرتفعة",
        "sector": "*",
        "rules": [
            {
                "name": "inflation_high_risk_reject",
                "description": "Reject high-risk entities during inflation",
                "condition": {
                    "macro.regime": "inflationary",
                    "risk_score": {"gt": 0.6},
                },
                "action": {
                    "decision": "REJECTED",
                    "reason": "High risk during inflationary regime — automatic rejection per GCC policy",
                    "block": False,
                },
                "priority": 100,
            },
            {
                "name": "inflation_moderate_risk_conditional",
                "description": "Add conditions for moderate risk during inflation",
                "condition": {
                    "macro.regime": "inflationary",
                    "risk_score": {"gt": 0.3, "lte": 0.6},
                },
                "action": {
                    "decision": "CONDITIONAL",
                    "pricing_adjustment": 0.15,
                    "conditions": [
                        "quarterly_financial_review",
                        "inflation_hedge_clause",
                    ],
                    "reason": "Moderate risk during inflation — enhanced due diligence required",
                },
                "priority": 90,
            },
            {
                "name": "inflation_pricing_surcharge",
                "description": "Apply pricing surcharge during inflation for all approvals",
                "condition": {
                    "macro.regime": "inflationary",
                },
                "action": {
                    "pricing_adjustment": 0.05,
                    "conditions": ["inflation_monitoring"],
                    "reason": "Inflationary regime base surcharge",
                },
                "priority": 50,
            },
        ],
    },
    # ---------------------------------------------------------------
    # 2. Oil Shock Protection
    # ---------------------------------------------------------------
    {
        "name": "gcc_oil_shock_protection",
        "description": "Protect portfolio during oil price shock scenarios",
        "description_ar": "حماية المحفظة خلال صدمات أسعار النفط",
        "sector": "*",
        "rules": [
            {
                "name": "oil_shock_energy_block",
                "description": "Block new energy sector underwriting during oil shock",
                "condition": {
                    "macro.regime": "oil_shock",
                    "sector": {"in": ["energy", "petrochemical"]},
                },
                "action": {
                    "decision": "REJECTED",
                    "block": True,
                    "reason": "Energy sector blocked during oil shock — portfolio protection",
                },
                "priority": 200,
            },
            {
                "name": "oil_shock_coverage_cap",
                "description": "Cap coverage during oil shock",
                "condition": {
                    "macro.regime": "oil_shock",
                },
                "action": {
                    "coverage_cap_pct": 0.50,
                    "pricing_adjustment": 0.20,
                    "conditions": ["oil_price_review_clause", "quarterly_reassessment"],
                    "reason": "Oil shock regime — coverage capped at 50%, pricing +20%",
                },
                "priority": 150,
            },
        ],
    },
    # ---------------------------------------------------------------
    # 3. High-Risk Sector Controls
    # ---------------------------------------------------------------
    {
        "name": "gcc_high_risk_sectors",
        "description": "Enhanced controls for traditionally high-risk GCC sectors",
        "description_ar": "ضوابط معززة للقطاعات عالية المخاطر في دول الخليج",
        "sector": "*",
        "rules": [
            {
                "name": "real_estate_high_risk",
                "description": "Additional scrutiny for high-risk real estate",
                "condition": {
                    "sector": "real_estate",
                    "risk_score": {"gt": 0.45},
                },
                "action": {
                    "pricing_adjustment": 0.10,
                    "coverage_cap_pct": 0.70,
                    "conditions": [
                        "property_valuation_required",
                        "market_analysis_attachment",
                    ],
                    "reason": "Real estate high-risk — enhanced controls applied",
                },
                "priority": 80,
            },
            {
                "name": "construction_volatility",
                "description": "Construction sector volatility surcharge",
                "condition": {
                    "sector": "construction",
                    "risk_score": {"gt": 0.35},
                },
                "action": {
                    "pricing_adjustment": 0.12,
                    "conditions": [
                        "project_completion_guarantee",
                        "subcontractor_review",
                    ],
                    "reason": "Construction sector volatility premium",
                },
                "priority": 75,
            },
            {
                "name": "maritime_sanctions_check",
                "description": "Maritime sector mandatory sanctions screening",
                "condition": {
                    "sector": "maritime",
                },
                "action": {
                    "conditions": [
                        "sanctions_screening_required",
                        "vessel_tracking_clause",
                        "flag_state_verification",
                    ],
                    "reason": "Maritime sector — mandatory compliance conditions",
                },
                "priority": 70,
            },
        ],
    },
    # ---------------------------------------------------------------
    # 4. Recession Defensive Posture
    # ---------------------------------------------------------------
    {
        "name": "gcc_recession_defense",
        "description": "Defensive underwriting posture during recession",
        "description_ar": "وضع دفاعي للاكتتاب خلال فترة الركود",
        "sector": "*",
        "rules": [
            {
                "name": "recession_reject_high_risk",
                "description": "Reject high-risk during recession",
                "condition": {
                    "macro.regime": "recession",
                    "risk_score": {"gt": 0.50},
                },
                "action": {
                    "decision": "REJECTED",
                    "reason": "Recession regime — high risk entities not acceptable",
                },
                "priority": 110,
            },
            {
                "name": "recession_coverage_reduction",
                "description": "Reduce coverage across all sectors during recession",
                "condition": {
                    "macro.regime": "recession",
                },
                "action": {
                    "coverage_cap_pct": 0.60,
                    "pricing_adjustment": 0.10,
                    "conditions": ["monthly_financial_monitoring"],
                    "reason": "Recession posture — reduced coverage capacity",
                },
                "priority": 60,
            },
        ],
    },
    # ---------------------------------------------------------------
    # 5. Credit Tightening Controls
    # ---------------------------------------------------------------
    {
        "name": "gcc_credit_tightening",
        "description": "Controls during monetary tightening cycles",
        "description_ar": "ضوابط خلال دورات التشديد النقدي",
        "sector": "*",
        "rules": [
            {
                "name": "tightening_risk_uplift",
                "description": "Risk uplift during credit tightening",
                "condition": {
                    "macro.regime": "tightening",
                },
                "action": {
                    "risk_adjustment": 0.05,
                    "pricing_adjustment": 0.08,
                    "conditions": ["credit_facility_review"],
                    "reason": "Credit tightening — systemic risk uplift",
                },
                "priority": 55,
            },
        ],
    },
    # ---------------------------------------------------------------
    # 6. Portfolio Concentration Guard
    # ---------------------------------------------------------------
    {
        "name": "gcc_concentration_guard",
        "description": "Prevent excessive portfolio concentration",
        "description_ar": "منع التركز المفرط في المحفظة",
        "sector": "*",
        "rules": [
            {
                "name": "high_concentration_cap",
                "description": "Cap coverage when portfolio concentration is high",
                "condition": {
                    "portfolio.concentration_risk": {"gt": 0.7},
                },
                "action": {
                    "coverage_cap_pct": 0.40,
                    "conditions": ["diversification_plan_required"],
                    "reason": "Portfolio concentration too high — coverage capped",
                },
                "priority": 85,
            },
            {
                "name": "sector_overweight_warning",
                "description": "Add conditions when sector is overweight in portfolio",
                "condition": {
                    "portfolio.sector_weight": {"gt": 0.30},
                },
                "action": {
                    "pricing_adjustment": 0.05,
                    "conditions": ["sector_rebalancing_review"],
                    "reason": "Sector overweight in portfolio — pricing adjustment applied",
                },
                "priority": 65,
            },
        ],
    },
    # ---------------------------------------------------------------
    # 7. Regulatory Compliance (GCC-wide)
    # ---------------------------------------------------------------
    {
        "name": "gcc_regulatory_compliance",
        "description": "Mandatory regulatory compliance rules for GCC jurisdictions",
        "description_ar": "قواعد الامتثال التنظيمي الإلزامية لدول الخليج",
        "sector": "*",
        "rules": [
            {
                "name": "aml_kyc_mandatory",
                "description": "AML/KYC conditions for all decisions",
                "condition": {},  # Always matches
                "action": {
                    "conditions": [
                        "aml_screening_complete",
                        "kyc_verification_current",
                    ],
                    "reason": "GCC regulatory requirement — AML/KYC mandatory",
                },
                "priority": 1000,  # Highest priority — always applied
            },
            {
                "name": "large_exposure_reporting",
                "description": "Large exposure reporting threshold",
                "condition": {
                    "requested_coverage": {"gt": 10000000},
                },
                "action": {
                    "conditions": [
                        "large_exposure_report_filed",
                        "board_approval_required",
                        "central_bank_notification",
                    ],
                    "reason": "Large exposure — regulatory reporting required",
                },
                "priority": 500,
            },
        ],
    },
]


def seed_default_policies(engine: PolicyEngine | None = None) -> dict[str, int]:
    """Seed default GCC policies. Idempotent — skips existing policies.

    Returns:
        Dict with counts: {"created": N, "skipped": N, "total_rules": N}
    """
    engine = engine or get_policy_engine()
    created = 0
    skipped = 0
    total_rules = 0

    for policy_def in _DEFAULT_POLICIES:
        existing = engine.get_policy_by_name(policy_def["name"])
        if existing:
            skipped += 1
            total_rules += len(existing.rules)
            continue

        policy = engine.create_policy(
            name=policy_def["name"],
            description=policy_def.get("description", ""),
            description_ar=policy_def.get("description_ar", ""),
            sector=policy_def.get("sector", "*"),
            rules=policy_def.get("rules", []),
        )

        # Auto-activate default policies
        engine.activate_policy(policy.id)

        # Create initial version
        engine.create_version(policy.id, "Initial seed — GCC default policy")

        created += 1
        total_rules += len(policy.rules)

    summary = {
        "created": created,
        "skipped": skipped,
        "total_rules": total_rules,
    }

    logger.info(f"POLICY_SEED: {summary}")
    return summary
