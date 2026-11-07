// Expedient numbers are "YY-N": the year's last two digits, then a counter that
// keeps growing across years and never restarts (2014 was around 585, 2019
// around 1018). New ones get four digits; older ones have three.

// "19-1042", "19/1042", "19 1042" or "19.1042" → its parts; null if it isn't one.
// The counter keeps the digits as written, so "14-585" stays "14-585".
export function parseNumExpedient(raw: string): { yy: string; n: number; num: string } | null {
  const m = /^\s*(\d{2})\s*[-/.\s]\s*(\d{1,4})\s*$/.exec(raw);
  return m ? { yy: m[1], n: parseInt(m[2], 10), num: `${m[1]}-${m[2]}` } : null;
}

// The counter a new expedient gets: one more than the highest ever used.
export function nextCounter(nums: (string | null | undefined)[]): number {
  let max = 0;
  for (const num of nums) {
    const m = /-(\d+)$/.exec(num ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

export const yearPrefix = (year: number) => String(year).slice(-2);

export const formatNumExpedient = (yy: string, n: number) => `${yy}-${String(n).padStart(4, "0")}`;
