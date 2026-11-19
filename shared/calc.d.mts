export const GB: number;
export const DAY: number;
export interface Settings {
  quotaGB: number;
  cycleDay: number;
  offset?: { cycle: string; bytes: number };
  alerts: number[];
  autoStart: boolean;
  configured: boolean;
  lang?: 'ar' | 'en';
  showWidget?: boolean;
  leakAlert?: boolean;
  cost?: number;
  currency?: string;
  nightEnabled?: boolean;
  nightStart?: number;
  nightEnd?: number;
  nightDeduct?: boolean;
  ecoMode?: boolean;
}
export type Daily = Record<string, { d: number; u: number; h?: number[] }>;
export interface Stats {
  quota: number; used: number; tracked: number; rawTracked?: number; offset: number; remaining: number; pct: number;
  cycleLen: number; daysLeft: number; avgDaily: number; projected: number; dailySafe: number;
  runOutDate: Date | null; status: 'ok' | 'warn' | 'danger' | 'over';
  startKey: string; nextKey: string;
  series: { key: string; d: number; u: number; total: number; night?: number }[];
  todayUsed: number; todayDown: number; todayUp: number;
  nightUsed: number;
  costPerGB: number;
  todayCost: number;
  usedCost: number;
  projectedCost: number;
  currency: string;
}
export function isNightHour(hour: number, start: number, end: number): boolean;
export function dateKey(d?: Date): string;
export function cycleBounds(cycleDay: number, now?: Date): { start: Date; next: Date };
export function computeStats(settings: Settings, daily: Daily, now?: Date): Stats;
