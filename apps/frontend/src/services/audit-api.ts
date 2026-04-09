/**
 * Audit API — Service layer for Decision Governance Dashboard
 *
 * Connects to: /api/v1/audit/* endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API = `${API_BASE}/api/v1/audit`;
const HEADERS = { "Content-Type": "application/json", "X-API-Key": "dev" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DecisionRecord {
  id: string;
  entity_id: string;
  entity_label: string;
  portfolio_id: string | null;
  sector: string;
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
  macro_context: Record<string, any>;
  graph_context: Record<string, any>;
  portfolio_context: Record<string, any> | null;
  underwriting_context: Record<string, any>;
  explanation: string[];
  decision_summary: string;
  input_params: Record<string, any>;
  model_versions: Record<string, string>;
  status: string;
  timing_ms: number;
  created_at: string;
}

export interface AuditStats {
  total_decisions: number;
  by_decision: Record<string, number>;
  by_sector: Record<string, number>;
  average_risk_score: number;
  average_confidence: number;
  average_timing_ms: number;
  total_outcomes: number;
  total_audit_records: number;
}

export interface AuditTrailRecord {
  id: string;
  decision_id: string;
  macro_hash: string;
  graph_hash: string;
  underwriting_hash: string;
  unified_hash: string;
  input_hash: string;
  output_hash: string;
  previous_hash: string;
  chain_hash: string;
  created_at: string;
}

export interface OutcomeRecord {
  id: string;
  decision_id: string;
  outcome: string;
  severity: number;
  actual_loss_amount: number;
  notes: string;
  observed_at: string;
}

export interface ChainVerification {
  valid: boolean;
  records: number;
  breaks: Array<{ audit_id: string; decision_id: string }>;
}

export interface AuditHealth {
  status: string;
  total_decisions: number;
  total_audit_records: number;
  chain_valid: boolean;
  chain_breaks: number;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function fetchDecisions(filters: {
  entity_id?: string;
  sector?: string;
  decision?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; decisions: DecisionRecord[] }> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  const res = await fetch(`${API}/decisions?${params}`, { headers: HEADERS });
  return res.json();
}

export async function fetchDecisionDetail(id: string): Promise<DecisionRecord> {
  const res = await fetch(`${API}/decisions/${id}`, { headers: HEADERS });
  return res.json();
}

export async function fetchStatistics(): Promise<AuditStats> {
  const res = await fetch(`${API}/statistics`, { headers: HEADERS });
  return res.json();
}

export async function fetchAuditTrail(
  decisionId: string
): Promise<{ audit_records: AuditTrailRecord[] }> {
  const res = await fetch(`${API}/decisions/${decisionId}/trail`, {
    headers: HEADERS,
  });
  return res.json();
}

export async function fetchOutcomes(
  decisionId: string
): Promise<{ outcomes: OutcomeRecord[] }> {
  const res = await fetch(`${API}/decisions/${decisionId}/outcomes`, {
    headers: HEADERS,
  });
  return res.json();
}

export async function recordOutcome(body: {
  decision_id: string;
  outcome: string;
  severity?: number;
  notes?: string;
}): Promise<{ outcome_id: string; recorded: boolean }> {
  const res = await fetch(`${API}/outcomes`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function verifyChain(): Promise<ChainVerification> {
  const res = await fetch(`${API}/chain/verify`, { headers: HEADERS });
  return res.json();
}

export async function fetchAuditHealth(): Promise<AuditHealth> {
  const res = await fetch(`${API}/health`, { headers: HEADERS });
  return res.json();
}

// ---------------------------------------------------------------------------
// Decision Brain — trigger new evaluations
// ---------------------------------------------------------------------------

export async function runDecisionEval(body: {
  entity_id: string;
  sector?: string;
  portfolio_id?: string;
  requested_coverage?: number;
  indicators?: Record<string, number>;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/api/v1/decision/evaluate`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  return res.json();
}
