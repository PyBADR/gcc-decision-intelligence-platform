"use client";

/**
 * SECTION 5: TrustPanel
 * Confidence + audit hash for the run.
 */

import type { RunResult, Language } from "@/types/observatory";

function safeNumber(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

// ── Simple hash from run_id for audit trail ─────────────────────────

function deriveAuditHash(runId: string): string {
  let h = 0;
  for (let i = 0; i < runId.length; i++) {
    h = ((h << 5) - h + runId.charCodeAt(i)) | 0;
  }
  return `0x${Math.abs(h).toString(16).padStart(8, "0").toUpperCase()}`;
}

// ── Confidence check items ──────────────────────────────────────────

interface TrustCheck {
  label: string;
  passed: boolean;
  detail: string;
}

function deriveTrustChecks(data: RunResult, isAr: boolean): TrustCheck[] {
  const headline = data.headline;
  const explanation = data.explanation;
  const decisions = data.decisions;

  const overallConfidence = safeNumber(explanation?.confidence, 0);
  const hasNarrative = typeof explanation?.narrative_en === "string" && explanation.narrative_en.length > 20;
  const hasCausalChain = Array.isArray(explanation?.causal_chain) && explanation.causal_chain.length > 0;
  const hasActions = Array.isArray(decisions?.actions) && decisions.actions.length > 0;
  const stagesCompleted = safeNumber(data.pipeline_stages_completed, 0);

  return [
    {
      label: isAr ? "اكتمال المحرك" : "Pipeline Complete",
      passed: stagesCompleted >= 6,
      detail: `${stagesCompleted}/12 stages`,
    },
    {
      label: isAr ? "الثقة العامة" : "Overall Confidence",
      passed: overallConfidence >= 0.7,
      detail: `${Math.round(overallConfidence * 100)}%`,
    },
    {
      label: isAr ? "السلسلة السببية" : "Causal Chain",
      passed: hasCausalChain,
      detail: hasCausalChain ? `${explanation.causal_chain.length} steps` : "Missing",
    },
    {
      label: isAr ? "السرد التفسيري" : "Operational Reasoning",
      passed: hasNarrative,
      detail: hasNarrative ? "Available" : "Missing",
    },
    {
      label: isAr ? "إجراءات القرار" : "Decision Actions",
      passed: hasActions,
      detail: hasActions ? `${decisions.actions.length} actions` : "None",
    },
  ];
}

// ── Component ───────────────────────────────────────────────────────

interface TrustPanelProps {
  data: RunResult;
  lang: Language;
}

export default function TrustPanel({ data, lang }: TrustPanelProps) {
  const isAr = lang === "ar";
  const checks = deriveTrustChecks(data, isAr);
  const passedCount = checks.filter((c) => c.passed).length;
  const trustScore = Math.round((passedCount / checks.length) * 100);
  const auditHash = deriveAuditHash(safeString(data.run_id, "unknown"));
  const overallConfidence = safeNumber(data.explanation?.confidence, 0);

  const scoreColor =
    trustScore >= 80 ? "text-emerald-600" :
    trustScore >= 50 ? "text-amber-600" :
    "text-red-600";

  return (
    <section className="px-6 lg:px-10 py-5 border-b border-io-border">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-io-primary uppercase tracking-wider">
          {isAr ? "لوحة الثقة" : "Trust & Confidence"}
        </h2>
        <p className="text-[11px] text-io-secondary mt-0.5">
          {isAr ? "فحوصات الجودة ومسار التدقيق" : "Quality checks and audit trail"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Trust Score */}
        <div className="bg-io-surface border border-io-border rounded-xl p-5 text-center">
          <p className="text-[10px] text-io-secondary uppercase tracking-wider mb-2">
            {isAr ? "درجة الثقة" : "Trust Score"}
          </p>
          <p className={`text-4xl font-bold tabular-nums ${scoreColor}`}>{trustScore}%</p>
          <p className="text-xs text-io-secondary mt-1">
            {passedCount}/{checks.length} {isAr ? "فحص ناجح" : "checks passed"}
          </p>
        </div>

        {/* Checks */}
        <div className="bg-io-surface border border-io-border rounded-xl p-5">
          <p className="text-[10px] text-io-secondary uppercase tracking-wider mb-3">
            {isAr ? "فحوصات الجودة" : "Quality Checks"}
          </p>
          <div className="space-y-2">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.passed ? "bg-emerald-500" : "bg-red-400"}`} />
                  <span className="text-xs text-io-primary">{c.label}</span>
                </div>
                <span className="text-[10px] text-io-secondary tabular-nums">{c.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Trail */}
        <div className="bg-io-surface border border-io-border rounded-xl p-5">
          <p className="text-[10px] text-io-secondary uppercase tracking-wider mb-3">
            {isAr ? "مسار التدقيق" : "Audit Trail"}
          </p>
          <div className="space-y-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-io-secondary">{isAr ? "معرّف التشغيل" : "Run ID"}</span>
              <span className="text-io-primary font-mono text-[11px]">{safeString(data.run_id, "—").slice(0, 12)}…</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-io-secondary">{isAr ? "بصمة التدقيق" : "Audit Hash"}</span>
              <span className="text-io-primary font-mono text-[11px]">{auditHash}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-io-secondary">{isAr ? "الثقة" : "Confidence"}</span>
              <span className="text-io-primary font-mono text-[11px] tabular-nums">{Math.round(overallConfidence * 100)}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-io-secondary">{isAr ? "مدة التحليل" : "Duration"}</span>
              <span className="text-io-primary font-mono text-[11px] tabular-nums">{safeNumber(data.duration_ms, 0)}ms</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-io-secondary">{isAr ? "النسخة" : "Schema"}</span>
              <span className="text-io-primary font-mono text-[11px]">{safeString(data.schema_version, "—")}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
