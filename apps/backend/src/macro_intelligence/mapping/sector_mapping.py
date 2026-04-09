"""Macro Intelligence — Sector Mapping Engine.

Maps macro signals and regime to sector-level impact scores.
GCC-specific: understands oil dependency, peg dynamics, and
infrastructure-heavy economies.

Impact scores: -1.0 (severe negative) to +1.0 (strong positive).
Deterministic — same signals + regime always produce same mappings.
"""

from __future__ import annotations

from src.macro_intelligence.schemas.macro_schemas import (
    MacroSignal,
    SectorImpact,
    SignalDirection,
    RegimeType,
)


# ---------------------------------------------------------------------------
# Signal → Sector impact matrix
# ---------------------------------------------------------------------------

# Each entry: signal_name → list of (sector, base_impact, reasoning)
_SIGNAL_SECTOR_MAP: dict[str, list[tuple[str, float, str]]] = {
    # ── Oil signals ───────────────────────────────────────────────────
    "oil_price_surge": [
        ("energy", +0.85, "Direct revenue boost for energy sector"),
        ("government", +0.60, "Fiscal surplus increases government spending capacity"),
        ("infrastructure", +0.40, "Government capex increases with oil revenues"),
        ("banking", +0.30, "Improved sovereign credit, deposit growth"),
        ("maritime", +0.20, "Higher cargo values, shipping demand stable"),
        ("insurance", +0.15, "Larger asset values to insure"),
    ],
    "oil_price_collapse": [
        ("energy", -0.90, "Direct revenue collapse for energy sector"),
        ("government", -0.75, "Fiscal deficit, budget cuts imminent"),
        ("banking", -0.50, "Sovereign credit stress, NPL risk rises"),
        ("infrastructure", -0.45, "Project delays and cancellations"),
        ("insurance", -0.30, "Lower premium volumes, sovereign risk"),
        ("maritime", -0.20, "Reduced trade volumes"),
        ("logistics", -0.15, "Lower throughput"),
    ],
    "oil_price_moderate_decline": [
        ("energy", -0.50, "Revenue pressure on energy sector"),
        ("government", -0.35, "Fiscal tightening likely"),
        ("banking", -0.20, "Moderate credit tightening"),
    ],

    # ── Interest rate signals ─────────────────────────────────────────
    "interest_rate_hike": [
        ("banking", +0.40, "Net interest margin expansion"),
        ("insurance", +0.25, "Investment income boost on reserves"),
        ("infrastructure", -0.50, "Higher financing costs, project viability drops"),
        ("energy", -0.15, "Higher exploration financing costs"),
        ("fintech", -0.35, "Tighter funding for startups"),
        ("logistics", -0.10, "Higher working capital costs"),
    ],
    "ultra_low_rates": [
        ("banking", -0.40, "Net interest margin compression"),
        ("insurance", -0.35, "Low investment yields on reserves"),
        ("infrastructure", +0.45, "Cheap financing enables projects"),
        ("fintech", +0.30, "Abundant capital for startups"),
    ],

    # ── Inflation signals ─────────────────────────────────────────────
    "high_inflation": [
        ("insurance", -0.65, "Claims inflation, reserve inadequacy risk"),
        ("banking", -0.20, "Real returns eroded, NPL pressure"),
        ("energy", +0.10, "Nominal revenue growth from price pass-through"),
        ("logistics", -0.30, "Cost escalation across supply chain"),
        ("infrastructure", -0.25, "Construction cost overruns"),
    ],
    "deflation_risk": [
        ("energy", -0.40, "Demand weakness signals lower volumes"),
        ("banking", -0.30, "Asset value decline, deflation trap risk"),
        ("insurance", +0.10, "Lower claims costs in short term"),
    ],

    # ── GDP signals ───────────────────────────────────────────────────
    "strong_growth": [
        ("banking", +0.50, "Loan demand growth, low NPLs"),
        ("insurance", +0.40, "Premium growth with economic expansion"),
        ("infrastructure", +0.55, "Construction boom, new projects"),
        ("energy", +0.30, "Domestic demand supports production"),
        ("logistics", +0.45, "Trade and throughput expansion"),
        ("fintech", +0.50, "Transaction volume and adoption growth"),
        ("maritime", +0.35, "Port throughput increases"),
    ],
    "recession_signal": [
        ("banking", -0.70, "NPL surge, credit losses, liquidity stress"),
        ("insurance", -0.50, "Premium contraction, investment losses"),
        ("infrastructure", -0.60, "Project freezes, contractor defaults"),
        ("energy", -0.35, "Demand destruction"),
        ("logistics", -0.45, "Volume collapse"),
        ("fintech", -0.55, "Transaction decline, funding freeze"),
        ("maritime", -0.40, "Trade contraction"),
        ("government", -0.30, "Revenue shortfall, stimulus pressure"),
    ],

    # ── PMI signals ───────────────────────────────────────────────────
    "pmi_contraction": [
        ("logistics", -0.40, "Manufacturing output decline reduces freight"),
        ("energy", -0.20, "Industrial demand weakness"),
        ("banking", -0.15, "Working capital demand softening"),
    ],
    "pmi_strong_expansion": [
        ("logistics", +0.35, "Manufacturing output growth boosts freight"),
        ("energy", +0.20, "Industrial demand supports consumption"),
        ("banking", +0.20, "Working capital demand rising"),
    ],

    # ── Credit signals ────────────────────────────────────────────────
    "credit_boom": [
        ("banking", -0.30, "Overheating risk, future NPL buildup"),
        ("insurance", +0.15, "More insurable assets being financed"),
        ("infrastructure", +0.25, "Easy financing enables projects"),
    ],
    "credit_crunch": [
        ("banking", -0.50, "Lending freeze, liquidity crisis"),
        ("infrastructure", -0.55, "No project financing available"),
        ("fintech", -0.40, "Capital markets dry up"),
    ],

    # ── Global risk ───────────────────────────────────────────────────
    "global_fear": [
        ("banking", -0.35, "Capital flight, funding pressure"),
        ("insurance", -0.30, "Investment portfolio losses"),
        ("energy", -0.25, "Demand uncertainty"),
        ("fintech", -0.40, "Risk aversion hits growth stocks"),
        ("maritime", -0.20, "Trade uncertainty"),
    ],

    # ── FX peg stress ─────────────────────────────────────────────────
    "fx_peg_stress": [
        ("banking", -0.55, "Currency defense drains reserves, rate spikes"),
        ("government", -0.50, "Reserve depletion, credibility at stake"),
        ("insurance", -0.30, "FX mismatch risk on reserves"),
        ("energy", -0.15, "Revenue uncertainty in local terms"),
    ],

    # ── Shipping ──────────────────────────────────────────────────────
    "shipping_cost_spike": [
        ("maritime", -0.50, "Disruption and rerouting costs"),
        ("logistics", -0.55, "Supply chain cost escalation"),
        ("insurance", -0.40, "Marine hull and cargo claims surge"),
        ("energy", -0.15, "Transport cost increase for exports"),
    ],

    # ── Real estate ───────────────────────────────────────────────────
    "real_estate_bubble": [
        ("banking", -0.35, "Concentrated exposure risk, future NPLs"),
        ("insurance", +0.15, "Higher property values to insure"),
        ("infrastructure", +0.20, "Construction demand stays high"),
    ],
    "real_estate_crash": [
        ("banking", -0.65, "Mortgage defaults, collateral value collapse"),
        ("insurance", -0.25, "Lower insured values, construction claims"),
        ("infrastructure", -0.50, "Construction halt, contractor failures"),
    ],

    # ── Compound signals ──────────────────────────────────────────────
    "stagflation_risk": [
        ("banking", -0.60, "Rising costs + falling demand = NPL crisis"),
        ("insurance", -0.55, "Claims inflation + premium stagnation"),
        ("energy", -0.25, "Demand weakness despite price pressure"),
        ("infrastructure", -0.45, "Cost overruns + project freezes"),
        ("government", -0.40, "Fiscal squeeze from both sides"),
    ],
    "fiscal_squeeze": [
        ("government", -0.70, "Revenue-spending gap widens"),
        ("infrastructure", -0.55, "Government project cuts"),
        ("banking", -0.30, "Reduced government deposits"),
        ("energy", -0.20, "Budget-driven investment cuts"),
    ],
}


