import type { DowBucket } from "@gmd/shared";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useI18n, useDayLabels } from "@/lib/i18n";
import { tooltipStyle, tooltipLabelStyle, tooltipItemStyle } from "@/lib/chartTheme";
import { CalendarDays } from "lucide-react";

interface DowChartProps {
  byDow: DowBucket[];
}

/** Completions per day of week. Index 0 is Sunday, matching Postgres DOW. */
export function DowChart({ byDow }: DowChartProps) {
  const { t } = useI18n();
  const dayLabels = useDayLabels();

  const data = byDow.map((d) => ({
    name: dayLabels[d.dow],
    completed: d.completed,
  }));

  if (data.every((d) => d.completed === 0)) return null;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays size={15} className="text-text-secondary" />
        <h3 className="text-sm font-medium text-text-secondary">{t("stats.byDayOfWeek")}</h3>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-border)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-border)" allowDecimals={false} />
          <Tooltip
            cursor={false}
            contentStyle={tooltipStyle}
            labelStyle={tooltipLabelStyle}
            itemStyle={tooltipItemStyle}
          />
          <Bar
            dataKey="completed"
            name={t("stats.completed")}
            fill="var(--color-accent)"
            radius={[6, 6, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
