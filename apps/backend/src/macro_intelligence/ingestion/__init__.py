"""Macro Intelligence — Ingestion sub-package."""

from src.macro_intelligence.ingestion.data_models import (
    GCC_BASELINE_INDICATORS,
    GCC_INDICATOR_METADATA,
)
from src.macro_intelligence.ingestion.macro_data_provider import (
    MacroDataProvider,
    get_data_provider,
)

__all__ = [
    "GCC_BASELINE_INDICATORS",
    "GCC_INDICATOR_METADATA",
    "MacroDataProvider",
    "get_data_provider",
]
