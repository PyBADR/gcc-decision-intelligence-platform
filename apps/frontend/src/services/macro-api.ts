/**
 * Macro API — Macro Intelligence service layer
 *
 * Connects to: /api/v1/macro/* endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const API = `${API_BASE}/api/v1/macro`;
const HEADERS = { "Content-Type": "application/json", "X-API-Key": "dev" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Standard GCC macro indicators */
export interface MacroIndicators {
  brent_crude?: number;
  interest_rate?: number;
  inflation?: number;
  gdp_growth?: number;
  fx_usd_sar?: number;
  credit_growth?: number;
  pmi?: number;
  real_estate_index?: number;
  trade_balance?: number;
  govt_spending_growth?: number;
  vix?: number;
  shipping_cost_index?: number;
  [key: string]: number | undefined;
}

export interface MacroAnalysisRequest {
  indicators: Record<string, number>;
}

export interface MacroSignal {
  name: string;
  strength: number;
  direction: "up" | "down" | "neutral";
  description: string;
  description_ar: string;
}

export interface SectorImpact {
  sector: string;
  impact_score: number;
  direction: "up" | "down" | "neutral";
  reasoning: string;
}

export interface MacroContext {
  regime: string;
  regime_confidence: number;
  risk_overlay: string;
  signals: MacroSignal[];
  sector_impacts: SectorImpact[];
  indicators_snapshot: Record<string, number>;
  audit_hash: string;
}

export interface RegimeInfo {
  regime: string;
  confidence: number;
  description: string;
}

export interface IndicatorMetadata {
  name: string;
  baseline: number;
  unit: string;
  description: string;
  description_ar: string;
  thresholds: Record<string, number>;
}

export interface DiagnosticResult {
  indicators: Record<string, any>;
  alerts: string[];
  regime: string;
  signals_count: number;
}

export interface PortfolioImpactRequest {
  indicators: Record<string, number>;
  portfolio_entities: string[];
}

export interface UnderwritingContextRequest {
  indicators: Record<string, number>;
  entity_id: string;
  sector: string;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function analyzeMacro(
  indicators: Record<string, number>
): Promise<MacroContext> {
  const res = await fetch(`${API}/analyze`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ indicators }),
  });
  if (!res.ok) {
    throw new Error(`Macro analyze failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getPortfolioImpact(
  body: PortfolioImpactRequest
): Promise<any> {
  const res = await fetch(`${API}/portfolio-impact`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Portfolio impact failed: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function getUnderwritingContext(
  body: UnderwritingContextRequest
): Promise<any> {
  const res = await fetch(`${API}/underwriting-context`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `Underwriting context failed: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function diagnoseIndicators(
  indicators: Record<string, number>
): Promise<DiagnosticResult> {
  const res = await fetch(`${API}/diagnose`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ indicators }),
  });
  if (!res.ok) {
    throw new Error(
      `Diagnose indicators failed: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function getIndicatorMetadata(): Promise<IndicatorMetadata[]> {
  const res = await fetch(`${API}/indicators`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(
      `Get indicator metadata failed: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function getRegimeTypes(): Promise<RegimeInfo[]> {
  const res = await fetch(`${API}/regimes`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Get regime types failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
