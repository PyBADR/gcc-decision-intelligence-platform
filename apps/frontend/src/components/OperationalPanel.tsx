"use client";

/**
 * SECTION 6: OperationalPanel
 * Financial impact table + sector stress cards + operational reasoning.
 * Graph is NOT primary — this is the detail layer.
 */

import type { RunResult, Classification, Language } from "@/types/observatory";

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function formatUsd(v: number): string {
  const n = safeNumber(v, 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

function formatHours(hours: number): string {
  const h = safeNumber(hours, 0);
  if (!isFinite(h) || h <= 0) return "N/A";
  if (h >= 720) return `${Math.round(h / 720)}mo`;
  if (h >= 24) return `${Math.round(h / 24)}d`;
  return `${Math.round(h)}h`;
}

// ── Classification badge ────────────────────────────────────────────

const CLASSIFICATION_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  ELEVATED: "bg-amber-100 text-amber-700",
  MODERATE: "bg-yellow-100 text-yellow-700",
  LOW: "bg-emerald-100 text-emerald-700",
  NOMINAL: "bg-zinc-100 text-zinc-600",
};

function Badge({ level }: { level: string }) {
  const cls = CLASSIFICATION_STYLES[level] ?? CLASSIFICATION_STYLES.NOMINAL;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cls}`}>
      {level}
    </span>
  );
}

// ── Sector stress card ──────────────────────────────────────────────

function SectorCard({
  title,
  classification,
  stress,
  metrics,
  onClick,
}: {
  title: string;
  classification: string;
  stress: number;
  metrics: { label: string; value: string }[];
  onClick?: () => void;
}) {
  const pct = Math.round(safeNumber(stress, 0) * 100);
  return (
    <div
      onClick={onClick}
      className={`bg-io-surface border border-io-border rounded-xl p-5 shadow-sm ${onClick ? "cursor-pointer hover:shadow-md hover:border-io-accent/30 transition-all" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-io-primary">{title}</h3>
        <Badge level={safeString(classification, "NOMINAL")} />
      </div>
      <p className="text-2xl font-bold tabular-nums text-io-primary mb-3">{pct}%</p>
      <div className="space-y-1.5">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-io-secondary">{m.label}</span>
            <span className="font-medium text-io-primary tabular-nums">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────

interface OperationalPanelProps {
  data: RunResult;
  lang: Language;
  onNavigate?: (view: string) => void;
}

export default function OperationalPanel({ data, lang, onNavigate }: OperationalPanelProps) {
  const isAr = lang === "ar";
  const { banking, insurance, fintech, financial, explanation } = data;

  return (
    <section className="px-6 lg:px-10 py-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-io-primary uppercase tracking-wider">
          {isAr ? "التفاصيل التشغيلية" : "Operational Detail"}
        </h2>
        <p className="text-[11px] text-io-secondary mt-0.5">
          {isAr ? "الضغط القطاعي والأثر المالي التفصيلي والتفسير التشغيلي" : "Sector stress, detailed financial impact, and operational reasoning"}
        </p>
      </div>

      {/* Sector Stress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SectorCard
          title={isAr ? "ضغط القطاع البنكي" : "Banking Stress"}
          classification={safeString(banking?.classification, "NOMINAL")}
          stress={safeNumber(banking?.aggregate_stress, 0)}
          onClick={() => onNavigate?.("banking")}
          metrics={[
            { label: isAr ? "السيولة" : "Liquidity", value: `${Math.round(safeNumber(banking?.liquidity_stress, 0) * 100)}%` },
            { label: isAr ? "الائتمان" : "Credit", value: `${Math.round(safeNumber(banking?.credit_stress, 0) * 100)}%` },
            { label: isAr ? "العملة" : "FX", value: `${Math.round(safeNumber(banking?.fx_stress, 0) * 100)}%` },
            { label: isAr ? "كسر السيولة" : "TTL Breach", value: formatHours(safeNumber(banking?.time_to_liquidity_breach_hours, 0)) },
          ]}
        />
        <SectorCard
          title={isAr ? "ضغط التأمين" : "Insurance Stress"}
          classification={safeString(insurance?.classification, "NOMINAL")}
          stress={safeNumber(insurance?.aggregate_stress, 0)}
          onClick={() => onNavigate?.("insurance")}
          metrics={[
            { label: isAr ? "ارتفاع المطالبات" : "Claims Surge", value: `${safeNumber(insurance?.claims_surge_multiplier, 0).toFixed(2)}x` },
            { label: isAr ? "النسبة المجمعة" : "Combined Ratio", value: `${Math.round(safeNumber(insurance?.combined_ratio, 0) * 100)}%` },
            { label: isAr ? "إعادة التأمين" : "Reinsurance", value: insurance?.reinsurance_trigger ? "TRIGGERED" : "Normal" },
            { label: isAr ? "فشل التأمين" : "TT Insolvency", value: formatHours(safeNumber(insurance?.time_to_insolvency_hours, 0)) },
          ]}
        />
        <SectorCard
          title={isAr ? "اضطراب الفنتك" : "Fintech Disruption"}
          classification={safeString(fintech?.classification, "NOMINAL")}
          stress={safeNumber(fintech?.aggregate_stress, 0)}
          onClick={() => onNavigate?.("fintech")}
          metrics={[
            { label: isAr ? "انخفاض المدفوعات" : "Payment Drop", value: `${safeNumber(fintech?.payment_volume_impact_pct, 0).toFixed(1)}%` },
            { label: isAr ? "تأخر التسوية" : "Delay", value: `+${safeNumber(fintech?.settlement_delay_hours, 0).toFixed(1)}h` },
            { label: isAr ? "توفر API" : "API Uptime", value: `${safeNumber(fintech?.api_availability_pct, 0).toFixed(0)}%` },
            { label: isAr ? "فشل المدفوعات" : "TT Failure", value: formatHours(safeNumber(fintech?.time_to_payment_failure_hours, 0)) },
          ]}
        />
      </div>

      {/* Financial Impact Table */}
      {Array.isArray(financial) && financial.length > 0 && (
        <div className="bg-io-surface border border-io-border rounded-xl p-5 shadow-sm mb-6">
          <h3 className="text-sm font-semibold text-io-primary uppercase tracking-wider mb-4">
            {isAr ? "الأثر المالي التفصيلي" : "Financial Impact Detail"}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-io-border text-io-secondary text-xs">
                  <th className="text-left py-2 font-medium">{isAr ? "الكيان" : "Entity"}</th>
                  <th className="text-left py-2 font-medium">{isAr ? "القطاع" : "Sector"}</th>
                  <th className="text-right py-2 font-medium">{isAr ? "الخسارة" : "Loss"}</th>
                  <th className="text-right py-2 font-medium">{isAr ? "الضغط" : "Stress"}</th>
                  <th className="text-center py-2 font-medium">{isAr ? "المستوى" : "Level"}</th>
                </tr>
              </thead>
              <tbody>
                {financial.slice(0, 12).map((fi) => (
                  <tr key={fi.entity_id} className="border-b border-io-border/50">
                    <td className="py-2 font-medium text-io-primary text-xs">
                      {safeString(fi.entity_label, fi.entity_id)}
                    </td>
                    <td className="py-2 text-io-secondary text-xs capitalize">{safeString(fi.sector, "—")}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-xs">{formatUsd(safeNumber(fi.loss_usd, 0))}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{Math.round(safeNumber(fi.stress_level, 0) * 100)}%</td>
                    <td className="py-2 text-center"><Badge level={safeString(fi.classification, "NOMINAL")} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Operational Reasoning */}
      {explanation && (
        <div className="bg-io-surface border border-io-border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-io-primary uppercase tracking-wider mb-3">
            {isAr ? "التفسير التشغيلي" : "Operational Reasoning"}
          </h3>
          <p className="text-sm text-io-secondary leading-relaxed">
            {safeString(isAr ? explanation.narrative_ar : null, safeString(explanation.narrative_en, "No reasoning available."))}
          </p>
          {Array.isArray(explanation.causal_chain) && explanation.causal_chain.length > 0 && (
            <div className="mt-4 pt-3 border-t border-io-border">
              <p className="text-[10px] text-io-secondary uppercase tracking-wider mb-2 font-medium">
                {isAr ? "السلسلة السببية" : "Causal Chain"} ({explanation.causal_chain.length} {isAr ? "خطوة" : "steps"})
              </p>
              <div className="space-y-1">
                {explanation.causal_chain.slice(0, 5).map((step) => (
                  <div key={step.step} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded-full bg-io-accent/10 text-io-accent flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {step.step}
                    </span>
                    <span className="text-io-primary">
                      {safeString(isAr ? step.entity_label_ar : null, safeString(step.entity_label, "—"))}
                    </span>
                    <span className="text-io-secondary">→</span>
                    <span className="text-io-secondary flex-1 truncate">
                      {safeString(isAr ? step.event_ar : null, safeString(step.event, "—"))}
                    </span>
                    <span className="text-io-primary font-medium tabular-nums">{formatUsd(safeNumber(step.impact_usd, 0))}</span>
                  </div>
                ))}
                {explanation.causal_chain.length > 5 && (
                  <p className="text-[10px] text-io-secondary">+{explanation.causal_chain.length - 5} more steps</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
