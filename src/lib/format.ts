/**
 * Format seconds into mm:ss string.
 * E.g., 195 -> "3:15", 63 -> "1:03", 59 -> "0:59"
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
