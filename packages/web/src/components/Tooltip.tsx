import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Gap between the trigger and the bubble, in px. */
const OFFSET = 8;
/** Keeps the bubble off the viewport edges; roughly half a short label. */
const EDGE_MARGIN = 72;
/** Standard tooltip dwell — stops bubbles flashing when sweeping across a row. */
const SHOW_DELAY = 250;

/**
 * Hover/focus label for icon-only controls.
 *
 * The bubble is portalled to <body> on purpose: plan rows sit inside a swipe
 * container with `overflow-x-hidden` (which forces the vertical axis to `auto`,
 * so it clips) and inside framer-motion reorder items that create their own
 * stacking contexts. An absolutely positioned bubble gets cut off or painted
 * under the neighbouring card; a fixed, portalled one never does.
 *
 * The trigger keeps its own aria-label; the bubble is aria-hidden so screen
 * readers announce the control once, not twice.
 */
export default function Tooltip({ label, children, className }: Props) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setPos(null);
  }, []);

  const show = useCallback((immediate = false) => {
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      setPos({
        top: rect.top - OFFSET,
        left: Math.min(Math.max(centre, EDGE_MARGIN), window.innerWidth - EDGE_MARGIN),
      });
    };
    if (immediate) { place(); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(place, SHOW_DELAY);
  }, []);

  // The position is captured once, so any scroll would leave the bubble behind.
  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [pos, hide]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <span
      ref={triggerRef}
      className={cn("relative inline-flex flex-shrink-0", className)}
      // Touch taps also fire pointerenter; showing a bubble there would just sit
      // on top of whatever the tap did.
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {children}
      {pos && createPortal(
        <span
          role="tooltip"
          aria-hidden="true"
          style={{ top: pos.top, left: pos.left }}
          className={cn(
            "fixed z-[70] -translate-x-1/2 -translate-y-full pointer-events-none",
            "whitespace-nowrap rounded-md border border-border bg-bg-elevated px-2 py-1",
            "text-[11px] font-medium leading-none text-text-secondary shadow-lg"
          )}
        >
          {label}
        </span>,
        document.body
      )}
    </span>
  );
}
