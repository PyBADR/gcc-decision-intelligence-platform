import type { GccEvent, Decision, ImpactMetric } from "./types";

export const MOCK_EVENT: GccEvent = {
  id: "evt-001",
  name: "Hormuz Strait Disruption",
  name_ar: "تعطل مضيق هرمز",
  severity: 0.82,
  region: "Arabian Gulf",
  timestamp: "2026-04-08T06:30:00Z",
  status: "active",
};

export const MOCK_DECISIONS: Decision[] = [
  {
    id: "dec-001",
    title: "Activate Emergency Liquidity Facility",
    title_ar: "تفعيل تسهيل السيولة الطارئ",
    priority: "critical",
    owner: "Central Bank Treasury",
    impact_usd: "$1.2B",
    cost_usd: "$50M",
    confidence: 0.9,
    deadline: "2026-04-08T18:00:00Z",
    status: "pending",
    rationale:
      "CAR projected to breach 12% threshold within 48h. Pre-emptive facility activation prevents cascade across 4 downstream banks.",
    net_benefit_usd: "$1.15B",
    loss_inducing: false,
  },
  {
    id: "dec-002",
    title: "Suspend Non-Essential FX Settlements",
    title_ar: "تعليق تسويات العملات غير الضرورية",
    priority: "high",
    owner: "Payment Systems Dept",
    impact_usd: "$340M",
    cost_usd: "$12M",
    confidence: 0.75,
    deadline: "2026-04-09T09:00:00Z",
    status: "in_progress",
    rationale:
      "FX exposure at 2.3x normal. Temporary suspension reduces counterparty risk and frees settlement bandwidth for critical flows.",
    net_benefit_usd: "$328M",
    loss_inducing: false,
  },
  {
    id: "dec-003",
    title: "Trigger Reinsurance Treaty Clause 7.2",
    title_ar: "تفعيل بند إعادة التأمين 7.2",
    priority: "medium",
    owner: "Insurance Regulatory Unit",
    impact_usd: "$890M",
    cost_usd: "$200M",
    confidence: 0.6,
    deadline: "2026-04-10T12:00:00Z",
    status: "pending",
    rationale:
      "Claims surge projected at 340% above baseline. Treaty clause allows automatic cession above $500M aggregate.",
    net_benefit_usd: "$690M",
    loss_inducing: false,
  },
];

export const MOCK_METRICS: ImpactMetric[] = [
  { label: "Total Exposure", value: "$3.2B", delta: "+18%", trend: "up" },
  { label: "Entities Affected", value: "24", delta: "+6", trend: "up" },
  { label: "Decisions Queued", value: "3", delta: "0", trend: "flat" },
  { label: "Time to Breach", value: "47h", delta: "-12h", trend: "down" },
];
