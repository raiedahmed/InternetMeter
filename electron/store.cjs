const fs = require('fs');
const path = require('path');

const DEFAULTS = () => ({
  version: 2,
  settings: {
    quotaGB: 200, cycleDay: 1, alerts: [50, 80, 95], autoStart: false, configured: false,
    showWidget: false, leakAlert: true, cost: 0, currency: 'ج.م',
    nightEnabled: false, nightStart: 2, nightEnd: 8, nightDeduct: false, ecoMode: false,
  },
  // daily[YYYY-MM-DD] = { d, u, h: [24 رقماً], apps: { key: { n, p, fd, d, u, ips: { ip: [d, u] } } } }
  daily: {},
  names: {}, // ip -> hostname
  counters: { boot: 0, adapters: {} },
  alerted: { cycle: '', levels: [] },
});

const MAX_IPS_PER_APP = 80;
const DETAIL_DAYS = 45; // تفاصيل الوجهات تُحتفظ بها لهذه المدة، والإجماليات للأبد
const MAX_NAMES = 6000;

class Store {
  constructor(dir) {
    this.file = path.join(dir, 'data.json');
    this.state = DEFAULTS();
    this.dirty = false;
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const d = DEFAULTS();
      this.state = { ...d, ...raw, version: 2, settings: { ...d.settings, ...raw.settings } };
    } catch { /* أول تشغيل أو ملف تالف */ }
  }

  /** إجمالي الكروت (المصدر الدقيق للأرقام) + توزيع الساعات */
  add(key, down, up, hour) {
    if (!down && !up) return;
    const rec = (this.state.daily[key] ||= { d: 0, u: 0 });
    rec.d += down;
    rec.u += up;
    const h = (rec.h ||= new Array(24).fill(0));
    h[hour] += down + up;
    this.dirty = true;
  }

  /** تفاصيل لكل تطبيق ولكل وجهة (من ETW) */
  addApps(key, rows) {
    const day = (this.state.daily[key] ||= { d: 0, u: 0 });
    const apps = (day.apps ||= {});
    for (const r of rows) {
      const a = (apps[r.k] ||= { n: r.n, p: r.p || '', fd: r.fd || r.n, d: 0, u: 0, ips: {} });
      a.d += r.d; a.u += r.u;
      const ip = (a.ips[r.ip] ||= [0, 0]);
      ip[0] += r.d; ip[1] += r.u;
    }
    this.dirty = true;
  }

  setName(ip, name) {
    const n = this.state.names;
    if (n[ip] === name) return;
    n[ip] = name;
    this.dirty = true;
    const keys = Object.keys(n);
    if (keys.length > MAX_NAMES) for (const k of keys.slice(0, keys.length - MAX_NAMES)) delete n[k];
  }

  /** تقليم البيانات التفصيلية كي لا يكبر الملف */
  prune() {
    const keys = Object.keys(this.state.daily).sort();
    const cutoff = keys[Math.max(0, keys.length - DETAIL_DAYS)];
    for (const k of keys) {
      const day = this.state.daily[k];
      if (!day.apps) continue;
      for (const a of Object.values(day.apps)) {
        if (k < cutoff) { delete a.ips; continue; }
        const ents = Object.entries(a.ips || {});
        if (ents.length > MAX_IPS_PER_APP + 20) {
          ents.sort((x, y) => y[1][0] + y[1][1] - (x[1][0] + x[1][1]));
          const keep = ents.slice(0, MAX_IPS_PER_APP);
          const rest = ents.slice(MAX_IPS_PER_APP).reduce((s, [, v]) => [s[0] + v[0], s[1] + v[1]], [0, 0]);
          a.ips = Object.fromEntries(keep);
          a.ips['*'] = [(a.ips['*']?.[0] || 0) + rest[0], (a.ips['*']?.[1] || 0) + rest[1]];
        }
      }
    }
    this.dirty = true;
  }

  save() {
    if (!this.dirty) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.state));
      fs.renameSync(tmp, this.file); // كتابة آمنة لتجنب تلف الملف
      this.dirty = false;
    } catch (e) { console.error('save failed', e); }
  }

  touch() { this.dirty = true; }
}

module.exports = { Store };
