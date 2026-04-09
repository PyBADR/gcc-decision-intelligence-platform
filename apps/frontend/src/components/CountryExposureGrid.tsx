"use client";

/**
 * SECTION 3: CountryExposureGrid (V1)
 * GDP-weighted GCC country exposure with bar indicators.
 * Static weights + dynamic severity from RunResult.
 */

import type { RunResult, Language } from "@/types/observatory";

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const GCC_COUNTRIES = [
  { code: "SA", name: "Saudi Arabia", name_ar: "السعودية", gdpWeight: 0.45 },
  { code: "AE", name: "UAE", name_ar: "الإمارات", gdpWeight: 0.22 },
  { code: "QA", name: "Qatar", name_ar: "قطر", gdpWeight: 0.12 },
  { code: "KW", name: "Kuwait", name_ar: "الكويت", gdpWeight: 0.10 },
  { code: "OM", name: "Oman", name_ar: "عُمان", gdpWeight: 0.08 },
  { code: "BH", name: "Bahrain", name_ar: "البحرين", gdpWeight: 0.03 },
];

interface CountryExposureGridProps {
  data: RunResult;
  lang: Language;
}

export default function CountryExposureGrid({ data, lang }: CountryExposureGridProps) {
  const isAr = lang === "ar";
  const severity = safeNumber(data.scenario?.severity, 0);
  const totalLoss = safeNumber(data.headline?.total_loss_usd, 0);

  return (
    <section className="px-6 lg:px-10 py-5 border-b border-io-border">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-io-primary uppercase tracking-wider">
          {isAr ? "تفاصيل التعرض القطاعي" : "Sector Exposure Detail"}
        </h2>
        <p className="text-[11px] text-io-secondary mt-0.5">
          {isAr ? "التأثير المرجح بالناتج المحلي عبر دول مجلس التعاون" : "GDP-weighted impact across GCC member states"}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {GCC_COUNTRIES.map((c) => {
          const exposure = Math.min(1, severity * c.gdpWeight * 3);
          const pct = Math.round(exposure * 100);
          const estimatedLoss = totalLoss * c.gdpWeight;

          return (
            <div key={c.code} className="bg-io-surface border border-io-border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-io-primary">{c.code}</p>
              <p className="text-[11px] text-io-secondary mb-2">{isAr ? c.name_ar : c.name}</p>

              {/* Exposure bar */}
              <div className="h-2 rounded-full bg-io-border overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct > 60 ? "bg-red-500" : pct > 30 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.max(3, pct)}%` }}
                />
              </div>

              <p className={`text-xs font-bold tabular-nums ${
                pct > 60 ? "text-io-danger" : pct > 30 ? "text-io-elevated" : "text-io-secondary"
              }`}>
                {pct}% {isAr ? "تعرض" : "exposed"}
              </p>

              {/* GDP weight + estimated loss */}
              <div className="mt-2 pt-2 border-t border-io-border">
                <p className="text-[10px] text-io-secondary">
                  GDP: {Math.round(c.gdpWeight * 100)}%
                </p>
                {totalLoss > 0 && (
                  <p className="text-[10px] text-io-secondary tabular-nums">
                    ~{formatCompact(estimatedLoss)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatCompact(v: number): string {
  const n = safeNumber(v, 0);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
