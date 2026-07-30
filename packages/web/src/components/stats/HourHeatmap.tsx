import type { HourBucket } from "@gmd/shared";
import { useI18n } from "@/lib/i18n";
import { heatColor } from "@/lib/heat";
import { Clock } from "lucide-react";

interface HourHeatmapProps {
  byHour: HourBucket[];
}

/** Completions per hour of day, in the user's own timezone. */
export function HourHeatmap({ byHour }: HourHeatmapProps) {
  const { t } = useI18n();
  const max = Math.max(...byHour.map((h) => h.completed), 0);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={15} className="text-text-secondary" />
        <h3 className="text-sm font-medium text-text-secondary">{t("stats.hourHeatmap")}</h3>
      </div>

      {max === 0 ? (
        <p className="text-xs text-text-tertiary py-4 text-center">{t("stats.noHourData")}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="flex gap-0.5 min-w-max">
              {byHour.map((h) => (
                <div
                  key={h.hour}
                  title={`${String(h.hour).padStart(2, "0")}:00 — ${h.completed}`}
                  className="w-3.5 h-8 rounded-sm"
                  style={{ backgroundColor: heatColor(h.completed, max) }}
                />
              ))}
            </div>
            <div className="flex gap-0.5 min-w-max mt-1">
              {byHour.map((h) => (
                <span
                  key={h.hour}
                  className="w-3.5 text-[9px] text-text-tertiary text-center leading-none"
                >
                  {h.hour % 6 === 0 ? h.hour : ""}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className="text-xs text-text-tertiary">{t("stats.less")}</span>
            {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: heatColor(Math.ceil(v * max), max) }}
              />
            ))}
            <span className="text-xs text-text-tertiary">{t("stats.more")}</span>
          </div>
        </>
      )}
    </div>
  );
}
