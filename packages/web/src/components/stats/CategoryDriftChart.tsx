import type { CategoryWeekPoint } from "@gmd/shared";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { tooltipStyle, tooltipLabelStyle, tooltipItemStyle } from "@/lib/chartTheme";
import { formatDuration } from "@gmd/shared";
import { TrendingUp } from "lucide-react";

interface CategoryDriftChartProps {
  points: CategoryWeekPoint[];
}

/** Weekly minutes per category — makes a category quietly fading out visible. */
export function CategoryDriftChart({ points }: CategoryDriftChartProps) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryColor } = useCategories();

  const weeks = [...new Set(points.map((p) => p.week))].sort();
  const categories = [...new Set(points.map((p) => p.category))];

  // Needs at least two weeks to read as a trend rather than a single dot.
  if (weeks.length < 2 || categories.length === 0) return null;

  const byWeek = new Map(weeks.map((w) => [w, { week: w } as Record<string, string | number>]));
  for (const p of points) {
    byWeek.get(p.week)![p.category] = p.minutes;
  }
  const data = weeks.map((w) => {
    const row = byWeek.get(w)!;
    for (const cat of categories) if (row[cat] === undefined) row[cat] = 0;
    return row;
  });

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={15} className="text-text-secondary" />
        <h3 className="text-sm font-medium text-text-secondary">{t("stats.categoryDrift")}</h3>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="var(--color-border)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-border)" allowDecimals={false} />
          <Tooltip
            formatter={(v: number) => formatDuration(v)}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          {categories.map((cat) => (
            <Line
              key={cat}
              type="monotone"
              dataKey={cat}
              name={getCatLabel(cat)}
              stroke={getCategoryColor(cat)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center">
        {categories.map((cat) => (
          <span key={cat} className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: getCategoryColor(cat) }}
            />
            {getCatLabel(cat)}
          </span>
        ))}
      </div>
    </div>
  );
}
