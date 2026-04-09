/**
 * Policy API — Policy Engine service layer
 *
 * Connects to: /api/v1/policy/* endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API = `${API_BASE}/api/v1/policy`;
const HEADERS = { "Content-Type": "application/json", "X-API-Key": "dev" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicySummary {
  id: string;
  name: string;
  description: string;
  sector: string;
  version: number;
  status: "active" | "draft" | "archived";
  rule_count: number;
  created_at: string;
  updated_at: string;
}

export interface Rule {
  id: string;
  policy_id: string;
  name: string;
  description: string;
  condition: Record<string, any>;
  action: Record<string, any>;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface PolicyDetail extends PolicySummary {
  description_ar: string;
  rules: Rule[];
}

export interface PolicyEvalRequest {
  context: Record<string, any>;
  sector?: string;
}

export interface MatchedRule {
  rule_id: string;
  rule_name: string;
  policy_id: string;
  policy_name: string;
  action: Record<string, any>;
}

export interface PolicyEvalResult {
  applied: boolean;
  rules_matched: number;
  sector: string;
  total_rules_evaluated: number;
  blocked: boolean;
  decision_override?: string;
  pricing_adjustment?: number;
  coverage_cap_pct?: number;
  conditions_add?: string[];
  risk_adjustment?: number;
  matched_rules: MatchedRule[];
}

export interface PolicyStats {
  total_policies: number;
  active_policies: number;
  total_rules: number;
  enabled_rules: number;
  total_versions: number;
}

export interface PolicyVersion {
  id: string;
  policy_id: string;
  version: number;
  changelog: string;
  created_at: string;
}

export interface SeedResult {
  created: number;
  skipped: number;
  total_rules: number;
}

export interface CreatePolicyBody {
  name: string;
  description?: string;
  description_ar?: string;
  sector?: string;
  rules?: Omit<Rule, "id" | "policy_id" | "created_at">[];
}

export interface CreateRuleBody {
  name: string;
  description?: string;
  condition: Record<string, any>;
  action: Record<string, any>;
  priority?: number;
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function qs(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, v);
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, ...init });
  if (!res.ok) {
    throw new Error(`Policy API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Policy CRUD
// ---------------------------------------------------------------------------

export async function listPolicies(
  filters?: { sector?: string; status?: string }
): Promise<PolicySummary[]> {
  return request<PolicySummary[]>(
    `${API}/policies${qs(filters ?? {})}`
  );
}

export async function getPolicy(id: string): Promise<PolicyDetail> {
  return request<PolicyDetail>(`${API}/policies/${id}`);
}

export async function createPolicy(
  body: CreatePolicyBody
): Promise<PolicyDetail> {
  return request<PolicyDetail>(`${API}/policies`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updatePolicy(
  id: string,
  updates: Partial<CreatePolicyBody>
): Promise<PolicyDetail> {
  return request<PolicyDetail>(`${API}/policies/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function activatePolicy(id: string): Promise<PolicyDetail> {
  return request<PolicyDetail>(`${API}/policies/${id}/activate`, {
    method: "POST",
  });
}

export async function archivePolicy(id: string): Promise<PolicyDetail> {
  return request<PolicyDetail>(`${API}/policies/${id}/archive`, {
    method: "POST",
  });
}

export async function deletePolicy(
  id: string
): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`${API}/policies/${id}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Rule CRUD
// ---------------------------------------------------------------------------

export async function addRule(
  policyId: string,
  rule: CreateRuleBody
): Promise<Rule> {
  return request<Rule>(`${API}/policies/${policyId}/rules`, {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export async function updateRule(
  ruleId: string,
  updates: Partial<CreateRuleBody>
): Promise<{ updated: boolean }> {
  return request<{ updated: boolean }>(`${API}/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteRule(
  ruleId: string
): Promise<{ deleted: boolean }> {
  return request<{ deleted: boolean }>(`${API}/rules/${ruleId}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

export async function evaluatePolicies(
  req: PolicyEvalRequest
): Promise<PolicyEvalResult> {
  return request<PolicyEvalResult>(`${API}/evaluate`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

export async function createVersion(
  policyId: string,
  changelog: string
): Promise<PolicyVersion> {
  return request<PolicyVersion>(`${API}/policies/${policyId}/versions`, {
    method: "POST",
    body: JSON.stringify({ changelog }),
  });
}

export async function listVersions(
  policyId: string
): Promise<PolicyVersion[]> {
  return request<PolicyVersion[]>(`${API}/policies/${policyId}/versions`);
}

// ---------------------------------------------------------------------------
// Stats / Health / Seed
// ---------------------------------------------------------------------------

export async function getPolicyStats(): Promise<PolicyStats> {
  return request<PolicyStats>(`${API}/statistics`);
}

export async function seedPolicies(): Promise<SeedResult> {
  return request<SeedResult>(`${API}/seed`, { method: "POST" });
}

export async function getPolicyHealth(): Promise<{
  status: string;
  stats: PolicyStats;
}> {
  return request<{ status: string; stats: PolicyStats }>(`${API}/health`);
}
