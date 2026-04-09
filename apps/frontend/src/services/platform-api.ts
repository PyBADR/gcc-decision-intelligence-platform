/**
 * Platform API — Health, version, and cross-cutting concerns
 *
 * Connects to: /version, /health, /simulate endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json", "X-API-Key": "dev" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformVersion {
  service: string;
  model_version: string;
  api_version: string;
  scenarios: string[];
  scenario_ids: string[];
  architecture_layers: string[];
  risk_levels: string[];
}

export interface HealthStatus {
  status: string;
  timestamp: string;
}

export interface SimulateRequest {
  scenario_id: string;
  severity: number;
  horizon_hours?: number;
}

export interface SimulateResult {
  scenario_id: string;
  severity: number;
  horizon_hours: number;
  impacts: Record<string, any>;
  recommendations: string[];
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getVersion(): Promise<PlatformVersion> {
  const res = await fetch(`${API_BASE}/version`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Get version failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function simulate(
  body: SimulateRequest
): Promise<SimulateResult> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Simulate failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
