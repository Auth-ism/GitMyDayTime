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
const TOTAL_HOURS = 24;
const MINUTES_IN_DAY = TOTAL_HOURS * 60;
const TOTAL_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;
const LABEL_WIDTH = 40;

// The day is rendered three times back to back. Scroll position is kept inside the
// middle copy, so running off either end silently wraps to the identical neighbour
// and 00:00 flows into itself in both directions.
const CYCLES = 3;
const CONTENT_HEIGHT = TOTAL_HEIGHT * CYCLES;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToPx(minutes: number): number {
  return (minutes / MINUTES_IN_DAY) * TOTAL_HEIGHT;
}

function durationToPx(minutes: number): number {
  return Math.max(24, (minutes / MINUTES_IN_DAY) * TOTAL_HEIGHT);
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

  // Land inside the middle copy so there is a full day of slack above and below.
  useEffect(() => {
    if (!scrollRef.current) return;
    let offset: number;
    if (showNow) {
      offset = minutesToPx(nowMinutes) - 80;
    } else if (scheduledPlans.length > 0) {
      const firstTime = timeToMinutes(scheduledPlans[0].scheduledTime!);
      offset = minutesToPx(firstTime) - 40;
    } else {
      offset = minutesToPx(8 * 60);
    }
    scrollRef.current.scrollTop = TOTAL_HEIGHT + offset;
  }, []);

  // Wrap back into the middle copy whenever scrolling leaves it. The neighbouring
  // copies are pixel-identical, so the jump is invisible.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop >= TOTAL_HEIGHT * 2) el.scrollTop -= TOTAL_HEIGHT;
    else if (el.scrollTop < TOTAL_HEIGHT) el.scrollTop += TOTAL_HEIGHT;
  };

  if (scheduledPlans.length === 0) {
    return (
      <div className="card text-center py-8 text-text-tertiary">
        <Clock size={20} className="mx-auto mb-1.5 opacity-40" />
        <p className="text-xs">Zamanlanmış plan yok</p>
        <p className="text-[10px] mt-0.5 opacity-70">Planlara başlangıç saati ekleyin</p>
      </div>
    );
  }

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => i);
  const cycles = Array.from({ length: CYCLES }, (_, i) => i);

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
        <Clock size={13} className="text-text-tertiary" />
        <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">Zaman Çizelgesi</span>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        <div className="relative" style={{ height: `${CONTENT_HEIGHT}px`, minHeight: `${CONTENT_HEIGHT}px` }}>
          {cycles.map((cycle) => {
            const base = cycle * TOTAL_HEIGHT;
            return (
              <div key={cycle}>
                {/* Hour lines */}
                {hours.map((h) => (
                  <div key={h} className="absolute left-0 right-0 flex items-start" style={{ top: `${base + h * HOUR_HEIGHT}px` }}>
                    <span
                      className={cn(
                        "text-[10px] shrink-0 leading-none pt-px pr-2 text-right",
                        h === 0 ? "text-text-secondary font-medium" : "text-text-tertiary"
                      )}
                      style={{ width: `${LABEL_WIDTH}px` }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </span>
                    <div className={cn("flex-1 h-px mt-[5px]", h === 0 ? "bg-border" : "bg-border/40")} />
                  </div>
                ))}

                {/* Now indicator */}
                {showNow && (
                  <div className="absolute right-0 z-10 pointer-events-none" style={{ top: `${base + minutesToPx(nowMinutes)}px`, left: `${LABEL_WIDTH - 4}px` }}>
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-danger shrink-0" />
                      <div className="flex-1 h-[1.5px] bg-danger" />
                    </div>
                  </div>
                )}

                {/* Plan blocks */}
                {scheduledPlans.map((plan) => {
                  const mins = timeToMinutes(plan.scheduledTime!);
                  const top = base + minutesToPx(mins);
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
