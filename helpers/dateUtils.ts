/**
 * Lightweight date utilities – no external dependencies needed.
 */

/** Returns a new Date that is `days` days after `date` */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Formats a Date to a string.
 * Supported tokens: dd, MM, yyyy, HH, mm
 * Example: format(new Date(), 'dd.MM.yyyy') → '20.04.2026'
 */
export function format(date: Date, pattern: string): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return pattern
    .replace('dd',   pad(date.getDate()))
    .replace('MM',   pad(date.getMonth() + 1))
    .replace('yyyy', String(date.getFullYear()))
    .replace('HH',   pad(date.getHours()))
    .replace('mm',   pad(date.getMinutes()));
}