# ---------------------------------------------------------------------------
# Regime → sector bias overlays
# ---------------------------------------------------------------------------

_REGIME_SECTOR_BIAS: dict[RegimeType, dict[str, float]] = {
    RegimeType.EXPANSION: {
        "banking": +0.10,
        "insurance": +0.08,
        "infrastructure": +0.12,
        "logistics": +0.08,
        "fintech": +0.10,
    },
    RegimeType.TIGHTENING: {
        "banking": +0.05,
        "infrastructure": -0.10,
        "fintech": -0.08,
    },
    RegimeType.INFLATIONARY: {
        "insurance": -0.10,
        "logistics": -0.05,
        "banking": -0.05,
    },
    RegimeType.RECESSION: {
        "banking": -0.15,
        "insurance": -0.10,
        "infrastructure": -0.12,
        "logistics": -0.10,
        "fintech": -0.12,
    },
    RegimeType.OIL_BOOM: {
        "energy": +0.15,
        "government": +0.12,
        "infrastructure": +0.10,
        "banking": +0.08,
    },
    RegimeType.OIL_SHOCK: {
        "energy": -0.15,
        "government": -0.12,
        "banking": -0.08,
        "infrastructure": -0.10,
    },
    RegimeType.NEUTRAL: {},
}


class SectorMappingEngine:
    """Maps macro signals and regime to sector-level impact scores.

    Combines signal-driven impacts with regime-level sector biases.
    Aggregates multiple signals per sector using weighted averaging.
    """

    def map(
        self,
        signals: list[MacroSignal],
        regime: RegimeType,
    ) -> list[SectorImpact]:
        """Map signals + regime to sector impacts.

        Args:
            signals: Active macro signals from SignalEngine.
            regime: Current macro regime from RegimeDetector.

        Returns:
            List of SectorImpact sorted by absolute impact descending.
        """
        # Accumulate per-sector: list of (impact, weight, reasoning, signal_name)
        sector_data: dict[str, list[tuple[float, float, str, str]]] = {}

        # ── Signal-driven impacts ──────────────────────────────────────
        for signal in signals:
            mappings = _SIGNAL_SECTOR_MAP.get(signal.name, [])
            for sector, base_impact, reasoning in mappings:
                if sector not in sector_data:
                    sector_data[sector] = []
                # Scale impact by signal strength
                scaled = base_impact * signal.strength
                sector_data[sector].append(
                    (scaled, signal.strength, reasoning, signal.name)
                )

        # ── Regime bias overlay ────────────────────────────────────────
        regime_biases = _REGIME_SECTOR_BIAS.get(regime, {})
        for sector, bias in regime_biases.items():
            if sector not in sector_data:
                sector_data[sector] = []
            sector_data[sector].append(
                (bias, 0.5, f"Regime '{regime.value}' sector bias", f"regime_{regime.value}")
            )

        # ── Aggregate per sector ───────────────────────────────────────
        results: list[SectorImpact] = []
        for sector, entries in sector_data.items():
            if not entries:
                continue

            # Weighted average by signal strength
            total_weight = sum(abs(w) for _, w, _, _ in entries)
            if total_weight == 0:
                continue

            weighted_impact = sum(
                impact * abs(weight) for impact, weight, _, _ in entries
            ) / total_weight
            weighted_impact = max(-1.0, min(weighted_impact, 1.0))

            # Collect contributing signals (unique)
            contributing = list(dict.fromkeys(
                name for _, _, _, name in entries
            ))

            # Primary reasoning (highest absolute impact)
            primary = max(entries, key=lambda e: abs(e[0]))

            # Direction
            if weighted_impact > 0.02:
                direction = SignalDirection.UP
            elif weighted_impact < -0.02:
                direction = SignalDirection.DOWN
            else:
                direction = SignalDirection.NEUTRAL

            results.append(SectorImpact(
                sector=sector,
                impact_score=round(weighted_impact, 4),
                direction=direction,
                contributing_signals=contributing,
                reasoning=primary[2],
            ))

        # Sort by absolute impact descending
        results.sort(key=lambda s: -abs(s.impact_score))
        return results
