import { dateKey, type Daily, type Settings } from '../shared/calc.mjs';

export interface AppState { settings: Settings; daily: Daily; todayKey: string }
export interface Tick { downBps: number; upBps: number; todayKey: string; today: { d: number; u: number } }

export interface HostRow { host: string; lan: boolean; d: number; u: number }
export interface AppRow { key: string; name: string; exe: string; path: string; d: number; u: number; hosts: HostRow[] }
export interface Detail {
  total: { d: number; u: number };
  attributed: number;
  lan: number;
  days: { key: string; d: number; u: number }[];
  hours: number[];
  apps: AppRow[];
  hosts: (HostRow & { apps: string[] })[];
}
export interface TrackerStatus {
  status: 'starting' | 'running' | 'noadmin' | 'missing' | 'error';
  detail?: string;
  admin?: boolean;
}

export interface NetDevice { ip: string; mac: string; type: 'router' | 'device'; alloc?: string }
export interface NetScanResult { devices: NetDevice[]; gateway: string | null; count: number }

export interface Api {
  getState(): Promise<AppState>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  getDetail(from: string, to: string): Promise<Detail>;
  getTrackerStatus(): Promise<TrackerStatus>;
  relaunchAsAdmin(): Promise<void>;
  getIcon(path: string): Promise<string>;
  scanNetwork(): Promise<NetScanResult>;
  toggleWidget(show?: boolean): Promise<void>;
  focusWindow(): Promise<void>;
  onTick(cb: (t: Tick) => void): () => void;
  onTracker(cb: (s: TrackerStatus) => void): () => void;
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

  const mk = (name: string, exe: string, gb: number, hosts: [string, number][]) => ({
    key: exe, name, exe, path: '', d: gb * GBn * 0.9, u: gb * GBn * 0.1,
    hosts: hosts.map(([host, share]) => ({ host, lan: false, d: gb * GBn * 0.9 * share, u: gb * GBn * 0.1 * share })),
  });
  const apps = [
    mk('Google Chrome', 'chrome.exe', 38, [['googlevideo.com', 0.62], ['youtube.com', 0.12], ['google.com', 0.1], ['fbcdn.net', 0.09], ['cloudflare.com', 0.07]]),
    mk('Steam', 'steam.exe', 21, [['steamcontent.com', 0.9], ['steampowered.com', 0.1]]),
    mk('Windows Update', 'svchost.exe:wuauserv', 9.4, [['windowsupdate.com', 0.7], ['microsoft.com', 0.3]]),
    mk('Microsoft Teams', 'ms-teams.exe', 5.2, [['teams.microsoft.com', 0.8], ['skype.com', 0.2]]),
    mk('Spotify', 'spotify.exe', 2.1, [['scdn.co', 0.85], ['spotify.com', 0.15]]),
    mk('Telegram', 'telegram.exe', 1.3, [['telegram.org', 1]]),
    mk('Claude', 'claude.exe', 0.4, [['anthropic.com', 1]]),
  ];
  const hours = Array.from({ length: 24 }, (_, h) => (h >= 18 && h <= 23 ? 3 + Math.random() * 3 : 0.3 + Math.random() * 1.5) * GBn * 0.4);
  const detail = (): Detail => {
    const hostMap = new Map<string, { host: string; lan: boolean; d: number; u: number; apps: string[] }>();
    for (const a of apps) for (const h of a.hosts) {
      const e = hostMap.get(h.host) ?? { ...h, d: 0, u: 0, apps: [] };
      e.d += h.d; e.u += h.u; e.apps.push(a.name);
      hostMap.set(h.host, e);
    }
    const tot = apps.reduce((s, a) => s + a.d + a.u, 0);
    return {
      total: { d: tot * 1.04, u: 0 }, attributed: tot, lan: 0.6 * GBn, hours,
      days: Object.entries(daily).map(([key, v]) => ({ key, ...v })).sort((a, b) => (a.key < b.key ? -1 : 1)),
      apps, hosts: [...hostMap.values()].sort((a, b) => b.d + b.u - (a.d + a.u)),
    };
  };

  return {
    getState: async () => ({ settings, daily, todayKey: dateKey() }),
    saveSettings: async (p) => (settings = { ...settings, ...p, configured: true }),
    getDetail: async () => detail(),
    getTrackerStatus: async () => ({ status: 'running', admin: true }),
    relaunchAsAdmin: async () => {},
    getIcon: async () => '',
    scanNetwork: async () => ({
      devices: [
        { ip: '192.168.1.1', mac: '00:11:22:33:44:55', type: 'router' },
        { ip: '192.168.1.5', mac: '44:66:88:aa:cc:ee', type: 'device' },
        { ip: '192.168.1.9', mac: 'aa:bb:cc:dd:ee:ff', type: 'device' },
      ],
      gateway: '192.168.1.1',
      count: 3,
    }),
    toggleWidget: async () => {},
    focusWindow: async () => {},
    onTick: (cb) => {
      const id = setInterval(() => {
        const down = Math.random() * 6 * 1024 ** 2, up = Math.random() * 0.4 * 1024 ** 2;
        const k = dateKey();
        daily[k] = { d: (daily[k]?.d ?? 0) + down, u: (daily[k]?.u ?? 0) + up };
        cb({ downBps: down, upBps: up, todayKey: k, today: daily[k] });
      }, 1000);
      return () => clearInterval(id);
    },
    onTracker: () => () => {},
  };
}

export const api: Api = window.api ?? mockApi();
