/**
 * Decision API — Unified Decision Brain service layer
 *
 * Connects to: /api/v1/decision/* endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API = `${API_BASE}/api/v1/decision`;
const HEADERS = { "Content-Type": "application/json", "X-API-Key": "dev" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnifiedDecisionRequest {
  entity_id: string;
  sector?: string;
  portfolio_id?: string;
  portfolio_entities?: string[];
  requested_coverage?: number;
  indicators?: Record<string, number>;
  historical_signals?: Record<string, any>[];
  depth?: "quick" | "standard" | "deep";
}

export interface DecisionSection {
  decision: "APPROVED" | "CONDITIONAL" | "REJECTED";
  risk_score: number;
  risk_level: string;
  confidence: number;
  pricing: {
    adjustment?: string;
    factor?: number;
    premium_impact?: string;
    macro_impact?: string;
  };
  coverage: {
    requested?: number;
    approved_limit?: number;
    utilization_pct?: number;
  };
  conditions: string[];
}

export interface DecisionResult {
  entity_id: string;
  entity_label: string;
  sector: string;
  decision: DecisionSection;
  macro: Record<string, any>;
  graph: Record<string, any>;
  portfolio: Record<string, any> | null;
  underwriting: Record<string, any>;
  policy: Record<string, any>;
  explanation: string[];
  audit: Record<string, any>;
  timing: Record<string, number>;
  decision_summary: string;
}

export interface BatchEntity {
  entity_id: string;
  sector?: string;
  requested_coverage?: number;
}

export interface BatchRequest {
  entities: BatchEntity[];
  indicators?: Record<string, number>;
  portfolio_id?: string;
}

export interface BatchResult {
  batch_size: number;
  shared_macro_regime: string;
  summary: Record<string, any>;
  evaluations: DecisionResult[];
}

export interface Capabilities {
  layers: string[];
  operators: string[];
  risk_levels: string[];
  regimes: string[];
  sectors: string[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function evaluateDecision(
  req: UnifiedDecisionRequest
): Promise<DecisionResult> {
  const res = await fetch(`${API}/evaluate`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Decision evaluate failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function evaluateBatch(
  req: BatchRequest
): Promise<BatchResult> {
  const res = await fetch(`${API}/batch`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`Batch evaluate failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function quickEvaluate(
  entityId: string
): Promise<DecisionResult> {
  const res = await fetch(`${API}/quick/${encodeURIComponent(entityId)}`, {
    headers: HEADERS,
  });
  if (!res.ok) {
    throw new Error(`Quick evaluate failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getCapabilities(): Promise<Capabilities> {
  const res = await fetch(`${API}/capabilities`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Get capabilities failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
