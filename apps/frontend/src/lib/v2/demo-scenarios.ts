import type { GccEvent, Decision, ImpactMetric } from "./types";

export interface DemoScenario {
  event: GccEvent;
  metrics: ImpactMetric[];
  decisions: Decision[];
}

export type ScenarioKey = "hormuz" | "oilCrash" | "bankingCrisis" | "claimsSurge" | "fintechFreeze";

export const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  hormuz: "Hormuz Disruption",
  oilCrash: "Oil Price Crash",
  bankingCrisis: "Banking Crisis",
  claimsSurge: "Insurance Claims Surge",
  fintechFreeze: "Fintech Funding Freeze",
};

export const SCENARIOS: Record<ScenarioKey, DemoScenario> = {
  // ── Scenario 1: Hormuz (existing) ───────────────────────────────
  hormuz: {
    event: {
      id: "evt-001",
      name: "Hormuz Strait Disruption",
      name_ar: "تعطل مضيق هرمز",
      severity: 0.82,
      region: "Arabian Gulf",
      timestamp: "2026-04-08T06:30:00Z",
      status: "active",
    },
    metrics: [
      { label: "Total Exposure", value: "$3.2B", delta: "+18%", trend: "up" },
      { label: "Entities Affected", value: "24", delta: "+6", trend: "up" },
      { label: "Decisions Queued", value: "3", delta: "0", trend: "flat" },
      { label: "Time to Breach", value: "47h", delta: "-12h", trend: "down" },
    ],
    decisions: [
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
    ],
  },

  // ── Scenario 2: Oil Price Crash ─────────────────────────────────
  oilCrash: {
    event: {
      id: "evt-002",
      name: "Oil Price Crash — Brent Below $40",
      name_ar: "انهيار أسعار النفط — برنت تحت 40$",
      severity: 0.91,
      region: "GCC",
      timestamp: "2026-04-08T09:15:00Z",
      status: "active",
    },
    metrics: [
      { label: "Total Exposure", value: "$7.8B", delta: "+42%", trend: "up" },
      { label: "Entities Affected", value: "61", delta: "+19", trend: "up" },
      { label: "Decisions Queued", value: "4", delta: "+1", trend: "up" },
      { label: "Time to Breach", value: "18h", delta: "-30h", trend: "down" },
    ],
    decisions: [
      {
        id: "dec-oil-001",
        title: "Deploy Sovereign Wealth Stabilization Fund",
        title_ar: "تفعيل صندوق الثروة السيادي للاستقرار",
        priority: "critical",
        owner: "Ministry of Finance",
        impact_usd: "$4.5B",
        cost_usd: "$800M",
        confidence: 0.85,
        deadline: "2026-04-08T14:00:00Z",
        status: "pending",
        rationale:
          "Fiscal deficit projected at 9.2% of GDP if unmitigated. Fund drawdown stabilizes bond markets and prevents rating downgrade.",
        net_benefit_usd: "$3.7B",
        loss_inducing: false,
      },
      {
        id: "dec-oil-002",
        title: "Freeze Capital Expenditure Above $100M",
        title_ar: "تجميد الإنفاق الرأسمالي فوق 100 مليون$",
        priority: "critical",
        owner: "Budget Authority",
        impact_usd: "$2.1B",
        cost_usd: "$0",
        confidence: 0.92,
        deadline: "2026-04-08T16:00:00Z",
        status: "pending",
        rationale:
          "Revenue shortfall of $6.3B projected. Immediate capex freeze preserves fiscal buffer and avoids emergency borrowing.",
        net_benefit_usd: "$2.1B",
        loss_inducing: false,
      },
      {
        id: "dec-oil-003",
        title: "Accelerate Non-Oil Revenue Collection",
        title_ar: "تسريع تحصيل الإيرادات غير النفطية",
        priority: "high",
        owner: "Revenue Authority",
        impact_usd: "$1.8B",
        cost_usd: "$120M",
        confidence: 0.7,
        deadline: "2026-04-10T09:00:00Z",
        status: "pending",
        rationale:
          "VAT and fee collection at 78% of target. Accelerated enforcement closes $1.8B gap within 60 days.",
        net_benefit_usd: "$1.68B",
        loss_inducing: false,
      },
      {
        id: "dec-oil-004",
        title: "Hedge Remaining Oil Exports — Q3 Futures",
        title_ar: "تحوط صادرات النفط المتبقية — عقود الربع الثالث",
        priority: "medium",
        owner: "National Oil Company",
        impact_usd: "$950M",
        cost_usd: "$310M",
        confidence: 0.55,
        deadline: "2026-04-11T12:00:00Z",
        status: "pending",
        rationale:
          "Current spot at $38. Q3 futures at $44 offer $6/bbl premium. Hedging 40% of exports locks in floor revenue.",
        net_benefit_usd: "$640M",
        loss_inducing: false,
      },
    ],
  },

  // ── Scenario 3: Banking Crisis ──────────────────────────────────
  bankingCrisis: {
    event: {
      id: "evt-003",
      name: "Systemic Banking Stress — Tier 1 Breach",
      name_ar: "أزمة مصرفية نظامية — اختراق الشريحة الأولى",
      severity: 0.95,
      region: "GCC",
      timestamp: "2026-04-08T03:00:00Z",
      status: "active",
    },
    metrics: [
      { label: "Total Exposure", value: "$12.4B", delta: "+67%", trend: "up" },
      { label: "Entities Affected", value: "38", delta: "+14", trend: "up" },
      { label: "Decisions Queued", value: "3", delta: "+2", trend: "up" },
      { label: "Time to Breach", value: "8h", delta: "-22h", trend: "down" },
    ],
    decisions: [
      {
        id: "dec-bank-001",
        title: "Emergency Capital Injection — Top 3 Banks",
        title_ar: "ضخ رأس مال طارئ — أكبر 3 بنوك",
        priority: "critical",
        owner: "Central Bank Governor",
        impact_usd: "$8.2B",
        cost_usd: "$3.5B",
        confidence: 0.88,
        deadline: "2026-04-08T11:00:00Z",
        status: "pending",
        rationale:
          "Tier 1 capital ratio at 7.8% vs 10.5% minimum. Without injection, 3 systemically important banks trigger resolution within 24h.",
        net_benefit_usd: "$4.7B",
        loss_inducing: false,
      },
      {
        id: "dec-bank-002",
        title: "Activate Deposit Guarantee Ceiling Increase",
        title_ar: "رفع سقف ضمان الودائع",
        priority: "critical",
        owner: "Deposit Protection Board",
        impact_usd: "$2.8B",
        cost_usd: "$0",
        confidence: 0.95,
        deadline: "2026-04-08T08:00:00Z",
        status: "in_progress",
        rationale:
          "Retail deposit outflow at $1.2B/day. Raising guarantee from $250K to $1M stops panic withdrawal and restores confidence.",
        net_benefit_usd: "$2.8B",
        loss_inducing: false,
      },
      {
        id: "dec-bank-003",
        title: "Suspend Interbank Lending Rate Floor",
        title_ar: "تعليق حد أدنى سعر الإقراض بين البنوك",
        priority: "high",
        owner: "Monetary Policy Committee",
        impact_usd: "$1.9B",
        cost_usd: "$450M",
        confidence: 0.72,
        deadline: "2026-04-09T06:00:00Z",
        status: "pending",
        rationale:
          "Interbank rate spiked to 8.4%. Suspending floor allows emergency overnight lending at 2.5%, preventing liquidity freeze.",
        net_benefit_usd: "$1.45B",
        loss_inducing: false,
      },
    ],
  },

  // ── Scenario 4: Insurance Claims Surge ──────────────────────────
  claimsSurge: {
    event: {
      id: "evt-004",
      name: "Insurance Claims Surge — Cat Event",
      name_ar: "طفرة مطالبات التأمين — حدث كارثي",
      severity: 0.74,
      region: "GCC",
      timestamp: "2026-04-08T07:45:00Z",
      status: "active",
    },
    metrics: [
      { label: "Total Exposure", value: "$5.1B", delta: "+38%", trend: "up" },
      { label: "Entities Affected", value: "47", delta: "+22", trend: "up" },
      { label: "Decisions Queued", value: "3", delta: "+1", trend: "up" },
      { label: "Time to Breach", value: "32h", delta: "-8h", trend: "down" },
    ],
    decisions: [
      {
        id: "dec-ins-001",
        title: "Invoke Catastrophe Excess-of-Loss Treaty",
        title_ar: "تفعيل اتفاقية إعادة التأمين الكارثي",
        priority: "critical",
        owner: "Insurance Regulatory Authority",
        impact_usd: "$3.2B",
        cost_usd: "$180M",
        confidence: 0.87,
        deadline: "2026-04-08T15:00:00Z",
        status: "pending",
        rationale:
          "Claims backlog at 12,400 and rising. Cat XL treaty cedes losses above $500M aggregate to reinsurers, protecting solvency margins.",
        net_benefit_usd: "$3.02B",
        loss_inducing: false,
      },
      {
        id: "dec-ins-002",
        title: "Fast-Track Claims Triage via AI Adjudication",
        title_ar: "تسريع فرز المطالبات عبر التحكيم الذكي",
        priority: "high",
        owner: "Claims Operations Center",
        impact_usd: "$890M",
        cost_usd: "$45M",
        confidence: 0.78,
        deadline: "2026-04-09T12:00:00Z",
        status: "in_progress",
        rationale:
          "Manual processing at 340 claims/day vs 12,400 backlog. AI triage handles sub-$50K claims automatically, clearing 72% of volume.",
        net_benefit_usd: "$845M",
        loss_inducing: false,
      },
      {
        id: "dec-ins-003",
        title: "Temporary Solvency Capital Relief — Pillar 2",
        title_ar: "تخفيف مؤقت لمتطلبات رأس مال الملاءة",
        priority: "medium",
        owner: "Prudential Supervision Dept",
        impact_usd: "$1.4B",
        cost_usd: "$0",
        confidence: 0.65,
        deadline: "2026-04-10T09:00:00Z",
        status: "pending",
        rationale:
          "SCR ratio projected to drop to 108% vs 120% minimum. Temporary relief prevents forced asset sales while claims settle.",
        net_benefit_usd: "$1.4B",
        loss_inducing: false,
      },
    ],
  },

  // ── Scenario 5: Fintech Funding Freeze ──────────────────────────
  fintechFreeze: {
    event: {
      id: "evt-005",
      name: "Fintech Funding Freeze — VC Pullback",
      name_ar: "تجميد تمويل التقنية المالية — انسحاب رأس المال المغامر",
      severity: 0.68,
      region: "GCC",
      timestamp: "2026-04-08T11:00:00Z",
      status: "monitoring",
    },
    metrics: [
      { label: "Total Exposure", value: "$2.4B", delta: "+24%", trend: "up" },
      { label: "Entities Affected", value: "83", delta: "+31", trend: "up" },
      { label: "Decisions Queued", value: "3", delta: "0", trend: "flat" },
      { label: "Time to Breach", value: "72h", delta: "-48h", trend: "down" },
    ],
    decisions: [
      {
        id: "dec-fin-001",
        title: "Activate Fintech Bridge Lending Facility",
        title_ar: "تفعيل تسهيل الإقراض الجسري للتقنية المالية",
        priority: "critical",
        owner: "Financial Development Fund",
        impact_usd: "$1.6B",
        cost_usd: "$200M",
        confidence: 0.82,
        deadline: "2026-04-09T09:00:00Z",
        status: "pending",
        rationale:
          "42 fintechs have < 3 months runway. Bridge facility prevents mass layoffs (8,200 jobs) and preserves payment infrastructure serving 2.1M users.",
        net_benefit_usd: "$1.4B",
        loss_inducing: false,
      },
      {
        id: "dec-fin-002",
        title: "Fast-Track Regulatory Sandbox Licenses",
        title_ar: "تسريع تراخيص البيئة التجريبية التنظيمية",
        priority: "high",
        owner: "Digital Economy Authority",
        impact_usd: "$520M",
        cost_usd: "$15M",
        confidence: 0.76,
        deadline: "2026-04-10T12:00:00Z",
        status: "pending",
        rationale:
          "28 sandbox applicants stalled in review. Fast-tracking unlocks $520M in committed Series B funding contingent on regulatory approval.",
        net_benefit_usd: "$505M",
        loss_inducing: false,
      },
      {
        id: "dec-fin-003",
        title: "Sovereign Co-Investment in Strategic Fintechs",
        title_ar: "استثمار سيادي مشترك في شركات التقنية المالية الاستراتيجية",
        priority: "medium",
        owner: "Public Investment Fund",
        impact_usd: "$780M",
        cost_usd: "$400M",
        confidence: 0.6,
        deadline: "2026-04-12T09:00:00Z",
        status: "pending",
        rationale:
          "6 fintechs classified as national infrastructure (payments, KYC, open banking). Co-investment signals confidence and crowds in private capital.",
        net_benefit_usd: "$380M",
        loss_inducing: false,
      },
    ],
  },
};
