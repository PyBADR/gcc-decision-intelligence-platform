"""Macro Intelligence Layer | طبقة الذكاء الكلي.

Transforms macroeconomic indicators into actionable intelligence
that feeds Graph, Portfolio, and Underwriting layers.

Pipeline:
    External Data → Ingestion → Signal Engine → Regime Classification
    → Sector Mapping → Macro Orchestrator → Decision Layers
"""

from src.macro_intelligence.orchestrator.macro_orchestrator import (
    MacroOrchestrator,
    get_orchestrator,
)
from src.macro_intelligence.schemas.macro_schemas import (
    MacroIndicator,
    MacroSignal,
    SectorImpact,
    MacroContext,
    MacroPortfolioOverlay,
    MacroUnderwritingOverlay,
)

__all__ = [
    "MacroOrchestrator",
    "get_orchestrator",
    "MacroIndicator",
    "MacroSignal",
    "SectorImpact",
    "MacroContext",
    "MacroPortfolioOverlay",
    "MacroUnderwritingOverlay",
]
