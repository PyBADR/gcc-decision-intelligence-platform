export interface GccEvent {
  id: string;
  name: string;
  name_ar: string;
  severity: number;
  region: string;
  timestamp: string;
  status: "active" | "monitoring" | "resolved";
}

export interface Decision {
  id: string;
  title: string;
  title_ar: string;
  priority: "critical" | "high" | "medium";
  owner: string;
  impact_usd: string;
  cost_usd: string;
  confidence: number;
  deadline: string;
  status: "pending" | "in_progress" | "executed";
  rationale: string;
  net_benefit_usd: string;
  loss_inducing: boolean;
}

export interface ImpactMetric {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
}
