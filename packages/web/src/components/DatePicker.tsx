import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";

interface Props {
  value: string;
  onChange: (val: string | null) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
}

// Jan 1 2024 was a Monday — use it to generate Mon-first day headers
function getMonthNames(locale: string): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2024, i, 1))
  );
}

function getDayNames(locale: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2024, 0, 1 + i))
  );
}

function toDisplay(dateStr: string, locale: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(d);
}

function buildCells(year: number, month: number): (number | null)[] {
  const rawDay = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = rawDay === 0 ? 6 : rawDay - 1;     // Mon-first
  const last   = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= last; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DatePicker({ value, onChange, placeholder, className, clearable = false }: Props) {
  const { t, locale } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("datepicker.placeholder" as any);
  const MONTHS = getMonthNames(locale);
  const DAYS   = getDayNames(locale);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    value ? parseInt(value.slice(0, 4)) : new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(() =>
    value ? parseInt(value.slice(5, 7)) - 1 : new Date().getMonth()
  );
  const ref = useRef<HTMLDivElement>(null);

  // sync view when value changes externally while closed
  useEffect(() => {
    if (!open && value) {
      setViewYear(parseInt(value.slice(0, 4)));
      setViewMonth(parseInt(value.slice(5, 7)) - 1);
    }
  }, [value, open]);

  // outside click + ESC
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }
  function selectDay(day: number) {
    const s = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(s);
    setOpen(false);
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const cells = buildCells(viewYear, viewMonth);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="input w-full flex items-center gap-2 text-left min-h-[2.5rem]"
      >
        <CalendarDays size={14} className="text-text-tertiary flex-shrink-0" />
        <span className={cn("flex-1 text-sm", value ? "text-text" : "text-text-tertiary")}>
          {value ? toDisplay(value, locale) : resolvedPlaceholder}
        </span>
        {clearable && value && (
          <span
            role="button"
            className="text-text-tertiary hover:text-danger transition-colors p-0.5 rounded"
            onClick={e => { e.stopPropagation(); onChange(null); }}
          >
            <X size={13} />
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden"
          style={{ width: 280 }}>

          {/* Month nav */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <button type="button" onClick={prevMonth}
              className="btn-icon p-1.5 rounded-lg text-text-tertiary hover:text-text">
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-text select-none">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="btn-icon p-1.5 rounded-lg text-text-tertiary hover:text-text">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="px-2 pt-2 pb-3">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-medium text-text-tertiary py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const mm  = String(viewMonth + 1).padStart(2, "0");
                const dd  = String(day).padStart(2, "0");
                const str = `${viewYear}-${mm}-${dd}`;
                const sel = str === value;
                const now = str === todayStr;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "flex items-center justify-center rounded-lg text-xs font-medium transition-colors min-h-[36px]",
                      sel
                        ? "bg-accent text-white"
                        : now
                        ? "ring-1 ring-accent text-accent hover:bg-accent/10"
                        : "text-text hover:bg-accent/10"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
