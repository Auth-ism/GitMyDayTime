/** Shared intensity ramp for the activity heatmaps on the Stats page. */
export function heatColor(count: number, max: number): string {
  if (count <= 0) return "var(--color-bg-tertiary)";
  const intensity = Math.min(count / Math.max(max, 1), 1);
  if (intensity < 0.25) return "#c6f0d4";
  if (intensity < 0.5) return "#86efac";
  if (intensity < 0.75) return "#4ade80";
  return "#16a34a";
}
