/**
 * Shared TypeScript types for the GCC Decision Intelligence Platform.
 * These mirror the backend Pydantic models in src/models/canonical.py.
 */

// ---- Core ----

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Provenance {
  source_type: string;
  source_name: string;
  source_id?: string;
  ingested_at?: string;
}

// ---- Geography ----

export interface Region {
  id: string;
  label: string;
  label_ar?: string;
  lat: number;
  lng: number;
  layer: string;
}

// ---- Infrastructure ----

export interface Airport {
  id: string;
  label: string;
  label_ar?: string;
  iata?: string;
  lat: number;
  lng: number;
  asset_class: "airport";
}

export interface Port {
  id: string;
  label: string;
  label_ar?: string;
  lat: number;
  lng: number;
  asset_class: "seaport";
}

export interface Corridor {
  id: string;
  label: string;
  label_ar?: string;
  corridor_type: "air_corridor" | "maritime_corridor";
  lat: number;
  lng: number;
}

// ---- Events ----

export interface Event {
  id: string;
  title: string;
  event_type: string;
  severity_score: number;
  lat?: number;
  lng?: number;
  region_id?: string;
  confidence?: number;
  hours_ago?: number;
}

// ---- Transport ----

export interface Flight {
  id: string;
  flight_number: string;
  status: "scheduled" | "en_route" | "landed" | "cancelled" | "diverted";
  origin_airport_id: string;
  destination_airport_id: string;
  latitude: number;
  longitude: number;
}

export interface Vessel {
  id: string;
  name: string;
  mmsi: string;
  vessel_type: "tanker" | "container" | "cargo" | "bulk";
  latitude: number;
  longitude: number;
  speed_knots: number;
  heading: number;
  destination_port_id?: string;
}

// ---- Scoring ----

export interface ScoreExplanation {
  factor: string;
  weight: number;
  contribution: number;
  detail: string;
}

export interface RiskBreakdown {
  node_id: string;
  asset_class: string;
  risk_score: number;
  geopolitical: number;
  proximity: number;
  network: number;
  logistics: number;
  temporal: number;
  uncertainty: number;
  weights: number[];
  dominant_factor: string;
  threat_contributions: Record<string, unknown>[];
}

export interface DisruptionBreakdown {
  node_id: string;
  disruption_score: number;
  risk_component: number;
  congestion_component: number;
  accessibility_loss: number;
  reroute_penalty: number;
  boundary_restriction: number;
  dominant_factor: string;
}

// ---- Scenario ----

export interface ScenarioTemplate {
  id: string;
  title: string;
  title_ar?: string;
  description: string;
  scenario_type: string;
  severity_range: [number, number];
  shocks: ScenarioShock[];
}

export interface ScenarioShock {
  target_entity_id: string;
  shock_type: string;
  severity_score: number;
  description: string;
}

export interface ScenarioResult {
  scenario_id: string;
  title: string;
  system_stress: number;
  total_economic_loss_usd: number;
  top_impacted_entities: string[];
  narrative: string;
  recommendations: string[];
  impacts: ScenarioImpact[];
}

export interface ScenarioImpact {
  entity_id: string;
  entity_type: string;
  baseline: number;
  post_scenario: number;
  delta: number;
  operational_impact: string;
  factors: ScoreExplanation[];
}

// ---- Insurance ----

export interface InsuranceExposure {
  portfolio_id: string;
  exposure_score: number;
  classification: string;
  tiv_contribution: number;
  route_dependency_contribution: number;
  region_risk_contribution: number;
  claims_elasticity_contribution: number;
  recommendations: string[];
}

export interface ClaimsSurge {
  entity_id: string;
  surge_score: number;
  classification: string;
  claims_uplift_pct: number;
  estimated_claims_delta_usd: number;
}

export interface UnderwritingWatchItem {
  entity_id: string;
  priority: "IMMEDIATE" | "URGENT" | "ELEVATED" | "ROUTINE";
  risk_score: number;
  exposure_score: number;
  surge_score: number;
  recommended_action: string;
  triggers: { type: string; value: number; threshold: number; detail: string }[];
}

export interface SeverityProjection {
  horizon: string;
  projected_severity: number;
  confidence: number;
  classification: string;
}

// ---- Decision Output ----

export interface DecisionOutput {
  decision: {
    what_happened: Record<string, unknown>;
    what_is_the_impact: Record<string, unknown>;
    what_is_affected: Record<string, unknown>;
    how_big_is_the_risk: Record<string, unknown>;
    recommended_actions: string[];
  };
  system_state: {
    total_stress: number;
    stress_classification: string;
    system_energy: number;
    confidence: number;
    propagation_stage: string;
    dominant_sector: string;
  };
  top_affected: {
    node_id: string;
    label: string;
    risk: number;
    disruption: number;
    sector: string;
  }[];
  sector_impacts: Record<string, number>;
  insurance_impact: {
    flagged_entities: ClaimsSurge[];
    system_stress: number;
  } | null;
  risk_vector: number[];
}

// ---- System ----

export interface SystemStress {
  total_stress: number;
  confidence: number;
  energy: number;
  stress_classification: string;
  propagation_stage: string;
  dominant_sector: string;
  recommendations: string[];
}

// ---- Graph ----

export interface GraphNode {
  id: string;
  label: string;
  label_ar?: string;
  layer: string;
  lat: number;
  lng: number;
  asset_class?: string;
  risk?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  polarity: number;
  category: string;
}

// ---- Globe Layers ----

export type GlobeLayerType =
  | "flights"
  | "vessels"
  | "conflicts"
  | "heatmap"
  | "arcs"
  | "infrastructure";

export interface GlobeLayerConfig {
  type: GlobeLayerType;
  visible: boolean;
  opacity: number;
}
