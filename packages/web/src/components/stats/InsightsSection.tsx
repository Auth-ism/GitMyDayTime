import type { InsightsResponse } from "@gmd/shared";
import { useI18n } from "@/lib/i18n";
import { Lightbulb } from "lucide-react";
import { InsightCard } from "./InsightCard";

interface InsightsSectionProps {
  data: InsightsResponse;
}

export function InsightsSection({ data }: InsightsSectionProps) {
  const { t } = useI18n();
  const { insights, dataQuality } = data;

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb size={15} className="text-text-secondary" />
        <h3 className="text-sm font-medium">{t("insight.title")}</h3>
      </div>
      <p className="text-xs text-text-tertiary mb-3">{t("insight.subtitle")}</p>

      {insights.length === 0 ? (
        <div className="py-4">
          <p className="text-sm text-text-secondary">{t("insight.notReady")}</p>
          <p className="text-xs text-text-tertiary mt-1">
            {t("insight.notReadyDesc", { days: dataQuality.daysCovered })}
          </p>
        </div>
      ) : (
        <ul>
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </ul>
      )}
    </div>
  );
}
