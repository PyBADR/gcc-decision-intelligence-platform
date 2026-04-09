"use client";

/**
 * SECTION 2: TransmissionFlow
 * Simple chain visualization showing how the event propagates.
 * No heavy graph lib — pure CSS/SVG chain.
 */

import type { RunResult, Language } from "@/types/observatory";

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function formatUsd(v: number): string {
  const n = safeNumber(v, 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ── Transmission chain stages ───────────────────────────────────────

interface ChainStage {
  label: string;
  sublabel: string;
  value: string;
  severity: "high" | "medium" | "low";
}

function deriveChain(data: RunResult, isAr: boolean): ChainStage[] {
  const headline = data.headline;
  const banking = data.banking;
  const insurance = data.insurance;
  const fintech = data.fintech;

  const totalLoss = safeNumber(headline?.total_loss_usd, 0);
  const avgStress = safeNumber(headline?.average_stress, 0);
  const bankingStress = safeNumber(banking?.aggregate_stress, 0);
  const insuranceStress = safeNumber(insurance?.aggregate_stress, 0);
  const fintechStress = safeNumber(fintech?.aggregate_stress, 0);

  const sev = (v: number): "high" | "medium" | "low" =>
    v > 0.6 ? "high" : v > 0.3 ? "medium" : "low";

  return [
    {
      label: isAr ? "الحدث" : "Event Trigger",
      sublabel: safeString(data.scenario?.label, "Scenario"),
      value: `${Math.round(safeNumber(data.scenario?.severity, 0) * 100)}%`,
      severity: sev(safeNumber(data.scenario?.severity, 0)),
    },
    {
      label: isAr ? "الأثر المالي" : "Financial Impact",
      sublabel: `${safeNumber(headline?.affected_entities, 0)} entities`,
      value: formatUsd(totalLoss),
      severity: sev(avgStress),
    },
    {
      label: isAr ? "ضغط بنكي" : "Banking Stress",
      sublabel: safeString(banking?.classification, "—"),
      value: `${Math.round(bankingStress * 100)}%`,
      severity: sev(bankingStress),
    },
    {
      label: isAr ? "ضغط التأمين" : "Insurance Stress",
      sublabel: safeString(insurance?.classification, "—"),
      value: `${Math.round(insuranceStress * 100)}%`,
      severity: sev(insuranceStress),
    },
    {
      label: isAr ? "اضطراب الفنتك" : "Fintech Disruption",
      sublabel: safeString(fintech?.classification, "—"),
      value: `${Math.round(fintechStress * 100)}%`,
      severity: sev(fintechStress),
    },
    {
      label: isAr ? "القرار" : "Decision Required",
      sublabel: `${safeNumber(data.decisions?.actions?.length, 0)} actions`,
      value: formatUsd(safeNumber(data.decisions?.total_loss_usd, totalLoss)),
      severity: sev(avgStress),
    },
  ];
}

// ── Severity styles ─────────────────────────────────────────────────

const SEV_STYLES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  high: { border: "border-red-300", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  medium: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  low: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

// ── Component ───────────────────────────────────────────────────────

interface TransmissionFlowProps {
  data: RunResult;
  lang: Language;
}

export default function TransmissionFlow({ data, lang }: TransmissionFlowProps) {
  const isAr = lang === "ar";
  const chain = deriveChain(data, isAr);

  return (
    <section className="px-6 lg:px-10 py-5 border-b border-io-border">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-io-primary uppercase tracking-wider">
          {isAr ? "ميكانيكا الانتقال" : "Transmission Mechanics"}
        </h2>
        <p className="text-[11px] text-io-secondary mt-0.5">
          {isAr ? "مسار انتشار الحدث عبر القطاعات" : "Event propagation path across sectors"}
        </p>
      </div>

      <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
        {chain.map((stage, i) => {
          const style = SEV_STYLES[stage.severity] ?? SEV_STYLES.low;
          return (
            <div key={i} className="flex items-center flex-shrink-0">
              {/* Stage box */}
              <div className={`border ${style.border} ${style.bg} rounded-xl px-4 py-3 min-w-[140px]`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                  <span className="text-[11px] font-semibold text-io-primary">{stage.label}</span>
                </div>
                <p className={`text-lg font-bold tabular-nums ${style.text}`}>{stage.value}</p>
                <p className="text-[10px] text-io-secondary mt-0.5 uppercase">{stage.sublabel}</p>
              </div>

              {/* Arrow connector */}
              {i < chain.length - 1 && (
                <div className="flex items-center px-1 flex-shrink-0">
                  <svg className="w-6 h-6 text-io-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
