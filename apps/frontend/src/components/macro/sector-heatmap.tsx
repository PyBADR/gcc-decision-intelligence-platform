/**
 * SectorHeatmap — Visual grid showing macro impact on each GCC sector
 * IO design system
 */

interface SectorImpact {
  sector: string;
  impact_score: number;
  direction: "up" | "down" | "neutral";
  reasoning: string;
}

interface SectorHeatmapProps {
  impacts: SectorImpact[];
  locale?: "en" | "ar";
}

const SECTOR_NAMES: Record<string, { en: string; ar: string }> = {
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

function getImpactColor(score: number): string {
  const abs = Math.abs(score);
  if (score < -0.3) return "bg-red-100 border-red-200";
  if (score < -0.1) return "bg-amber-50 border-amber-200";
  if (score > 0.3)  return "bg-green-100 border-green-200";
  if (score > 0.1)  return "bg-emerald-50 border-emerald-200";
  return "bg-io-bg border-io-border";
}

function getScoreColor(score: number): string {
  if (score < -0.2) return "text-io-danger";
  if (score < 0)    return "text-io-warning";
  if (score > 0.2)  return "text-io-success";
  if (score > 0)    return "text-io-low";
  return "text-io-secondary";
}

export function SectorHeatmap({ impacts, locale = "en" }: SectorHeatmapProps) {
  const isRtl = locale === "ar";

  // Sort by absolute impact (most impacted first)
  const sorted = [...impacts].sort((a, b) => Math.abs(b.impact_score) - Math.abs(a.impact_score));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {sorted.map((si) => {
        const name = SECTOR_NAMES[si.sector];
        return (
          <div
            key={si.sector}
            className={`p-4 rounded-xl border transition-all hover:shadow-md ${getImpactColor(si.impact_score)}`}
          >
            <p className="text-xs font-semibold text-io-primary mb-1">
              {name ? (isRtl ? name.ar : name.en) : si.sector}
            </p>
            <p className={`text-xl font-bold tabular-nums ${getScoreColor(si.impact_score)}`}>
              {si.impact_score > 0 ? "+" : ""}{(si.impact_score * 100).toFixed(1)}%
            </p>
            <div className="h-1.5 bg-white/60 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${si.impact_score < 0 ? "bg-io-danger" : "bg-io-success"}`}
                style={{ width: `${Math.min(Math.abs(si.impact_score) * 200, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-io-secondary mt-2 line-clamp-2">{si.reasoning}</p>
          </div>
        );
      })}
    </div>
  );
}

export default SectorHeatmap;
