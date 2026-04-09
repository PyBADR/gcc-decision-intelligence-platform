"use client";

/**
 * Decision Intelligence Dashboard | لوحة ذكاء القرارات
 *
 * Governance + Audit + Traceability interface.
 * Connects to: /api/v1/audit/* and /api/v1/decision/*
 *
 * Sections:
 *   1. Metrics cards — totals, approval rate, avg risk, chain health
 *   2. Filters panel — entity, sector, decision, status
 *   3. Decisions table — sortable, clickable rows
 *   4. Decision detail drawer — full context, audit trail, outcomes
 *   5. Charts — decision distribution, sector breakdown, risk histogram
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import type {
  DecisionRecord,
  AuditStats,
  AuditTrailRecord,
  OutcomeRecord,
  AuditHealth,
} from "@/services/audit-api";
import {
  fetchDecisions,
  fetchStatistics,
  fetchDecisionDetail,
  fetchAuditTrail,
  fetchOutcomes,
  recordOutcome,
  verifyChain,
  fetchAuditHealth,
  runDecisionEval,
} from "@/services/audit-api";

// ─── Types ──────────────────────────────────────────────────────────────────

type Language = "en" | "ar";
type DecisionFilter = "ALL" | "APPROVED" | "CONDITIONAL" | "REJECTED";
type SortKey = "created_at" | "risk_score" | "entity_label" | "decision";

// ─── Color maps ─────────────────────────────────────────────────────────────

const DECISION_COLORS: Record<string, string> = {
  APPROVED: "bg-io-success/10 text-io-success border-io-success/30",
  CONDITIONAL: "bg-io-warning/10 text-io-warning border-io-warning/30",
  REJECTED: "bg-io-danger/10 text-io-danger border-io-danger/30",
};

const DECISION_DOT: Record<string, string> = {
  APPROVED: "bg-io-success",
  CONDITIONAL: "bg-io-warning",
  REJECTED: "bg-io-danger",
};

const RISK_COLORS: Record<string, string> = {
  NOMINAL: "text-io-nominal",
  LOW: "text-io-low",
  GUARDED: "text-io-moderate",
  ELEVATED: "text-io-elevated",
  HIGH: "text-io-danger",
  SEVERE: "text-io-critical",
  CRITICAL: "text-io-critical",
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AuditDashboardPage() {
  const [locale, setLocale] = useState<Language>("en");
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [health, setHealth] = useState<AuditHealth | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [filterDecision, setFilterDecision] = useState<DecisionFilter>("ALL");
  const [filterSector, setFilterSector] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDesc, setSortDesc] = useState(true);

  // New evaluation form
  const [showEvalForm, setShowEvalForm] = useState(false);

  const isRtl = locale === "ar";

  // ── Data loading ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, healthRes, decisionsRes] = await Promise.all([
        fetchStatistics(),
        fetchAuditHealth(),
        fetchDecisions({
          decision: filterDecision === "ALL" ? undefined : filterDecision,
          sector: filterSector || undefined,
          entity_id: filterEntity || undefined,
          limit: 100,
        }),
      ]);
      setStats(statsRes);
      setHealth(healthRes);
      setDecisions(decisionsRes.decisions);
      setTotal(decisionsRes.total);
    } catch (e) {
      console.error("Failed to load audit data:", e);
    } finally {
      setLoading(false);
    }
  }, [filterDecision, filterSector, filterEntity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Sorted decisions ───────────────────────────────────────────────────
  const sortedDecisions = useMemo(() => {
    const sorted = [...decisions].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "risk_score":
          cmp = a.risk_score - b.risk_score;
          break;
        case "entity_label":
          cmp = a.entity_label.localeCompare(b.entity_label);
          break;
        case "decision":
          cmp = a.decision.localeCompare(b.decision);
          break;
        default:
          cmp = a.created_at.localeCompare(b.created_at);
      }
      return sortDesc ? -cmp : cmp;
    });
    return sorted;
  }, [decisions, sortKey, sortDesc]);

  // ── Sectors for filter ─────────────────────────────────────────────────
  const sectors = useMemo(() => {
    const s = new Set(decisions.map((d) => d.sector));
    return Array.from(s).sort();
  }, [decisions]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-io-bg" dir={isRtl ? "rtl" : "ltr"}>
      <NavBar locale={locale} onLocaleToggle={() => setLocale(isRtl ? "en" : "ar")} />

      <main className="max-w-[1440px] mx-auto px-4 py-6 space-y-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-io-primary">
              {isRtl ? "لوحة حوكمة القرارات" : "Decision Governance Dashboard"}
            </h1>
            <p className="text-sm text-io-secondary mt-0.5">
              {isRtl
                ? "تتبع القرارات · سلسلة التدقيق · تحليل الأداء"
                : "Decision tracking · Audit chain · Performance analytics"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEvalForm(!showEvalForm)}
              className="px-4 py-2 bg-io-accent text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors"
            >
              {isRtl ? "+ تقييم جديد" : "+ New Evaluation"}
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 border border-io-border rounded-lg text-sm text-io-secondary hover:bg-white transition-colors"
            >
              {isRtl ? "تحديث" : "Refresh"}
            </button>
          </div>
        </div>

        {/* ── New Evaluation Form ────────────────────────────────── */}
        {showEvalForm && (
          <EvalForm
            locale={locale}
            onClose={() => setShowEvalForm(false)}
            onSuccess={() => {
              setShowEvalForm(false);
              loadData();
            }}
          />
        )}

        {/* ── Metrics Cards ──────────────────────────────────────── */}
        {stats && health && <MetricsCards stats={stats} health={health} locale={locale} />}

        {/* ── Charts Row ─────────────────────────────────────────── */}
        {stats && <ChartsRow stats={stats} locale={locale} />}

        {/* ── Filters ────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-io-border px-4 py-3">
          <span className="text-xs font-semibold text-io-secondary uppercase tracking-wide">
            {isRtl ? "تصفية" : "Filter"}
          </span>
          {/* Decision type */}
          <div className="flex gap-1">
            {(["ALL", "APPROVED", "CONDITIONAL", "REJECTED"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setFilterDecision(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterDecision === d
                    ? "bg-io-accent text-white"
                    : "bg-io-bg text-io-secondary hover:bg-io-border"
                }`}
              >
                {d === "ALL" ? (isRtl ? "الكل" : "All") : d}
              </button>
            ))}
          </div>
          {/* Sector */}
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="px-3 py-1.5 border border-io-border rounded-lg text-xs bg-white"
          >
            <option value="">{isRtl ? "كل القطاعات" : "All Sectors"}</option>
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {/* Entity search */}
          <input
            type="text"
            placeholder={isRtl ? "بحث عن كيان..." : "Search entity..."}
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-3 py-1.5 border border-io-border rounded-lg text-xs w-40"
          />
          {/* Results count */}
          <span className="text-xs text-io-secondary ms-auto">
            {total} {isRtl ? "قرار" : "decisions"}
          </span>
        </div>

        {/* ── Decisions Table ────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-white rounded-xl border border-io-border animate-pulse" />
            ))}
          </div>
        ) : (
          <DecisionsTable
            decisions={sortedDecisions}
            sortKey={sortKey}
            sortDesc={sortDesc}
            onSort={handleSort}
            onSelect={setSelectedId}
            selectedId={selectedId}
            locale={locale}
          />
        )}

        {/* ── Decision Detail Drawer ─────────────────────────────── */}
        {selectedId && (
          <DecisionDetailDrawer
            decisionId={selectedId}
            onClose={() => setSelectedId(null)}
            onOutcomeRecorded={loadData}
            locale={locale}
          />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── NavBar ─────────────────────────────────────────────────────────────────

function NavBar({ locale, onLocaleToggle }: { locale: Language; onLocaleToggle: () => void }) {
  const isRtl = locale === "ar";
  return (
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
          <Link href="/dashboard" className="text-sm text-io-secondary hover:text-io-accent transition-colors">
            {isRtl ? "لوحة المعلومات" : "Dashboard"}
          </Link>
          <Link href="/macro" className="text-sm text-io-secondary hover:text-io-accent transition-colors">
            {isRtl ? "الاقتصاد الكلي" : "Macro"}
          </Link>
          <Link href="/audit-dashboard" className="text-sm text-io-accent font-medium">
            {isRtl ? "الحوكمة" : "Governance"}
          </Link>
        </div>
        <button
          onClick={onLocaleToggle}
          className="px-3 py-1 border border-io-border rounded text-xs font-semibold text-io-secondary hover:bg-io-bg transition-colors"
        >
          {isRtl ? "EN" : "AR"}
        </button>
      </div>
    </nav>
  );
}

// ─── Metrics Cards ──────────────────────────────────────────────────────────

function MetricsCards({
  stats,
  health,
  locale,
}: {
  stats: AuditStats;
  health: AuditHealth;
  locale: Language;
}) {
  const isRtl = locale === "ar";
  const approvalRate =
    stats.total_decisions > 0
      ? Math.round(((stats.by_decision?.APPROVED ?? 0) / stats.total_decisions) * 100)
      : 0;

  const cards = [
    {
      label: isRtl ? "إجمالي القرارات" : "Total Decisions",
      value: stats.total_decisions,
      sub: `${stats.total_audit_records} ${isRtl ? "سجل تدقيق" : "audit records"}`,
      color: "text-io-accent",
    },
    {
      label: isRtl ? "معدل الموافقة" : "Approval Rate",
      value: `${approvalRate}%`,
      sub: `${stats.by_decision?.APPROVED ?? 0} / ${stats.total_decisions}`,
      color: approvalRate > 60 ? "text-io-success" : "text-io-warning",
    },
    {
      label: isRtl ? "متوسط المخاطر" : "Avg Risk Score",
      value: stats.average_risk_score.toFixed(3),
      sub: `${isRtl ? "ثقة" : "confidence"}: ${(stats.average_confidence * 100).toFixed(0)}%`,
      color:
        stats.average_risk_score > 0.5 ? "text-io-danger" : stats.average_risk_score > 0.3 ? "text-io-warning" : "text-io-success",
    },
    {
      label: isRtl ? "متوسط الأداء" : "Avg Latency",
      value: `${stats.average_timing_ms.toFixed(1)}ms`,
      sub: `${stats.total_outcomes} ${isRtl ? "نتيجة مسجلة" : "outcomes"}`,
      color: "text-io-secondary",
    },
    {
      label: isRtl ? "سلامة السلسلة" : "Chain Integrity",
      value: health.chain_valid ? (isRtl ? "سليمة" : "Valid") : (isRtl ? "تحذير" : "Warning"),
      sub: `${health.chain_breaks} ${isRtl ? "قطع" : "breaks"}`,
      color: health.chain_valid ? "text-io-success" : "text-io-danger",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c, i) => (
        <div key={i} className="bg-white rounded-xl border border-io-border p-4">
          <p className="text-xs text-io-secondary font-medium mb-1">{c.label}</p>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-io-secondary/60 mt-1">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Charts Row ─────────────────────────────────────────────────────────────

function ChartsRow({ stats, locale }: { stats: AuditStats; locale: Language }) {
  const isRtl = locale === "ar";
  const total = stats.total_decisions || 1;
  const decisionData = [
    { label: "APPROVED", count: stats.by_decision?.APPROVED ?? 0, color: "bg-io-success" },
    { label: "CONDITIONAL", count: stats.by_decision?.CONDITIONAL ?? 0, color: "bg-io-warning" },
    { label: "REJECTED", count: stats.by_decision?.REJECTED ?? 0, color: "bg-io-danger" },
  ];

  const sectorData = Object.entries(stats.by_sector)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxSector = Math.max(...sectorData.map(([, v]) => v), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Decision Distribution */}
      <div className="bg-white rounded-xl border border-io-border p-5">
        <h3 className="text-sm font-semibold text-io-primary mb-4">
          {isRtl ? "توزيع القرارات" : "Decision Distribution"}
        </h3>
        <div className="flex gap-3 mb-4">
          {decisionData.map((d) => (
            <div key={d.label} className="flex-1 text-center">
              <div className="text-2xl font-bold text-io-primary">{d.count}</div>
              <div className="text-xs text-io-secondary">{d.label}</div>
              <div className="mt-2 h-2 rounded-full bg-io-bg overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.color} transition-all duration-500`}
                  style={{ width: `${(d.count / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Stacked bar */}
        <div className="h-8 rounded-lg overflow-hidden flex">
          {decisionData.map((d) => (
            <div
              key={d.label}
              className={`${d.color} transition-all duration-500 flex items-center justify-center`}
              style={{ width: `${(d.count / total) * 100}%` }}
            >
              {d.count > 0 && (
                <span className="text-xs text-white font-semibold">
                  {Math.round((d.count / total) * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sector Breakdown */}
      <div className="bg-white rounded-xl border border-io-border p-5">
        <h3 className="text-sm font-semibold text-io-primary mb-4">
          {isRtl ? "القرارات حسب القطاع" : "Decisions by Sector"}
        </h3>
        <div className="space-y-2">
          {sectorData.map(([sector, count]) => (
            <div key={sector} className="flex items-center gap-3">
              <span className="text-xs text-io-secondary w-24 truncate">{sector}</span>
              <div className="flex-1 h-5 rounded bg-io-bg overflow-hidden">
                <div
                  className="h-full rounded bg-io-accent/70 transition-all duration-500"
                  style={{ width: `${(count / maxSector) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-io-primary w-8 text-end">
                {count}
              </span>
            </div>
          ))}
          {sectorData.length === 0 && (
            <p className="text-xs text-io-secondary/60 text-center py-4">
              {isRtl ? "لا توجد بيانات" : "No data yet"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Decisions Table ────────────────────────────────────────────────────────

function DecisionsTable({
  decisions,
  sortKey,
  sortDesc,
  onSort,
  onSelect,
  selectedId,
  locale,
}: {
  decisions: DecisionRecord[];
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  locale: Language;
}) {
  const isRtl = locale === "ar";
  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDesc ? " ↓" : " ↑") : "";

  if (decisions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-io-border p-12 text-center">
        <p className="text-io-secondary text-sm">
          {isRtl
            ? "لا توجد قرارات مسجلة بعد. شغّل تقييم جديد من الزر أعلاه."
            : "No decisions logged yet. Run a new evaluation using the button above."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-io-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-io-border bg-io-bg/50">
            {[
              { key: "entity_label" as SortKey, en: "Entity", ar: "الكيان" },
              { key: "decision" as SortKey, en: "Decision", ar: "القرار" },
              { key: "risk_score" as SortKey, en: "Risk", ar: "المخاطر" },
              { key: null, en: "Sector", ar: "القطاع" },
              { key: null, en: "Pricing", ar: "التسعير" },
              { key: null, en: "Coverage", ar: "التغطية" },
              { key: "created_at" as SortKey, en: "Time", ar: "الوقت" },
            ].map((col, i) => (
              <th
                key={i}
                onClick={col.key ? () => onSort(col.key!) : undefined}
                className={`px-4 py-3 text-start text-xs font-semibold text-io-secondary uppercase tracking-wide ${
                  col.key ? "cursor-pointer hover:text-io-accent" : ""
                }`}
              >
                {isRtl ? col.ar : col.en}
                {col.key && arrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`border-b border-io-border/50 cursor-pointer transition-colors ${
                selectedId === d.id
                  ? "bg-io-accent/5"
                  : "hover:bg-io-bg/50"
              }`}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-io-primary">{d.entity_label || d.entity_id}</div>
                <div className="text-xs text-io-secondary/60 font-mono">{d.id.slice(0, 8)}</div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    DECISION_COLORS[d.decision] ?? ""
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${DECISION_DOT[d.decision] ?? ""}`} />
                  {d.decision}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`font-semibold ${RISK_COLORS[d.risk_level] ?? "text-io-secondary"}`}>
                  {d.risk_score.toFixed(3)}
                </span>
                <div className="text-xs text-io-secondary/60">{d.risk_level}</div>
              </td>
              <td className="px-4 py-3 text-io-secondary">{d.sector}</td>
              <td className="px-4 py-3 text-xs text-io-secondary">
                {d.pricing?.premium_impact || d.pricing?.adjustment?.split("—")[0]?.trim() || "—"}
              </td>
              <td className="px-4 py-3 text-xs text-io-secondary">
                {d.coverage?.utilization_pct != null ? `${d.coverage.utilization_pct}%` : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-io-secondary/60">
                {new Date(d.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Decision Detail Drawer ─────────────────────────────────────────────────

function DecisionDetailDrawer({
  decisionId,
  onClose,
  onOutcomeRecorded,
  locale,
}: {
  decisionId: string;
  onClose: () => void;
  onOutcomeRecorded: () => void;
  locale: Language;
}) {
  const isRtl = locale === "ar";
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [trail, setTrail] = useState<AuditTrailRecord[]>([]);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "macro" | "graph" | "portfolio" | "audit" | "outcomes">("overview");
  const [outcomeInput, setOutcomeInput] = useState("");

  useEffect(() => {
    setActiveTab("overview");
    Promise.all([
      fetchDecisionDetail(decisionId),
      fetchAuditTrail(decisionId),
      fetchOutcomes(decisionId),
    ]).then(([d, t, o]) => {
      setDecision(d);
      setTrail(t.audit_records || []);
      setOutcomes(o.outcomes || []);
    });
  }, [decisionId]);

  const handleRecordOutcome = async () => {
    if (!outcomeInput) return;
    await recordOutcome({
      decision_id: decisionId,
      outcome: outcomeInput,
      notes: `Recorded via dashboard at ${new Date().toISOString()}`,
    });
    const o = await fetchOutcomes(decisionId);
    setOutcomes(o.outcomes || []);
    setOutcomeInput("");
    onOutcomeRecorded();
  };

  if (!decision) return null;

  const tabs = [
    { key: "overview" as const, en: "Overview", ar: "نظرة عامة" },
    { key: "macro" as const, en: "Macro", ar: "الاقتصاد الكلي" },
    { key: "graph" as const, en: "Graph", ar: "الرسم البياني" },
    { key: "portfolio" as const, en: "Portfolio", ar: "المحفظة" },
    { key: "audit" as const, en: "Audit Trail", ar: "سلسلة التدقيق" },
    { key: "outcomes" as const, en: "Outcomes", ar: "النتائج" },
  ];

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-io-border px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-io-primary">
                {decision.entity_label || decision.entity_id}
              </h2>
              <p className="text-xs text-io-secondary font-mono">{decision.id}</p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1.5 rounded-full text-sm font-bold border ${
                  DECISION_COLORS[decision.decision] ?? ""
                }`}
              >
                {decision.decision}
              </span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg border border-io-border flex items-center justify-center text-io-secondary hover:bg-io-bg"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm text-io-secondary mt-2">{decision.decision_summary}</p>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.key
                    ? "bg-io-accent text-white"
                    : "text-io-secondary hover:bg-io-bg"
                }`}
              >
                {isRtl ? t.ar : t.en}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {activeTab === "overview" && (
            <>
              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3">
                <MetricBox
                  label={isRtl ? "درجة المخاطر" : "Risk Score"}
                  value={decision.risk_score.toFixed(4)}
                  sub={decision.risk_level}
                  color={RISK_COLORS[decision.risk_level]}
                />
                <MetricBox
                  label={isRtl ? "الثقة" : "Confidence"}
                  value={`${(decision.confidence * 100).toFixed(0)}%`}
                />
                <MetricBox
                  label={isRtl ? "الأداء" : "Latency"}
                  value={`${decision.timing_ms}ms`}
                />
              </div>

              {/* Pricing & Coverage */}
              <Section title={isRtl ? "التسعير والتغطية" : "Pricing & Coverage"}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-io-secondary text-xs">{isRtl ? "التسعير" : "Pricing"}</span>
                    <p className="font-medium">{decision.pricing?.adjustment || "—"}</p>
                  </div>
                  <div>
                    <span className="text-io-secondary text-xs">{isRtl ? "التغطية" : "Coverage"}</span>
                    <p className="font-medium">
                      {decision.coverage?.approved_limit != null
                        ? `${(decision.coverage.approved_limit).toLocaleString()} / ${(decision.coverage.requested ?? 0).toLocaleString()}`
                        : "—"}
                      {decision.coverage?.utilization_pct != null && (
                        <span className="text-io-secondary text-xs ms-1">
                          ({decision.coverage.utilization_pct}%)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </Section>

              {/* Conditions */}
              {decision.conditions.length > 0 && (
                <Section title={isRtl ? "الشروط" : `Conditions (${decision.conditions.length})`}>
                  <ul className="space-y-1">
                    {decision.conditions.map((c, i) => (
                      <li key={i} className="text-sm text-io-secondary flex gap-2">
                        <span className="text-io-warning mt-0.5">●</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Explanation */}
              <Section title={isRtl ? "التفسير" : "Explanation"}>
                <ol className="space-y-1.5">
                  {decision.explanation.map((e, i) => (
                    <li key={i} className="text-sm text-io-secondary flex gap-2">
                      <span className="text-io-accent font-mono text-xs w-5 shrink-0">{i + 1}.</span>
                      {e}
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          )}

          {activeTab === "macro" && (
            <ContextPanel
              title={isRtl ? "سياق الاقتصاد الكلي" : "Macro Context"}
              data={decision.macro_context}
            />
          )}

          {activeTab === "graph" && (
            <ContextPanel
              title={isRtl ? "سياق الرسم البياني" : "Graph Context"}
              data={decision.graph_context}
            />
          )}

          {activeTab === "portfolio" && (
            <ContextPanel
              title={isRtl ? "سياق المحفظة" : "Portfolio Context"}
              data={decision.portfolio_context || { message: isRtl ? "لا يوجد محفظة" : "No portfolio context" }}
            />
          )}

          {activeTab === "audit" && (
            <div className="space-y-3">
              {trail.length === 0 ? (
                <p className="text-sm text-io-secondary/60 text-center py-8">
                  {isRtl ? "لا توجد سجلات تدقيق" : "No audit records"}
                </p>
              ) : (
                trail.map((a, i) => (
                  <div key={a.id} className="bg-io-bg rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-io-primary">
                        {isRtl ? `سجل تدقيق ${i + 1}` : `Audit Record ${i + 1}`}
                      </span>
                      <span className="text-xs text-io-secondary/60">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    <HashRow label="Chain" hash={a.chain_hash} />
                    <HashRow label="Input" hash={a.input_hash} />
                    <HashRow label="Output" hash={a.output_hash} />
                    <HashRow label="Unified" hash={a.unified_hash} />
                    <HashRow label="Macro" hash={a.macro_hash} />
                    <HashRow label="Previous" hash={a.previous_hash || "—"} />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "outcomes" && (
            <div className="space-y-4">
              {/* Record new outcome */}
              <div className="bg-io-bg rounded-lg p-4">
                <h4 className="text-sm font-semibold text-io-primary mb-2">
                  {isRtl ? "تسجيل نتيجة" : "Record Outcome"}
                </h4>
                <div className="flex gap-2">
                  <select
                    value={outcomeInput}
                    onChange={(e) => setOutcomeInput(e.target.value)}
                    className="flex-1 px-3 py-2 border border-io-border rounded-lg text-sm"
                  >
                    <option value="">{isRtl ? "اختر النتيجة..." : "Select outcome..."}</option>
                    <option value="NO_LOSS">{isRtl ? "لا خسارة" : "No Loss"}</option>
                    <option value="LOSS">{isRtl ? "خسارة" : "Loss"}</option>
                    <option value="CLAIM">{isRtl ? "مطالبة" : "Claim"}</option>
                    <option value="PARTIAL_LOSS">{isRtl ? "خسارة جزئية" : "Partial Loss"}</option>
                  </select>
                  <button
                    onClick={handleRecordOutcome}
                    disabled={!outcomeInput}
                    className="px-4 py-2 bg-io-accent text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                  >
                    {isRtl ? "تسجيل" : "Record"}
                  </button>
                </div>
              </div>
              {/* Existing outcomes */}
              {outcomes.length > 0 ? (
                outcomes.map((o) => (
                  <div key={o.id} className="bg-white border border-io-border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        o.outcome === "NO_LOSS" ? "bg-io-success/10 text-io-success" : "bg-io-danger/10 text-io-danger"
                      }`}>
                        {o.outcome}
                      </span>
                      <span className="text-xs text-io-secondary/60">
                        {new Date(o.observed_at).toLocaleString()}
                      </span>
                    </div>
                    {o.notes && <p className="text-sm text-io-secondary mt-2">{o.notes}</p>}
                  </div>
                ))
              ) : (
                <p className="text-sm text-io-secondary/60 text-center py-8">
                  {isRtl ? "لا توجد نتائج مسجلة بعد" : "No outcomes recorded yet"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── New Evaluation Form ────────────────────────────────────────────────────

function EvalForm({
  locale,
  onClose,
  onSuccess,
}: {
  locale: Language;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isRtl = locale === "ar";
  const [entityId, setEntityId] = useState("hormuz");
  const [sector, setSector] = useState("maritime");
  const [coverage, setCoverage] = useState("5000000");
  const [portfolio, setPortfolio] = useState("");
  const [oil, setOil] = useState("80");
  const [inflation, setInflation] = useState("0.025");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await runDecisionEval({
        entity_id: entityId,
        sector: sector || undefined,
        portfolio_id: portfolio || undefined,
        requested_coverage: Number(coverage),
        indicators: {
          brent_crude: Number(oil),
          inflation: Number(inflation),
        },
      });
      setResult(r);
      onSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-io-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-io-primary">
          {isRtl ? "تقييم جديد" : "New Decision Evaluation"}
        </h3>
        <button onClick={onClose} className="text-io-secondary hover:text-io-accent text-sm">✕</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Entity ID" value={entityId} onChange={setEntityId} />
        <Field label="Sector" value={sector} onChange={setSector} />
        <Field label="Coverage" value={coverage} onChange={setCoverage} type="number" />
        <Field label="Portfolio" value={portfolio} onChange={setPortfolio} placeholder="gcc_energy" />
        <Field label="Oil ($/bbl)" value={oil} onChange={setOil} type="number" />
        <Field label="Inflation" value={inflation} onChange={setInflation} type="number" />
        <div className="col-span-2 flex items-end">
          <button
            onClick={handleRun}
            disabled={running}
            className="w-full px-4 py-2 bg-io-accent text-white rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {running ? (isRtl ? "جارٍ..." : "Running...") : (isRtl ? "تشغيل التقييم" : "Run Evaluation")}
          </button>
        </div>
      </div>
      {result && (
        <div className="mt-4 bg-io-bg rounded-lg p-3">
          <span className={`text-sm font-bold ${
            result.decision?.decision === "APPROVED" ? "text-io-success"
            : result.decision?.decision === "REJECTED" ? "text-io-danger" : "text-io-warning"
          }`}>
            {result.decision?.decision}
          </span>
          <span className="text-sm text-io-secondary mx-2">|</span>
          <span className="text-sm text-io-secondary">
            Risk: {result.decision?.risk_score?.toFixed(4)} · {result.decision?.pricing?.premium_impact}
          </span>
          {result.logging?.logged && (
            <span className="text-xs text-io-success ms-2">✓ Logged</span>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

function MetricBox({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-io-bg rounded-lg p-3">
      <p className="text-xs text-io-secondary">{label}</p>
      <p className={`text-xl font-bold ${color || "text-io-primary"}`}>{value}</p>
      {sub && <p className="text-xs text-io-secondary/60">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-io-bg rounded-lg p-4">
      <h4 className="text-xs font-semibold text-io-secondary uppercase tracking-wide mb-3">{title}</h4>
      {children}
    </div>
  );
}

function ContextPanel({ title, data }: { title: string; data: Record<string, any> }) {
  return (
    <div className="bg-io-bg rounded-lg p-4">
      <h4 className="text-sm font-semibold text-io-primary mb-3">{title}</h4>
      <pre className="text-xs text-io-secondary overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function HashRow({ label, hash }: { label: string; hash: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-io-secondary w-16">{label}:</span>
      <code className="text-io-primary font-mono bg-white px-2 py-0.5 rounded text-[11px] truncate flex-1">
        {hash}
      </code>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-io-secondary block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-io-border rounded-lg text-sm"
      />
    </div>
  );
}
