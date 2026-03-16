import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CATEGORY_COLORS, formatDuration, type Category } from "@gmd/shared";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { motion } from "framer-motion";
import { Flame, Clock, CheckCircle, TrendingUp, BarChart3 } from "lucide-react";

export default function StatsPage() {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", "30d"],
    queryFn: () => api.getStats(),
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
      fill: CATEGORY_COLORS[key as Category],
    }));

  const activityData = stats.dailyActivity.map((d) => ({
    date: d.date.slice(5),
    tasks: d.tasks,
    minutes: d.minutes,
  }));

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

      {/* Category breakdown */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h3 className="text-sm font-medium text-text-secondary mb-4">{t("stats.byCategory")}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} strokeWidth={0}>
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
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-border)" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} stroke="var(--color-border)" />
                <Tooltip
                  formatter={(v: number) => formatDuration(v)}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="minutes" radius={[0, 6, 6, 0]}>
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
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
