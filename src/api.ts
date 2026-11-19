import { dateKey, type Daily, type Settings } from '../shared/calc.mjs';

export interface AppState { settings: Settings; daily: Daily; todayKey: string }
export interface Tick { downBps: number; upBps: number; todayKey: string; today: { d: number; u: number } }
export interface Api {
  getState(): Promise<AppState>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  onTick(cb: (t: Tick) => void): () => void;
}

declare global { interface Window { api?: Api } }

// نسخة تجريبية تعمل داخل المتصفح (للتطوير والمعاينة) عند غياب Electron
function mockApi(): Api {
  const GBn = 1024 ** 3;
  const daily: Daily = {};
  const now = new Date();
  for (let i = 0; i < 40; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const total = (2 + Math.random() * 7) * GBn;
    daily[dateKey(d)] = { d: total * 0.88, u: total * 0.12 };
  }
  let settings: Settings = { quotaGB: 200, cycleDay: 1, alerts: [50, 80, 95], autoStart: false, configured: true };
  return {
    getState: async () => ({ settings, daily, todayKey: dateKey() }),
    saveSettings: async (p) => (settings = { ...settings, ...p, configured: true }),
    onTick: (cb) => {
      const id = setInterval(() => {
        const down = Math.random() * 6 * 1024 ** 2, up = Math.random() * 0.4 * 1024 ** 2;
        const k = dateKey();
        daily[k] = { d: (daily[k]?.d ?? 0) + down, u: (daily[k]?.u ?? 0) + up };
        cb({ downBps: down, upBps: up, todayKey: k, today: daily[k] });
      }, 1000);
      return () => clearInterval(id);
    },
  };
}

export const api: Api = window.api ?? mockApi();
