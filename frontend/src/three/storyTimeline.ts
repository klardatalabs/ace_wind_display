export const STORY_DURATIONS = [11, 12, 7, 10, 10, 14] as const;
export const STORY_SECONDS = STORY_DURATIONS.reduce((sum, seconds) => sum + seconds, 0);

export function chapterStart(index: number): number {
  return STORY_DURATIONS.slice(0, Math.max(0, Math.min(index, STORY_DURATIONS.length - 1))).reduce((sum, seconds) => sum + seconds, 0);
}

export function chapterAt(seconds: number): { index: number; progress: number } {
  const time = Math.max(0, Math.min(seconds, STORY_SECONDS - 0.0001));
  let start = 0;
  for (let index = 0; index < STORY_DURATIONS.length; index++) {
    const duration = STORY_DURATIONS[index];
    if (time < start + duration) return { index, progress: (time - start) / duration };
    start += duration;
  }
  return { index: 0, progress: 0 };
}

/** Monotonic time-to-distance mapping: camera speed changes without stopping at beats. */
export function railProgress(seconds: number, distances: readonly number[], times: readonly number[] = [0, 11, 23, 30, 40, 50, 64]): number {
  const time = Math.max(times[0], Math.min(seconds, times[times.length - 1]));
  let index = 0;
  while (index < times.length - 2 && time >= times[index + 1]) index++;
  const duration = times[index + 1] - times[index];
  const progress = (time - times[index]) / duration;
  const speed = (i: number) => (distances[i + 1] - distances[i]) / (times[i + 1] - times[i]);
  const tangent = (i: number) => {
    if (i === 0) return speed(0);
    if (i === times.length - 1) return speed(i - 1);
    const before = speed(i - 1), after = speed(i);
    return before > 0 && after > 0 ? 2 * before * after / (before + after) : 0;
  };
  const t = progress;
  return (2 * t ** 3 - 3 * t ** 2 + 1) * distances[index]
    + (t ** 3 - 2 * t ** 2 + t) * duration * tangent(index)
    + (-2 * t ** 3 + 3 * t ** 2) * distances[index + 1]
    + (t ** 3 - t ** 2) * duration * tangent(index + 1);
}
