import { useMemo, useRef, useEffect, useState } from "react";
import type { PlanItem } from "@gmd/shared";
import { CATEGORY_COLORS } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { Clock, Check } from "lucide-react";

interface Props {
  plans: PlanItem[];
  date?: string;
  onItemClick?: (id: string) => void;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const LABEL_WIDTH = 40;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToPx(minutes: number): number {
  const relative = minutes - START_HOUR * 60;
  return Math.max(0, Math.min(TOTAL_HEIGHT, (relative / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT));
}

function durationToPx(minutes: number): number {
  return Math.max(24, (minutes / (TOTAL_HOURS * 60)) * TOTAL_HEIGHT);
}

function isToday(dateStr?: string): boolean {
  if (!dateStr) return false;
  const today = new Date();
  const d = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return d === dateStr;
}

export default function TimelineView({ plans, date, onItemClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  const showNow = isToday(date);

  // Update now indicator every minute
  useEffect(() => {
    if (!showNow) return;
    const interval = setInterval(() => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    }, 60_000);
    return () => clearInterval(interval);
  }, [showNow]);

  const scheduledPlans = useMemo(
    () => plans.filter((p) => p.scheduledTime && p.itemType !== "reminder"),
    [plans]
  );

  const unscheduled = useMemo(
    () => plans.filter((p) => !p.scheduledTime && p.itemType !== "reminder"),
    [plans]
  );

  // Auto-scroll to first item or current time
  useEffect(() => {
    if (!scrollRef.current) return;
    let scrollTarget: number;
    if (showNow) {
      scrollTarget = minutesToPx(nowMinutes) - 80;
    } else if (scheduledPlans.length > 0) {
      const firstTime = timeToMinutes(scheduledPlans[0].scheduledTime!);
      scrollTarget = minutesToPx(firstTime) - 40;
    } else {
      scrollTarget = minutesToPx(8 * 60);
    }
    scrollRef.current.scrollTop = Math.max(0, scrollTarget);
  }, []);

  if (scheduledPlans.length === 0) {
    return (
      <div className="card text-center py-8 text-text-tertiary">
        <Clock size={20} className="mx-auto mb-1.5 opacity-40" />
        <p className="text-xs">Zamanlanmış plan yok</p>
        <p className="text-[10px] mt-0.5 opacity-70">Planlara başlangıç saati ekleyin</p>
      </div>
    );
  }

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Clock size={13} className="text-text-tertiary" />
        <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Zaman Çizelgesi</span>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        <div className="relative" style={{ height: `${TOTAL_HEIGHT}px`, minHeight: `${TOTAL_HEIGHT}px` }}>
          {/* Hour lines */}
          {hours.map((h) => {
            const top = (h - START_HOUR) * HOUR_HEIGHT;
            return (
              <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: `${top}px` }}>
                <span className="text-[10px] text-text-tertiary shrink-0 leading-none pt-px pr-2 text-right" style={{ width: `${LABEL_WIDTH}px` }}>
                  {String(h).padStart(2, "0")}:00
                </span>
                <div className="flex-1 h-px bg-border/40 mt-[5px]" />
              </div>
            );
          })}

          {/* Now indicator */}
          {showNow && nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60 && (
            <div className="absolute right-0 z-10 pointer-events-none" style={{ top: `${minutesToPx(nowMinutes)}px`, left: `${LABEL_WIDTH - 4}px` }}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-danger shrink-0" />
                <div className="flex-1 h-[1.5px] bg-danger" />
              </div>
            </div>
          )}

          {/* Plan blocks */}
          {scheduledPlans.map((plan) => {
            const mins = timeToMinutes(plan.scheduledTime!);
            const top = minutesToPx(mins);
            const height = durationToPx(plan.duration ?? 30);
            const color = CATEGORY_COLORS[plan.category] || "#6b7280";

            return (
              <button
                key={plan.id}
                onClick={() => onItemClick?.(plan.id)}
                className={cn(
                  "absolute right-2 rounded-lg px-2.5 py-1.5 text-left transition-all hover:brightness-110 text-xs overflow-hidden",
                  plan.completed && "opacity-50"
                )}
                style={{
                  top: `${top}px`,
                  left: `${LABEL_WIDTH + 8}px`,
                  height: `${Math.max(height, 24)}px`,
                  backgroundColor: `${color}18`,
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  {plan.completed && <Check size={10} style={{ color }} className="shrink-0" />}
                  <p className="font-medium truncate leading-tight" style={{ color }}>
                    {plan.description}
                  </p>
                </div>
                {height >= 36 && (
                  <p className="text-[10px] mt-0.5 truncate" style={{ color, opacity: 0.7 }}>
                    {plan.scheduledTime}{plan.duration ? ` · ${plan.duration}dk` : ""}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Unscheduled */}
      {unscheduled.length > 0 && (
        <div className="px-3 py-2 border-t border-border/50">
          <p className="text-[10px] text-text-tertiary mb-1.5">Zamanlanmamış ({unscheduled.length})</p>
          <div className="space-y-0.5">
            {unscheduled.map((plan) => (
              <button
                key={plan.id}
                onClick={() => onItemClick?.(plan.id)}
                className={cn(
                  "w-full text-left text-[11px] px-2 py-1 rounded-md bg-bg-secondary hover:bg-bg-tertiary transition-colors truncate",
                  plan.completed && "opacity-50 line-through text-text-tertiary"
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
