"""Policy API — Pydantic request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any


# -------------------------------------------------------------------
# Request Schemas
# -------------------------------------------------------------------

class RuleCreateRequest(BaseModel):
    name: str = ""
    description: str = ""
    condition: dict[str, Any] = Field(default_factory=dict)
    action: dict[str, Any] = Field(default_factory=dict)
    priority: int = 0
    enabled: bool = True


class PolicyCreateRequest(BaseModel):
    name: str
    description: str = ""
    description_ar: str = ""
    sector: str = "*"
    rules: list[RuleCreateRequest] = Field(default_factory=list)


class PolicyUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    description_ar: str | None = None
    sector: str | None = None
    status: str | None = None  # active / draft / archived


class RuleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    condition: dict[str, Any] | None = None
    action: dict[str, Any] | None = None
    priority: int | None = None
    enabled: bool | None = None


class PolicyEvalRequest(BaseModel):
    """Evaluate policy rules against a context."""
    context: dict[str, Any]
    sector: str = "*"


class VersionCreateRequest(BaseModel):
    changelog: str = ""


# -------------------------------------------------------------------
# Response Schemas
# -------------------------------------------------------------------

class RuleResponse(BaseModel):
    id: str
    policy_id: str
    name: str
    description: str
    condition: dict[str, Any]
    action: dict[str, Any]
    priority: int
    enabled: bool
    created_at: str


class PolicyResponse(BaseModel):
    id: str
    name: str
    description: str
    description_ar: str
    sector: str
    version: int
    status: str
    rule_count: int
    rules: list[RuleResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str


class PolicySummaryResponse(BaseModel):
    id: str
    name: str
    description: str
    sector: str
    version: int
    status: str
    rule_count: int
    created_at: str
    updated_at: str


class VersionResponse(BaseModel):
    id: str
    policy_id: str
    version: int
    changelog: str
    created_at: str


class PolicyEvalResponse(BaseModel):
    applied: bool
    rules_matched: int
    sector: str = "*"
    total_rules_evaluated: int = 0
    blocked: bool = False
    decision_override: str | None = None
    pricing_adjustment: float | None = None
    coverage_cap_pct: float | None = None
    conditions_add: list[str] = Field(default_factory=list)
    risk_adjustment: float | None = None
    matched_rules: list[dict[str, Any]] = Field(default_factory=list)


class PolicyStatsResponse(BaseModel):
    total_policies: int
    active_policies: int
    total_rules: int
    enabled_rules: int
    total_versions: int


class SeedResponse(BaseModel):
    created: int
    skipped: int
    total_rules: int
