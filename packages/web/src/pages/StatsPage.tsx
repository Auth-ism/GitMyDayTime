import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDuration } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { Flame, Clock, CheckCircle, TrendingUp, BarChart3, Target, Gauge } from "lucide-react";
import { cn } from "@/lib/cn";

export default function StatsPage() {
  const { t, locale } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryColor } = useCategories();
  const dateLoc = locale === "tr" ? "tr-TR" : "en-US";
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", "30d"],
    queryFn: () => api.getStats(),
  });

  const { data: yearlyActivity = [] } = useQuery({
    queryKey: ["stats", "yearly"],
    queryFn: () => api.getYearlyActivity(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t("stats.loading")}>
        <div className="h-7 w-32 bg-bg-tertiary rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 w-8 bg-bg-tertiary rounded mx-auto mb-3" />
              <div className="h-6 w-12 bg-bg-tertiary rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-bg-tertiary rounded mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const categoryData = Object.entries(stats.byCategory)
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => ({
      name: getCatLabel(key),
      count: v.count,
      minutes: v.minutes,
      fill: getCategoryColor(key),
    }));

  const yAxisWidth = categoryData.length > 0
    ? Math.min(Math.max(...categoryData.map((c) => c.name.length * 6 + 8), 40), 120)
    : 60;

  const activityData = stats.dailyActivity.map((d) => {
    const dt = new Date(d.date + "T12:00:00");
    return {
      date: dt.toLocaleDateString(dateLoc, { month: "short", day: "numeric" }),
      tasks: d.tasks,
      minutes: d.minutes,
    };
  });

  const tooltipStyle = {
    background: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--color-text)",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
  };

  const tooltipLabelStyle = {
    color: "var(--color-text)",
    fontWeight: 600,
    marginBottom: "2px",
  };

  const tooltipItemStyle = {
    color: "var(--color-text-secondary)",
  };

  // Build a 365-day heatmap grid
  const heatmapMap = new Map(yearlyActivity.map((a) => [a.date, a.count]));
  const today = new Date();
  const heatmapDays: { date: string; count: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    heatmapDays.push({ date: key, count: heatmapMap.get(key) ?? 0 });
  }

  // Group into weeks
  const startDow = new Date(heatmapDays[0].date + "T12:00:00").getDay();
  const paddedDays = [
    ...Array.from({ length: startDow }, (_, i) => ({ date: "", count: -1 })),
    ...heatmapDays,
  ];
  const weeks: typeof paddedDays[] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  const maxCount = Math.max(...heatmapDays.map((d) => d.count), 1);

  function heatColor(count: number): string {
    if (count <= 0) return "var(--color-bg-tertiary)";
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return "#c6f0d4";
    if (intensity < 0.5) return "#86efac";
    if (intensity < 0.75) return "#4ade80";
    return "#16a34a";
  }

  // Category completion rates
  const categoryRates = stats.categoryRates ?? {};
  const rateData = Object.entries(categoryRates)
    .filter(([, v]) => v.total > 0)
    .map(([key, v]) => ({
      name: getCatLabel(key),
      rate: Math.round((v.completed / v.total) * 100),
      fill: getCategoryColor(key),
    }))
    .sort((a, b) => b.rate - a.rate);

  // Estimate accuracy
  const accuracy = stats.estimateAccuracy;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold flex items-center gap-2">
        <BarChart3 size={20} className="text-text-secondary" />
        {t("stats.title")}
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3" role="list">
        {[
          { icon: CheckCircle, label: t("stats.completed"), value: String(stats.totalTasks), color: "text-success" },
          { icon: Clock, label: t("stats.timeTracked"), value: stats.totalMinutes > 0 ? formatDuration(stats.totalMinutes) : "0m", color: "text-text-secondary" },
          { icon: Flame, label: t("stats.streak"), value: `${stats.streak}d`, color: "text-[#f59e0b]" },
          { icon: TrendingUp, label: t("stats.daysActive"), value: String(stats.daysTracked), color: "text-text-secondary" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            role="listitem"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card text-center"
          >
            <Icon size={18} className={`mx-auto mb-2 ${color}`} />
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-text-secondary mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Estimate vs Actual */}
      {accuracy && accuracy.count > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Gauge size={15} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-secondary">Tahmin vs Gercek</h3>
            <span className="text-xs text-text-tertiary">({accuracy.count} tamamlanan)</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-bg-secondary rounded-xl">
              <p className="text-2xl font-bold">{formatDuration(accuracy.avgEstimate)}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Ortalama Tahmin</p>
            </div>
            <div className="text-center p-3 bg-bg-secondary rounded-xl">
              <p className="text-2xl font-bold text-success">{formatDuration(accuracy.avgActual)}</p>
              <p className="text-xs text-text-tertiary mt-0.5">Ortalama Gercek</p>
            </div>
          </div>
          {accuracy.avgEstimate > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-text-tertiary mb-1">
                <span>Tahmin dogrulugu</span>
                <span>{Math.round((accuracy.avgActual / accuracy.avgEstimate) * 100)}%</span>
              </div>
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all"
                  style={{ width: `${Math.min(100, (accuracy.avgActual / accuracy.avgEstimate) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity over time */}
      {activityData.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-text-secondary mb-4">{t("stats.dailyActivity")}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-border)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-border)" allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Area
                type="monotone"
                dataKey="tasks"
                name={t("stats.completed")}
                stroke="var(--color-accent)"
                fill="var(--color-accent)"
                fillOpacity={0.08}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Yearly heatmap */}
      {yearlyActivity.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target size={15} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-secondary">Yillik Aktivite</h3>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-0.5 min-w-max">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => (
                    <div
                      key={di}
                      title={day.date ? `${day.date}: ${day.count}` : ""}
                      className="w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor: day.count < 0 ? "transparent" : heatColor(day.count),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className="text-xs text-text-tertiary">Az</span>
            {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: v === 0 ? "var(--color-bg-tertiary)" : heatColor(Math.ceil(v * maxCount)) }}
              />
            ))}
            <span className="text-xs text-text-tertiary">Cok</span>
          </div>
        </div>
      )}

      {/* Category completion rates */}
      {rateData.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-medium text-text-secondary mb-4">Kategori Tamamlama Orani</h3>
          <div className="space-y-2">
            {rateData.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">{item.name}</span>
                  <span className="text-text-tertiary">{item.rate}%</span>
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${item.rate}%`, backgroundColor: item.fill }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-medium text-text-secondary mb-4">{t("stats.byCategory")}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0} activeIndex={-1}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center">
              {categoryData.map((c) => (
                <span key={c.name} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: c.fill }} />
                  {c.name} ({c.count})
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-medium text-text-secondary mb-4">{t("stats.timeByCategory")}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} layout="vertical" style={{ cursor: "default" }}>
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-border)" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={yAxisWidth} stroke="var(--color-border)" />
                <Tooltip
                  cursor={false}
                  formatter={(v: number) => formatDuration(v)}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]} activeBar={{ strokeWidth: 0 }} isAnimationActive={false}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} strokeWidth={0} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {stats.totalTasks === 0 && (
        <div className="card text-center py-12">
          <BarChart3 size={32} className="mx-auto mb-3 text-text-tertiary opacity-40" />
          <p className="text-sm text-text-secondary">{t("stats.noData")}</p>
          <p className="text-xs text-text-tertiary mt-1">{t("stats.noDataDesc")}</p>
        </div>
      )}
    </div>
  );
}
