"use client";

/**
 * Macro Intelligence Dashboard | لوحة الاستخبارات الاقتصادية
 *
 * GCC macroeconomic analysis with regime detection, signal generation,
 * sector impact mapping, and decision influence visualization.
 *
 * Connects to: /api/v1/macro/* and /api/v1/policy/*
 *
 * Sections:
 *   1. Regime banner — current macro regime with confidence
 *   2. Indicator cards — 12 GCC macro indicators with states
 *   3. Signal panel — active macro signals with strength bars
 *   4. Sector heatmap — impact scores per sector
 *   5. Risk overlay chart — macro risk contribution visualization
 *   6. Policy integration — active policy rules triggered by context
 *   7. Scenario simulator — adjust indicators, see real-time impact
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  analyzeMacro,
  diagnoseIndicators,
  getIndicatorMetadata,
  getRegimeTypes,
  type MacroContext,
  type MacroSignal,
  type SectorImpact,
  type DiagnosticResult,
  type IndicatorMetadata,
} from "@/services/macro-api";
import { evaluatePolicies, type PolicyEvalResult } from "@/services/policy-api";

// ─── Types ──────────────────────────────────────────────────────────────────

type Language = "en" | "ar";

// ─── Constants ──────────────────────────────────────────────────────────────

const REGIME_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  expansion:    { bg: "bg-emerald-50",  text: "text-emerald-700",  border: "border-emerald-200", icon: "📈" },
  tightening:   { bg: "bg-amber-50",    text: "text-amber-700",    border: "border-amber-200",   icon: "🔧" },
  inflationary: { bg: "bg-orange-50",   text: "text-orange-700",   border: "border-orange-200",  icon: "🔥" },
  recession:    { bg: "bg-red-50",      text: "text-red-700",      border: "border-red-200",     icon: "📉" },
  oil_boom:     { bg: "bg-green-50",    text: "text-green-700",    border: "border-green-200",   icon: "🛢️" },
  oil_shock:    { bg: "bg-red-50",      text: "text-red-800",      border: "border-red-300",     icon: "⚡" },
  neutral:      { bg: "bg-slate-50",    text: "text-slate-600",    border: "border-slate-200",   icon: "⚖️" },
};

const REGIME_LABELS: Record<string, { en: string; ar: string }> = {
  expansion:    { en: "Expansion",     ar: "توسع" },
  tightening:   { en: "Tightening",    ar: "تشديد" },
  inflationary: { en: "Inflationary",  ar: "تضخمي" },
  recession:    { en: "Recession",     ar: "ركود" },
  oil_boom:     { en: "Oil Boom",      ar: "طفرة نفطية" },
  oil_shock:    { en: "Oil Shock",     ar: "صدمة نفطية" },
  neutral:      { en: "Neutral",       ar: "محايد" },
};

const DIRECTION_ICONS: Record<string, string> = {
  up: "↑", down: "↓", neutral: "→",
};

const SIGNAL_DIRECTION_COLORS: Record<string, string> = {
  up: "text-io-danger",
  down: "text-io-success",
  neutral: "text-io-secondary",
};

const DEFAULT_INDICATORS: Record<string, number> = {
  brent_crude: 82.0,
  interest_rate: 5.5,
  inflation: 2.8,
  gdp_growth: 3.2,
  fx_usd_sar: 3.75,
  credit_growth: 6.5,
  pmi: 54.0,
  real_estate_index: 105.0,
  trade_balance: 45.0,
  govt_spending_growth: 4.5,
  vix: 18.0,
  shipping_cost_index: 1200.0,
};

const INDICATOR_LABELS: Record<string, { en: string; ar: string; unit: string }> = {
  brent_crude:           { en: "Brent Crude",          ar: "خام برنت",           unit: "$/bbl" },
  interest_rate:         { en: "Interest Rate",        ar: "سعر الفائدة",        unit: "%" },
  inflation:             { en: "Inflation",            ar: "التضخم",             unit: "%" },
  gdp_growth:            { en: "GDP Growth",           ar: "نمو الناتج المحلي",  unit: "%" },
  fx_usd_sar:            { en: "USD/SAR",              ar: "دولار/ريال",         unit: "" },
  credit_growth:         { en: "Credit Growth",        ar: "نمو الائتمان",       unit: "%" },
  pmi:                   { en: "PMI",                  ar: "مؤشر مديري المشتريات", unit: "" },
  real_estate_index:     { en: "Real Estate Index",    ar: "مؤشر العقار",        unit: "" },
  trade_balance:         { en: "Trade Balance",        ar: "الميزان التجاري",    unit: "$B" },
  govt_spending_growth:  { en: "Govt Spending",        ar: "الإنفاق الحكومي",    unit: "%" },
  vix:                   { en: "VIX",                  ar: "مؤشر الخوف",         unit: "" },
  shipping_cost_index:   { en: "Shipping Cost",        ar: "تكلفة الشحن",        unit: "" },
};

const SECTOR_LABELS: Record<string, { en: string; ar: string }> = {
  energy:        { en: "Energy",        ar: "الطاقة" },
  banking:       { en: "Banking",       ar: "البنوك" },
  insurance:     { en: "Insurance",     ar: "التأمين" },
  real_estate:   { en: "Real Estate",   ar: "العقارات" },
  construction:  { en: "Construction",  ar: "البناء" },
  maritime:      { en: "Maritime",      ar: "البحري" },
  aviation:      { en: "Aviation",      ar: "الطيران" },
  telecom:       { en: "Telecom",       ar: "الاتصالات" },
  retail:        { en: "Retail",        ar: "التجزئة" },
  healthcare:    { en: "Healthcare",    ar: "الصحة" },
  petrochemical: { en: "Petrochemical", ar: "البتروكيماويات" },
  tourism:       { en: "Tourism",       ar: "السياحة" },
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function MacroIntelligencePage() {
  const [locale, setLocale] = useState<Language>("en");
  const [indicators, setIndicators] = useState<Record<string, number>>({ ...DEFAULT_INDICATORS });
  const [macroContext, setMacroContext] = useState<MacroContext | null>(null);
  const [policyResult, setPolicyResult] = useState<PolicyEvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const isRtl = locale === "ar";

  // ── Analysis ─────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const [macroRes, policyRes] = await Promise.all([
        analyzeMacro(indicators),
        evaluatePolicies({
          context: {
            macro: { regime: "neutral", risk_overlay: 0 },
            risk_score: 0.5,
            sector: "*",
          },
          sector: "*",
        }).catch(() => null),
      ]);
      setMacroContext(macroRes);
      if (policyRes) setPolicyResult(policyRes);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Macro analysis failed:", e);
    } finally {
      setLoading(false);
    }
  }, [indicators]);

  // Re-run analysis when macroContext updates with actual regime
  useEffect(() => {
    if (macroContext && policyResult === null) {
      evaluatePolicies({
        context: {
          macro: { regime: macroContext.regime, risk_overlay: macroContext.risk_overlay },
          risk_score: 0.5,
          sector: "*",
        },
        sector: "*",
      })
        .then(setPolicyResult)
        .catch(() => {});
    }
  }, [macroContext, policyResult]);

  useEffect(() => {
    runAnalysis();
  }, []);

  // ── Indicator change handler ──────────────────────────────────────────
  const updateIndicator = (key: string, value: number) => {
    setIndicators((prev) => ({ ...prev, [key]: value }));
  };

  const resetIndicators = () => {
    setIndicators({ ...DEFAULT_INDICATORS });
  };

  // ── Derived values ────────────────────────────────────────────────────
  const regime = macroContext?.regime ?? "neutral";
  const regimeStyle = REGIME_STYLES[regime] ?? REGIME_STYLES.neutral;
  const regimeLabel = REGIME_LABELS[regime] ?? REGIME_LABELS.neutral;
  const signals = macroContext?.signals ?? [];
  const sectorImpacts = macroContext?.sector_impacts ?? [];
  const riskOverlay = macroContext?.risk_overlay ?? "0";

  const riskSignals = signals.filter((s) => s.direction === "up");
  const positiveSignals = signals.filter((s) => s.direction === "down");

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-io-bg" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── NavBar ──────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-io-border px-4 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="bg-io-primary text-white text-xs font-bold px-2 py-1 rounded">IO</span>
              <span className="text-sm font-semibold text-io-primary">
                {isRtl ? "مرصد الأثر" : "Impact Observatory"}
              </span>
            </Link>
            <span className="text-io-border">|</span>
            <Link href="/audit-dashboard" className="text-sm text-io-secondary hover:text-io-accent transition-colors">
              {isRtl ? "الحوكمة" : "Governance"}
            </Link>
            <span className="text-sm text-io-accent font-medium">
              {isRtl ? "الاستخبارات الاقتصادية" : "Macro Intelligence"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-io-secondary">
                {isRtl ? "آخر تحديث" : "Updated"}: {lastUpdated}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-4 py-1.5 bg-io-accent text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              {loading
                ? (isRtl ? "جاري التحليل..." : "Analyzing...")
                : (isRtl ? "تحليل" : "Analyze")}
            </button>
            <button
              onClick={() => setLocale(isRtl ? "en" : "ar")}
              className="px-3 py-1 border border-io-border rounded text-xs font-semibold text-io-secondary hover:bg-io-bg transition-colors"
            >
              {isRtl ? "EN" : "AR"}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-io-primary">
              {isRtl ? "لوحة الاستخبارات الاقتصادية" : "Macro Intelligence Dashboard"}
            </h1>
            <p className="text-sm text-io-secondary mt-0.5">
              {isRtl
                ? "12 مؤشر · 21 إشارة · 7 أنظمة اقتصادية · تأثير قطاعي مباشر"
                : "12 indicators · 21 signal rules · 7 regimes · real-time sector impact"}
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 1: Regime Banner                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className={`rounded-xl border ${regimeStyle.border} ${regimeStyle.bg} p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{regimeStyle.icon}</div>
              <div>
                <p className="text-xs font-semibold text-io-secondary uppercase tracking-wider">
                  {isRtl ? "النظام الاقتصادي الحالي" : "Current Macro Regime"}
                </p>
                <h2 className={`text-2xl font-bold ${regimeStyle.text} mt-1`}>
                  {isRtl ? regimeLabel.ar : regimeLabel.en}
                </h2>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-io-secondary">
                {isRtl ? "درجة الثقة" : "Confidence"}
              </p>
              <p className={`text-3xl font-bold tabular-nums ${regimeStyle.text}`}>
                {((macroContext?.regime_confidence ?? 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* Risk overlay bar */}
          <div className="mt-4 pt-4 border-t border-current/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-io-secondary font-medium">
                {isRtl ? "تراكب المخاطر الكلية" : "Macro Risk Overlay"}
              </span>
              <span className={`font-bold tabular-nums ${
                parseFloat(String(riskOverlay)) > 0 ? "text-io-danger" : parseFloat(String(riskOverlay)) < 0 ? "text-io-success" : "text-io-secondary"
              }`}>
                {parseFloat(String(riskOverlay)) > 0 ? "+" : ""}{(parseFloat(String(riskOverlay)) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-white/60 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  parseFloat(String(riskOverlay)) > 0.1 ? "bg-io-danger" : parseFloat(String(riskOverlay)) > 0 ? "bg-io-warning" : "bg-io-success"
                }`}
                style={{ width: `${Math.min(Math.abs(parseFloat(String(riskOverlay))) * 200, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 2: Indicator Sliders (Scenario Simulator)         */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-io-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-io-primary">
                {isRtl ? "محاكاة المؤشرات" : "Indicator Simulator"}
              </h3>
              <p className="text-xs text-io-secondary mt-0.5">
                {isRtl ? "حرّك المؤشرات لمشاهدة تأثيرها الفوري" : "Adjust indicators to see real-time impact on regime and signals"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetIndicators}
                className="px-3 py-1.5 text-xs border border-io-border rounded-lg text-io-secondary hover:bg-io-bg transition-colors"
              >
                {isRtl ? "إعادة ضبط" : "Reset"}
              </button>
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-io-accent text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {isRtl ? "تحليل الآن" : "Analyze Now"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(indicators).map(([key, value]) => {
              const label = INDICATOR_LABELS[key];
              if (!label) return null;
              const defaultVal = DEFAULT_INDICATORS[key] ?? 0;
              const deviation = defaultVal !== 0 ? ((value - defaultVal) / defaultVal) * 100 : 0;
              const isChanged = Math.abs(deviation) > 0.5;

              return (
                <div
                  key={key}
                  className={`p-3 rounded-lg border transition-colors ${
                    isChanged ? "border-io-accent/30 bg-io-accent/5" : "border-io-border bg-io-bg"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium text-io-secondary">
                      {isRtl ? label.ar : label.en}
                    </span>
                    {label.unit && (
                      <span className="text-[10px] text-io-secondary/60">{label.unit}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => updateIndicator(key, parseFloat(e.target.value) || 0)}
                      step={key === "fx_usd_sar" ? 0.01 : key === "vix" ? 1 : 0.1}
                      className="w-full px-2 py-1.5 text-sm font-semibold tabular-nums bg-white border border-io-border rounded text-io-primary"
                    />
                  </div>
                  {isChanged && (
                    <p className={`text-[10px] mt-1 font-medium ${
                      deviation > 0 ? "text-io-danger" : "text-io-success"
                    }`}>
                      {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}% {isRtl ? "من الأساس" : "from baseline"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 3: Signals Panel                                  */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk-increasing signals */}
          <div className="bg-white rounded-xl border border-io-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-io-danger" />
              <h3 className="text-sm font-bold text-io-primary">
                {isRtl ? "إشارات رفع المخاطر" : "Risk-Increasing Signals"}
              </h3>
              <span className="ml-auto text-xs text-io-secondary">{riskSignals.length} {isRtl ? "إشارة" : "active"}</span>
            </div>
            {riskSignals.length === 0 ? (
              <p className="text-sm text-io-secondary py-4 text-center">
                {isRtl ? "لا توجد إشارات خطر نشطة" : "No risk-increasing signals active"}
              </p>
            ) : (
              <div className="space-y-3">
                {riskSignals.map((signal) => (
                  <SignalRow key={signal.name} signal={signal} locale={locale} />
                ))}
              </div>
            )}
          </div>

          {/* Positive / risk-decreasing signals */}
          <div className="bg-white rounded-xl border border-io-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-io-success" />
              <h3 className="text-sm font-bold text-io-primary">
                {isRtl ? "إشارات إيجابية" : "Positive / Risk-Decreasing Signals"}
              </h3>
              <span className="ml-auto text-xs text-io-secondary">{positiveSignals.length} {isRtl ? "إشارة" : "active"}</span>
            </div>
            {positiveSignals.length === 0 ? (
              <p className="text-sm text-io-secondary py-4 text-center">
                {isRtl ? "لا توجد إشارات إيجابية نشطة" : "No positive signals active"}
              </p>
            ) : (
              <div className="space-y-3">
                {positiveSignals.map((signal) => (
                  <SignalRow key={signal.name} signal={signal} locale={locale} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 4: Sector Impact Heatmap                          */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-io-border p-6">
          <h3 className="text-base font-bold text-io-primary mb-1">
            {isRtl ? "خريطة الأثر القطاعي" : "Sector Impact Heatmap"}
          </h3>
          <p className="text-xs text-io-secondary mb-4">
            {isRtl ? "كيف يؤثر النظام الاقتصادي الحالي على كل قطاع" : "How the current macro regime impacts each sector"}
          </p>

          {sectorImpacts.length === 0 ? (
            <p className="text-sm text-io-secondary text-center py-8">
              {isRtl ? "شغّل التحليل لمشاهدة التأثير القطاعي" : "Run analysis to see sector impacts"}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sectorImpacts.map((si) => {
                const label = SECTOR_LABELS[si.sector];
                const absImpact = Math.abs(si.impact_score);
                const isNegative = si.impact_score < 0;

                return (
                  <div
                    key={si.sector}
                    className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                      absImpact > 0.3
                        ? isNegative ? "border-io-danger/30 bg-red-50" : "border-io-success/30 bg-green-50"
                        : absImpact > 0.1
                          ? isNegative ? "border-io-warning/30 bg-amber-50" : "border-io-low/30 bg-emerald-50"
                          : "border-io-border bg-io-bg"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-io-primary">
                        {label ? (isRtl ? label.ar : label.en) : si.sector}
                      </span>
                      <span className={`text-lg font-bold ${SIGNAL_DIRECTION_COLORS[si.direction]}`}>
                        {DIRECTION_ICONS[si.direction]}
                      </span>
                    </div>
                    <p className={`text-xl font-bold tabular-nums ${
                      isNegative ? "text-io-danger" : si.impact_score > 0 ? "text-io-success" : "text-io-secondary"
                    }`}>
                      {si.impact_score > 0 ? "+" : ""}{(si.impact_score * 100).toFixed(1)}%
                    </p>
                    {/* Impact bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isNegative ? "bg-io-danger" : "bg-io-success"}`}
                        style={{ width: `${Math.min(absImpact * 200, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-io-secondary mt-2 line-clamp-2">{si.reasoning}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 5: Policy Rules Triggered                         */}
        {/* ══════════════════════════════════════════════════════════ */}
        {policyResult && policyResult.applied && (
          <div className="bg-white rounded-xl border border-io-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-io-primary">
                  {isRtl ? "السياسات المطبقة" : "Policy Rules Triggered"}
                </h3>
                <p className="text-xs text-io-secondary mt-0.5">
                  {isRtl
                    ? `${policyResult.rules_matched} من ${policyResult.total_rules_evaluated} قاعدة مطابقة`
                    : `${policyResult.rules_matched} of ${policyResult.total_rules_evaluated} rules matched`}
                </p>
              </div>
              {policyResult.decision_override && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  policyResult.decision_override === "REJECTED"
                    ? "bg-io-danger/10 text-io-danger"
                    : policyResult.decision_override === "CONDITIONAL"
                      ? "bg-io-warning/10 text-io-warning"
                      : "bg-io-success/10 text-io-success"
                }`}>
                  {policyResult.decision_override}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {policyResult.pricing_adjustment !== undefined && policyResult.pricing_adjustment !== null && (
                <div className="p-3 bg-io-bg rounded-lg border border-io-border">
                  <p className="text-[10px] font-semibold text-io-secondary uppercase tracking-wider">
                    {isRtl ? "تعديل التسعير" : "Pricing Adjustment"}
                  </p>
                  <p className="text-lg font-bold text-io-warning mt-1">
                    +{(policyResult.pricing_adjustment * 100).toFixed(1)}%
                  </p>
                </div>
              )}
              {policyResult.coverage_cap_pct !== undefined && policyResult.coverage_cap_pct !== null && (
                <div className="p-3 bg-io-bg rounded-lg border border-io-border">
                  <p className="text-[10px] font-semibold text-io-secondary uppercase tracking-wider">
                    {isRtl ? "سقف التغطية" : "Coverage Cap"}
                  </p>
                  <p className="text-lg font-bold text-io-danger mt-1">
                    {(policyResult.coverage_cap_pct * 100).toFixed(0)}%
                  </p>
                </div>
              )}
              {policyResult.risk_adjustment !== undefined && policyResult.risk_adjustment !== null && (
                <div className="p-3 bg-io-bg rounded-lg border border-io-border">
                  <p className="text-[10px] font-semibold text-io-secondary uppercase tracking-wider">
                    {isRtl ? "تعديل المخاطر" : "Risk Adjustment"}
                  </p>
                  <p className="text-lg font-bold text-io-danger mt-1">
                    +{(policyResult.risk_adjustment * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {policyResult.conditions_add && policyResult.conditions_add.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-io-secondary mb-2 uppercase tracking-wider">
                  {isRtl ? "الشروط المطبقة" : "Applied Conditions"}
                </p>
                <div className="space-y-1.5">
                  {policyResult.conditions_add.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-io-accent mt-0.5">●</span>
                      <span className="text-io-primary">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* SECTION 6: Explainability Panel                           */}
        {/* ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-io-border p-6">
          <h3 className="text-base font-bold text-io-primary mb-3">
            {isRtl ? "لماذا هذا النظام الاقتصادي؟" : "Why This Regime?"}
          </h3>
          <div className="space-y-2">
            {signals.length > 0 ? (
              signals.slice(0, 5).map((s) => (
                <div key={s.name} className="flex items-start gap-3 text-sm">
                  <span className={`text-base mt-0.5 ${SIGNAL_DIRECTION_COLORS[s.direction]}`}>
                    {DIRECTION_ICONS[s.direction]}
                  </span>
                  <div>
                    <span className="font-medium text-io-primary">
                      {isRtl ? s.description_ar : s.description}
                    </span>
                    <span className="text-io-secondary ms-2">
                      ({isRtl ? "قوة" : "strength"}: {(s.strength * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-io-secondary">
                {isRtl ? "شغّل التحليل لمشاهدة التفسيرات" : "Run analysis to see explanations"}
              </p>
            )}
          </div>
        </div>

        {/* ── Audit Footer ─────────────────────────────────────────── */}
        {macroContext?.audit_hash && (
          <div className="flex items-center justify-between text-[10px] text-io-secondary px-2">
            <span>
              {isRtl ? "بصمة التدقيق" : "Audit hash"}: {macroContext.audit_hash.slice(0, 16)}...
            </span>
            <span>
              {isRtl ? "المؤشرات المستخدمة" : "Indicators used"}: {Object.keys(macroContext.indicators_snapshot ?? {}).length}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function SignalRow({ signal, locale }: { signal: MacroSignal; locale: Language }) {
  const isRtl = locale === "ar";

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-io-bg transition-colors">
      <span className={`text-base ${SIGNAL_DIRECTION_COLORS[signal.direction]}`}>
        {DIRECTION_ICONS[signal.direction]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-io-primary truncate">
          {signal.name.replace(/_/g, " ")}
        </p>
        <p className="text-[11px] text-io-secondary truncate">
          {isRtl ? signal.description_ar : signal.description}
        </p>
      </div>
      {/* Strength bar */}
      <div className="w-20 flex-shrink-0">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              signal.direction === "up" ? "bg-io-danger" : "bg-io-success"
            }`}
            style={{ width: `${signal.strength * 100}%` }}
          />
        </div>
        <p className="text-[10px] text-io-secondary text-right mt-0.5 tabular-nums">
          {(signal.strength * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}
