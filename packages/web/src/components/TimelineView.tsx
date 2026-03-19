import { useMemo } from "react";
import type { PlanItem } from "@gmd/shared";
import { CATEGORY_COLORS } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { Clock } from "lucide-react";

interface Props {
  plans: PlanItem[];
  onItemClick?: (id: string) => void;
}

const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToPercent(minutes: number): number {
  const relative = minutes - START_HOUR * 60;
  return Math.max(0, Math.min(100, (relative / TOTAL_MINUTES) * 100));
}

export default function TimelineView({ plans, onItemClick }: Props) {
  const scheduledPlans = useMemo(
    () => plans.filter((p) => p.scheduledTime && p.itemType !== "reminder"),
    [plans]
  );

  const unscheduled = useMemo(
    () => plans.filter((p) => !p.scheduledTime && p.itemType !== "reminder"),
    [plans]
  );

  if (scheduledPlans.length === 0) {
    return (
      <div className="card text-center py-10 text-text-tertiary">
        <Clock size={24} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">Zamanlanmis plan yok</p>
        <p className="text-xs mt-0.5">Planlara baslangic saati ekleyin</p>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <Clock size={14} className="text-text-tertiary" />
        <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Zaman Cizelgesi</span>
      </div>

      {/* Timeline grid */}
      <div className="relative" style={{ height: `${HOURS.length * 52}px` }}>
        {/* Hour lines */}
        {HOURS.map((h) => {
          const top = minutesToPercent((h - START_HOUR) * 60);
          return (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ top: `${top}%` }}
            >
              <span className="text-[10px] text-text-tertiary w-10 text-right shrink-0 leading-none">
                {String(h).padStart(2, "0")}:00
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
          );
        })}

        {/* Plan blocks */}
        {scheduledPlans.map((plan) => {
          const mins = timeToMinutes(plan.scheduledTime!);
          const top = minutesToPercent(mins);
          const durationMins = plan.duration ?? 30;
          const height = Math.max(28, (durationMins / TOTAL_MINUTES) * 100);
          const color = CATEGORY_COLORS[plan.category] || "#6b7280";

          return (
            <button
              key={plan.id}
              onClick={() => onItemClick?.(plan.id)}
              className={cn(
                "absolute left-14 right-0 rounded-lg px-2 py-1 text-left transition-opacity hover:opacity-80 text-xs",
                plan.completed && "opacity-60"
              )}
              style={{
                top: `${top}%`,
                minHeight: "28px",
                height: `${height}%`,
                backgroundColor: `${color}22`,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <p className="font-medium truncate leading-tight" style={{ color }}>
                {plan.description}
              </p>
              {plan.duration && (
                <p className="text-[10px] opacity-70" style={{ color }}>
                  {plan.scheduledTime} · {plan.duration}dk
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-text-tertiary mb-2">Zamanlanmamis ({unscheduled.length})</p>
          <div className="space-y-1">
            {unscheduled.map((plan) => (
              <button
                key={plan.id}
                onClick={() => onItemClick?.(plan.id)}
                className={cn(
                  "w-full text-left text-xs px-2 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary transition-colors truncate",
                  plan.completed && "opacity-60 line-through text-text-tertiary"
                )}
              >
                {plan.description}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
