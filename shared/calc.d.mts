export const GB: number;
export const DAY: number;
export interface Settings {
  quotaGB: number;
  cycleDay: number;
  offset?: { cycle: string; bytes: number };
  alerts: number[];
  autoStart: boolean;
  configured: boolean;
}
export type Daily = Record<string, { d: number; u: number }>;
export interface Stats {
  quota: number; used: number; tracked: number; offset: number; remaining: number; pct: number;
  cycleLen: number; daysLeft: number; avgDaily: number; projected: number; dailySafe: number;
  runOutDate: Date | null; status: 'ok' | 'warn' | 'danger' | 'over';
  startKey: string; nextKey: string;
  series: { key: string; d: number; u: number; total: number }[];
  todayUsed: number; todayDown: number; todayUp: number;
}
export function dateKey(d?: Date): string;
export function cycleBounds(cycleDay: number, now?: Date): { start: Date; next: Date };
export function computeStats(settings: Settings, daily: Daily, now?: Date): Stats;
