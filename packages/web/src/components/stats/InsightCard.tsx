import type { Insight, DurationBucket } from "@gmd/shared";
import { useI18n, useCategoryLabel, useDayLabels } from "@/lib/i18n";
import { Clock, TrendingUp, TrendingDown, Gauge, Repeat, CalendarDays } from "lucide-react";

const BUCKET_KEYS = {
  lt30: "bucket.lt30",
  "30to60": "bucket.30to60",
  "60to120": "bucket.60to120",
  gt120: "bucket.gt120",
} as const;

const ICONS = {
  peak_hours: Clock,
  category_drift: TrendingUp,
  estimate_bias: Gauge,
  postpone_risk: Repeat,
  best_dow: CalendarDays,
} as const;

interface InsightCardProps {
  insight: Insight;
}

/**
 * The server sends a kind plus params and never any prose, so the same insight
 * renders correctly in both locales from a single source.
 */
export function InsightCard({ insight }: InsightCardProps) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const dayLabels = useDayLabels();
  const { kind, params } = insight;

  let Icon = ICONS[kind];
  let text: string;

  switch (kind) {
    case "peak_hours":
      text = t("insight.peakHours", { from: params.from, to: params.to, pct: params.pct });
      break;
    case "category_drift": {
      const up = params.direction === "up";
      Icon = up ? TrendingUp : TrendingDown;
      text = t(up ? "insight.categoryDriftUp" : "insight.categoryDriftDown", {
        category: getCatLabel(String(params.category)),
        pct: params.pct,
        weeks: params.weeks,
      });
      break;
    }
    case "estimate_bias":
      text = t(params.direction === "over" ? "insight.estimateBiasOver" : "insight.estimateBiasUnder", {
        bucket: t(BUCKET_KEYS[params.bucket as DurationBucket]),
        pct: params.pct,
        items: params.items,
      });
      break;
    case "postpone_risk":
      // "relative" compares against other buckets; "absolute" is used when the
      // others were never postponed and a ratio would be meaningless.
      text =
        params.variant === "relative"
          ? t("insight.postponeRiskRelative", {
              bucket: t(BUCKET_KEYS[params.bucket as DurationBucket]),
              multiplier: params.multiplier,
            })
          : t("insight.postponeRiskAbsolute", {
              bucket: t(BUCKET_KEYS[params.bucket as DurationBucket]),
              avgPostpones: params.avgPostpones,
            });
      break;
    case "best_dow":
      text = t("insight.bestDow", {
        dow: dayLabels[Number(params.dow)] ?? "",
        pct: params.pct,
      });
      break;
  }

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 border-b border-border last:border-b-0">
      <Icon size={16} className="mt-0.5 flex-shrink-0 text-text-secondary" />
      <p className="text-sm leading-relaxed">
        {text}
        {insight.confidence === "low" && (
          <span className="ml-2 text-xs text-text-tertiary whitespace-nowrap">
            ({t("insight.lowConfidence")})
          </span>
        )}
      </p>
    </li>
  );
}
