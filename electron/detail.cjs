const { execFile } = require('child_process');
const dns = require('dns').promises;

const SLD = new Set(['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'or', 'ne']);

/** عنوان محلي/داخلي (LAN) وليس إنترنت */
function isLan(ip) {
  if (!ip || ip === '*') return false;
  if (ip.includes(':')) {
    const l = ip.toLowerCase();
    return l.startsWith('fe80') || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('ff');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224;
}

/** googlevideo.com من r3---sn-x.googlevideo.com */
function groupOf(name) {
  const p = name.toLowerCase().split('.');
  if (p.length <= 2) return name.toLowerCase();
  const n = SLD.has(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
  return p.slice(-n).join('.');
}

class Names {
  constructor(store) {
    this.store = store;
    this.dnsMap = new Map(); // ip -> اسم من كاش DNS في ويندوز (الأدق)
    this.tried = new Set();
    this.queue = [];
    this.active = 0;
  }

  start() {
    this.refreshDns();
    this.timer = setInterval(() => this.refreshDns(), 20000);
  }

  stop() { clearInterval(this.timer); }

  refreshDns() {
    const cmd = "Get-DnsClientCache | Where-Object { $_.Type -in 1,28 } | Select-Object Entry,Data | ConvertTo-Json -Compress";
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd],
      { windowsHide: true, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8' }, (err, out) => {
        if (err || !out.trim()) return;
        try {
          let arr = JSON.parse(out);
          if (!Array.isArray(arr)) arr = [arr];
          for (const e of arr) if (e.Data && e.Entry) { this.dnsMap.set(String(e.Data), String(e.Entry)); this.store.setName(String(e.Data), String(e.Entry)); }
        } catch { /* ignore */ }
      });
  }

  /** نداء عند رؤية عنوان؛ يجدول بحثاً عكسياً إن لم يُعرف اسمه */
  observe(ip) {
    if (!ip || ip === '*' || isLan(ip) || this.tried.has(ip) || this.store.state.names[ip]) return;
    this.tried.add(ip);
    this.queue.push(ip);
    this.pump();
  }

  pump() {
    while (this.active < 4 && this.queue.length) {
      const ip = this.queue.shift();
      this.active++;
      Promise.race([dns.reverse(ip), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500))])
        .then((h) => { if (h && h[0] && !this.store.state.names[ip]) this.store.setName(ip, h[0]); })
        .catch(() => { /* لا اسم */ })
        .finally(() => { this.active--; this.pump(); });
    }
  }

  nameOf(ip) { return this.dnsMap.get(ip) || this.store.state.names[ip] || null; }
}

function eachDay(daily, from, to, fn) {
  for (const k of Object.keys(daily)) if (k >= from && k <= to) fn(k, daily[k]);
}

/** تجميع التفاصيل لفترة [from, to] (مفاتيح YYYY-MM-DD) */
function compute(store, names, from, to) {
  const hours = new Array(24).fill(0);
  const days = [];
  const apps = new Map();
  const hosts = new Map();
  let d = 0, u = 0, lanBytes = 0, attributed = 0;

  eachDay(store.state.daily, from, to, (key, day) => {
    d += day.d; u += day.u;
    days.push({ key, d: day.d, u: day.u });
    (day.h || []).forEach((v, i) => { hours[i] += v; });
    for (const [k, a] of Object.entries(day.apps || {})) {
      const cur = apps.get(k) || { key: k, n: a.n, p: a.p, fd: a.fd, d: 0, u: 0, ips: new Map() };
      cur.d += a.d; cur.u += a.u;
      if (a.p && !cur.p) cur.p = a.p;
      attributed += a.d + a.u;
      for (const [ip, v] of Object.entries(a.ips || {})) {
        const e = cur.ips.get(ip) || [0, 0];
        e[0] += v[0]; e[1] += v[1];
        cur.ips.set(ip, e);
        if (isLan(ip)) lanBytes += v[0] + v[1];
      }
      apps.set(k, cur);
    }
  });

  const hostKey = (ip) => {
    if (ip === '*') return { host: '*', lan: false };
    const lan = isLan(ip);
    if (lan) return { host: ip, lan: true };
    const n = names.nameOf(ip);
    return { host: n ? groupOf(n) : ip, lan: false };
  };

  const appList = [];
  for (const a of apps.values()) {
    const hm = new Map();
    for (const [ip, v] of a.ips) {
      const { host, lan } = hostKey(ip);
      const e = hm.get(host) || { host, lan, d: 0, u: 0 };
      e.d += v[0]; e.u += v[1];
      hm.set(host, e);

      const g = hosts.get(host) || { host, lan, d: 0, u: 0, apps: new Map() };
      g.d += v[0]; g.u += v[1];
      g.apps.set(a.fd || a.n, (g.apps.get(a.fd || a.n) || 0) + v[0] + v[1]);
      hosts.set(host, g);
    }
    appList.push({
      key: a.key, name: a.fd || a.n, exe: a.n, path: a.p, d: a.d, u: a.u,
      hosts: [...hm.values()].sort((x, y) => y.d + y.u - (x.d + x.u)).slice(0, 25),
    });
  }
  appList.sort((x, y) => y.d + y.u - (x.d + x.u));

  const hostList = [...hosts.values()]
    .map((h) => ({
      host: h.host, lan: h.lan, d: h.d, u: h.u,
      apps: [...h.apps.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n]) => n),
    }))
    .sort((x, y) => y.d + y.u - (x.d + x.u))
    .slice(0, 100);

  return { total: { d, u }, attributed, lan: lanBytes, days, hours, apps: appList.slice(0, 100), hosts: hostList };
}

module.exports = { Names, compute, isLan, groupOf };
