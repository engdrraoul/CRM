/** Format total seconds as mm:ss (e.g. 225 → "03:45"). */
export function formatDurationMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Parse mm:ss (or m:ss) into total seconds.
 * Returns null if the string is not a valid duration.
 * Empty string → 0.
 */
export function parseDurationMmSs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const match = /^(\d{1,4}):([0-5]?\d)$/.exec(trimmed);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/** Weighted average of durations by handled call count. */
export function weightedAvgDuration(
  items: { avgHandlingDuration: number; handled: number }[],
): number {
  let weightedSum = 0;
  let weight = 0;
  for (const item of items) {
    const handled = Number(item.handled) || 0;
    const duration = Number(item.avgHandlingDuration) || 0;
    if (handled > 0) {
      weightedSum += duration * handled;
      weight += handled;
    }
  }
  if (weight > 0) return Math.round(weightedSum / weight);
  // Fallback: simple average of report durations
  if (items.length === 0) return 0;
  const sum = items.reduce((s, i) => s + (Number(i.avgHandlingDuration) || 0), 0);
  return Math.round(sum / items.length);
}
