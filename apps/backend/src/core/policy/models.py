"""Policy Engine — Data models.

Tables:
  policies         — named policy sets with sector scope and versioning
  rules            — condition/action pairs within a policy
  policy_versions  — changelog for each policy version

Rule condition format (JSON):
  {"macro.regime": "inflationary", "risk_score": {"gt": 0.6}}

Rule action format (JSON):
  {"decision": "REJECTED", "pricing_adjustment": 0.20, "conditions": [...]}

Operators: eq (default), gt, gte, lt, lte, ne, in, not_in, contains
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class PolicyStatus(str, Enum):
    ACTIVE = "active"
    DRAFT = "draft"
    ARCHIVED = "archived"


@dataclass
class Rule:
    """A single condition → action rule within a policy."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    policy_id: str = ""
    name: str = ""
    description: str = ""
    condition: dict[str, Any] = field(default_factory=dict)
    action: dict[str, Any] = field(default_factory=dict)
    priority: int = 0          # Higher = evaluated first
    enabled: bool = True
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "policy_id": self.policy_id,
            "name": self.name,
            "description": self.description,
            "condition": self.condition,
            "action": self.action,
            "priority": self.priority,
            "enabled": self.enabled,
            "created_at": self.created_at,
        }


@dataclass
class RuleAction:
    """Resolved action from a matched rule."""
    rule_id: str
    rule_name: str
    decision_override: str | None = None      # APPROVED / CONDITIONAL / REJECTED
    pricing_adjustment: float | None = None    # Additive factor (e.g. 0.20 = +20%)
    coverage_cap_pct: float | None = None      # Max coverage % (e.g. 0.50 = 50%)
    conditions_add: list[str] = field(default_factory=list)
    risk_adjustment: float | None = None       # Additive risk score adjustment
    block: bool = False                        # Hard block — no override possible
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "reason": self.reason,
        }
        if self.decision_override:
            d["decision_override"] = self.decision_override
        if self.pricing_adjustment is not None:
            d["pricing_adjustment"] = self.pricing_adjustment
        if self.coverage_cap_pct is not None:
            d["coverage_cap_pct"] = self.coverage_cap_pct
        if self.conditions_add:
            d["conditions_add"] = self.conditions_add
        if self.risk_adjustment is not None:
            d["risk_adjustment"] = self.risk_adjustment
        if self.block:
            d["block"] = True
        return d


@dataclass
class Policy:
    """A named set of rules with sector scope."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    description_ar: str = ""
    sector: str = "*"           # "*" = all sectors
    version: int = 1
    status: PolicyStatus = PolicyStatus.ACTIVE
    rules: list[Rule] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self, include_rules: bool = True) -> dict[str, Any]:
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "description_ar": self.description_ar,
            "sector": self.sector,
            "version": self.version,
            "status": self.status.value,
            "rule_count": len(self.rules),
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if include_rules:
            d["rules"] = [r.to_dict() for r in self.rules]
        return d


@dataclass
class PolicyVersion:
    """Version history entry for a policy."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    policy_id: str = ""
    version: int = 1
    changelog: str = ""
    snapshot: str = ""          # JSON snapshot of rules at this version
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "policy_id": self.policy_id,
            "version": self.version,
            "changelog": self.changelog,
            "created_at": self.created_at,
        }
