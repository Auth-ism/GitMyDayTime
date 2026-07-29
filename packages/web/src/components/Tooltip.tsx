import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  children: ReactNode;
  /** Nudge the bubble when the trigger sits at the edge of its row. */
  align?: "center" | "right";
  className?: string;
}

/**
 * Hover/focus label for icon-only controls. CSS-only — no portal, no positioning
 * library — so it costs nothing on rows that render dozens of these.
 *
 * The trigger keeps its own aria-label; the bubble is aria-hidden so screen
 * readers announce the control once, not twice.
 */
export default function Tooltip({ label, children, align = "center", className }: Props) {
  return (
    <span className={cn("relative inline-flex flex-shrink-0 group/tip", className)}>
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute bottom-full z-30 mb-1.5 whitespace-nowrap",
          "rounded-md border border-border bg-bg-elevated px-2 py-1",
          "text-[11px] font-medium leading-none text-text-secondary shadow-lg",
          "opacity-0 translate-y-1 transition-[opacity,translate] duration-150 ease-out",
          "group-hover/tip:opacity-100 group-hover/tip:translate-y-0",
          "group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0",
          "motion-reduce:transition-none motion-reduce:translate-y-0",
          align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
        )}
      >
        {label}
      </span>
    </span>
  );
}
