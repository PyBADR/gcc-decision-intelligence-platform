/**
 * RegimeBadge — Displays the current macro regime with styling
 * IO design system
 */

interface RegimeBadgeProps {
  regime: string;
  confidence?: number;
  size?: "sm" | "md" | "lg";
  locale?: "en" | "ar";
}

const REGIME_CONFIG: Record<string, { bg: string; text: string; icon: string; en: string; ar: string }> = {
  expansion:    { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700",  icon: "📈", en: "Expansion",    ar: "توسع" },
  tightening:   { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",    icon: "🔧", en: "Tightening",   ar: "تشديد" },
  inflationary: { bg: "bg-orange-50 border-orange-200",    text: "text-orange-700",   icon: "🔥", en: "Inflationary", ar: "تضخمي" },
  recession:    { bg: "bg-red-50 border-red-200",          text: "text-red-700",      icon: "📉", en: "Recession",    ar: "ركود" },
  oil_boom:     { bg: "bg-green-50 border-green-200",      text: "text-green-700",    icon: "🛢️", en: "Oil Boom",     ar: "طفرة نفطية" },
  oil_shock:    { bg: "bg-red-50 border-red-300",          text: "text-red-800",      icon: "⚡", en: "Oil Shock",    ar: "صدمة نفطية" },
  neutral:      { bg: "bg-slate-50 border-slate-200",      text: "text-slate-600",    icon: "⚖️", en: "Neutral",      ar: "محايد" },
};

const SIZE_STYLES = {
  sm: "px-2 py-1 text-xs gap-1",
  md: "px-3 py-1.5 text-sm gap-1.5",
  lg: "px-4 py-2 text-base gap-2",
};

export function RegimeBadge({
  regime,
  confidence,
  size = "md",
  locale = "en",
}: RegimeBadgeProps) {
  const config = REGIME_CONFIG[regime] ?? REGIME_CONFIG.neutral;
  const sizeStyle = SIZE_STYLES[size];
  const isRtl = locale === "ar";

  return (
    <div className={`inline-flex items-center rounded-lg border font-semibold ${config.bg} ${config.text} ${sizeStyle}`}>
      <span>{config.icon}</span>
      <span>{isRtl ? config.ar : config.en}</span>
      {confidence !== undefined && (
        <span className="opacity-60 tabular-nums">
          ({(confidence * 100).toFixed(0)}%)
        </span>
      )}
    </div>
  );
}

export default RegimeBadge;
