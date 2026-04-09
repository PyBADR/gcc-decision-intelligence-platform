"use client";

/**
 * SECTION 1: MacroOverviewHeader
 * Scenario identity, GCC impact score, severity gauge, top sectors.
 */

import type { RunResult, Classification, Language } from "@/types/observatory";

// ── Safe helpers ────────────────────────────────────────────────────

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

// ── Severity ────────────────────────────────────────────────────────

function severityColor(pct: number): string {
  if (pct >= 75) return "bg-red-600";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-yellow-500";
  return "bg-emerald-500";
}

function severityLabel(pct: number): string {
  if (pct >= 75) return "CRITICAL";
  if (pct >= 50) return "ELEVATED";
  if (pct >= 25) return "MODERATE";
  return "LOW";
}

// ── Top Sectors (derive from financial data) ────────────────────────

function deriveTopSectors(data: RunResult): { sector: string; stress: number; loss: number }[] {
  const sectorMap = new Map<string, { stress: number; loss: number; count: number }>();

  for (const fi of data.financial ?? []) {
    const s = safeString(fi.sector, "unknown");
    const existing = sectorMap.get(s) ?? { stress: 0, loss: 0, count: 0 };
    existing.stress += safeNumber(fi.stress_level, 0);
    existing.loss += safeNumber(fi.loss_usd, 0);
    existing.count += 1;
    sectorMap.set(s, existing);
  }

  return [...sectorMap.entries()]
    .map(([sector, { stress, loss, count }]) => ({
      sector,
      stress: count > 0 ? stress / count : 0,
      loss,
    }))
    .sort((a, b) => b.loss - a.loss)
    .slice(0, 4);
}

// ── Component ───────────────────────────────────────────────────────

interface MacroOverviewHeaderProps {
  data: RunResult;
  lang: Language;
}

export default function MacroOverviewHeader({ data, lang }: MacroOverviewHeaderProps) {
  const isAr = lang === "ar";
  const severity = safeNumber(data.scenario?.severity, 0);
  const severityPct = Math.round(severity * 100);
  const headline = data.headline;
  const topSectors = deriveTopSectors(data);

  return (
    <header className="bg-io-surface border-b border-io-border">
      {/* Row 1: Scenario identity + severity gauge */}
      <div className="px-6 lg:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-io-accent rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">IO</span>
          </div>
          <div>
            <p className="text-[11px] text-io-secondary uppercase tracking-wider font-medium">
              {isAr ? "سياق الضغط" : "Stress Context"}
            </p>
            <h1 className="text-xl font-bold text-io-primary leading-tight">
              {safeString(isAr ? data.scenario?.label_ar : null, safeString(data.scenario?.label, "Unknown Scenario"))}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status */}
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wide bg-io-accent/10 text-io-accent border border-io-accent/20">
            {safeString(data.status, "unknown")}
          </span>

          {/* Severity gauge */}
          <div className="text-right min-w-[100px]">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] text-io-secondary uppercase tracking-wider">
                {isAr ? "الشدة" : "Severity"}
              </p>
              <p className="text-sm font-bold text-io-primary tabular-nums">{severityPct}%</p>
            </div>
            <div className="h-2 w-full bg-io-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${severityColor(severityPct)}`}
                style={{ width: `${Math.max(3, severityPct)}%` }}
              />
            </div>
            <p className="text-[9px] text-io-secondary mt-0.5 text-right font-medium">
              {severityLabel(severityPct)}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Headline metrics strip */}
      <div className="px-6 lg:px-10 pb-3">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <MetricPill
            label={isAr ? "إجمالي الخسارة" : "Headline Loss"}
            value={formatUsd(safeNumber(headline?.total_loss_usd, 0))}
            alert={safeNumber(headline?.total_loss_usd, 0) > 1e9}
          />
          <MetricPill
            label={isAr ? "كيانات حرجة" : "Critical Entities"}
            value={String(safeNumber(headline?.critical_count, 0))}
            alert={safeNumber(headline?.critical_count, 0) > 3}
          />
          <MetricPill
            label={isAr ? "الكيانات المتأثرة" : "Affected Entities"}
            value={String(safeNumber(headline?.affected_entities, 0))}
          />
          <MetricPill
            label={isAr ? "يوم الذروة" : "Peak Day"}
            value={`Day ${safeNumber(headline?.peak_day, 0)}`}
          />
          <MetricPill
            label={isAr ? "متوسط الضغط" : "Avg Stress"}
            value={`${Math.round(safeNumber(headline?.average_stress, 0) * 100)}%`}
            alert={safeNumber(headline?.average_stress, 0) > 0.6}
          />
          <MetricPill
            label={isAr ? "أيام التعافي" : "Recovery Days"}
            value={`${safeNumber(headline?.max_recovery_days, 0)}d`}
          />
        </div>
      </div>

      {/* Row 3: Top sectors strip */}
      {topSectors.length > 0 && (
        <div className="px-6 lg:px-10 pb-3 border-t border-io-border pt-2">
          <div className="flex items-center gap-4 overflow-x-auto">
            <span className="text-[10px] text-io-secondary uppercase tracking-wider font-medium whitespace-nowrap">
              {isAr ? "أعلى القطاعات" : "Top Sectors"}
            </span>
            {topSectors.map((s) => {
              const pct = Math.round(s.stress * 100);
              return (
                <div key={s.sector} className="flex items-center gap-2 px-3 py-1.5 bg-io-bg border border-io-border rounded-lg">
                  <span className="text-xs font-semibold text-io-primary capitalize">{s.sector}</span>
                  <span className={`text-[10px] font-bold tabular-nums ${pct > 60 ? "text-io-danger" : pct > 30 ? "text-io-elevated" : "text-io-secondary"}`}>
                    {pct}%
                  </span>
                  <span className="text-[10px] text-io-secondary tabular-nums">{formatUsd(s.loss)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

// ── Metric pill ─────────────────────────────────────────────────────

function MetricPill({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-io-bg border border-io-border rounded-lg px-4 py-2.5">
      <p className="text-[10px] text-io-secondary uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${alert ? "text-io-danger" : "text-io-primary"}`}>
        {value}
      </p>
    </div>
  );
}
