const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { Store } = require('./store.cjs');
const { Monitor } = require('./monitor.cjs');
const { Tracker } = require('./tracker.cjs');
const { Names, compute } = require('./detail.cjs');
const { execFile, spawn } = require('child_process');

const isDev = process.argv.includes('--dev');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

let win, tray, store, monitor, calc, tracker, names, isAdmin = false;
const iconCache = new Map();
let quitting = false;
let lastCheck = 0;
let speed = { down: 0, up: 0 };

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 760, minWidth: 880, minHeight: 640,
    title: 'عدّاد الإنترنت',
    backgroundColor: '#0b1020',
    icon: ICON,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); } // يبقى يعمل في الخلفية
  });
  if (isDev) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

const STR = {
  ar: {
    app: 'عدّاد الإنترنت', open: 'فتح العدّاد', quit: 'خروج',
    alertTitle: (l) => `⚠️ استهلكت ${l}% من الباقة`,
    alertBody: (rem, safe) => `المتبقي ${rem} — الحصة اليومية الآمنة ${safe}`,
  },
  en: {
    app: 'Internet Meter', open: 'Open Internet Meter', quit: 'Quit',
    alertTitle: (l) => `⚠️ You have used ${l}% of your plan`,
    alertBody: (rem, safe) => `${rem} left — safe daily allowance ${safe}`,
  },
};
// اللغة المحفوظة، وإلا لغة النظام
const L = () => STR[store.state.settings.lang || (app.getLocale().toLowerCase().startsWith('ar') ? 'ar' : 'en')];

function buildTrayMenu() {
  const s = L();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: s.open, click: showWindow },
    { type: 'separator' },
    { label: s.quit, click: () => { quitting = true; app.quit(); } },
  ]));
  if (win) win.setTitle(s.app);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip(L().app);
  tray.on('click', showWindow);
  buildTrayMenu();
}

const fmt = (b) => (b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + ' GB' : (b / 1024 ** 2).toFixed(0) + ' MB');
const fmtSpeed = (b) => (b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + ' MB/s' : (b / 1024).toFixed(0) + ' KB/s');

function checkAlerts() {
  const s = store.state;
  if (!s.settings.configured) return;
  const st = calc.computeStats(s.settings, s.daily);
  if (s.alerted.cycle !== st.startKey) { s.alerted = { cycle: st.startKey, levels: [] }; store.touch(); }
  for (const lvl of [...s.settings.alerts].sort((a, b) => a - b)) {
    if (st.pct * 100 >= lvl && !s.alerted.levels.includes(lvl)) {
      s.alerted.levels.push(lvl);
      store.touch();
      new Notification({
        title: L().alertTitle(lvl),
        body: L().alertBody(fmt(Math.max(0, st.remaining)), fmt(st.dailySafe)),
        icon: ICON,
      }).show();
    }
  }
}

function onSample({ down, up, dt }) {
  store.add(calc.dateKey(), down, up, new Date().getHours());
  speed = dt > 0 ? { down: down / dt, up: up / dt } : speed;
  const t = store.state.daily[calc.dateKey()] || { d: 0, u: 0 };
  const today = { d: t.d, u: t.u };
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send('tick', { downBps: speed.down, upBps: speed.up, todayKey: calc.dateKey(), today });
  }
  const now = Date.now();
  if (now - lastCheck > 30000) { lastCheck = now; checkAlerts(); }
  if (tray) tray.setToolTip(`↓ ${fmtSpeed(speed.down)}  ↑ ${fmtSpeed(speed.up)}`);
}

const ps = (cmd) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true }, () => {});
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function applyAutoStart() {
  if (isDev) return;
  const want = !!store.state.settings.autoStart;
  if (isAdmin) {
    // البرنامج يعمل كمسؤول (لتتبع التطبيقات)، ومفاتيح Run لا تُشغّل برامج مرتفعة الصلاحية، فنستخدم مهمة مجدولة
    app.setLoginItemSettings({ openAtLogin: false });
    if (want) {
      ps(`$a=New-ScheduledTaskAction -Execute ${q(process.execPath)} -Argument '--hidden'; ` +
        `$t=New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME; ` +
        `$p=New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive; ` +
        `$s=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero); ` +
        `Register-ScheduledTask -TaskName InternetMeter -Action $a -Trigger $t -Principal $p -Settings $s -Force`);
    } else {
      ps('Unregister-ScheduledTask -TaskName InternetMeter -Confirm:$false -ErrorAction SilentlyContinue');
    }
  } else {
    app.setLoginItemSettings({ openAtLogin: want, args: ['--hidden'] });
  }
}

/** إعادة تشغيل البرنامج بصلاحيات المسؤول (يظهر طلب UAC) */
function relaunchAsAdmin() {
  const args = process.argv.slice(1).filter((a) => a !== '--hidden');
  const list = args.length ? ` -ArgumentList @(${args.map(q).join(',')})` : '';
  spawn('powershell.exe', ['-NoProfile', '-Command',
    `Start-Process -FilePath ${q(process.execPath)}${list} -WorkingDirectory ${q(process.cwd())} -Verb RunAs`],
  { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  quitting = true;
  app.quit();
}

const checkAdmin = () => new Promise((res) => execFile('net.exe', ['session'], { windowsHide: true }, (e) => res(!e)));

function startTracking() {
  names = new Names(store);
  names.start();
  tracker = new Tracker();
  tracker.on('rows', (rows) => {
    store.addApps(calc.dateKey(), rows);
    for (const r of rows) names.observe(r.ip);
  });
  tracker.on('status', (s) => { if (win && !win.isDestroyed()) win.webContents.send('tracker', s); });
  tracker.start();
  setInterval(() => store.prune(), 10 * 60 * 1000);
  store.prune();
}

app.whenReady().then(async () => {
  calc = await import(pathToFileURL(path.join(__dirname, '..', 'shared', 'calc.mjs')).href);
  Menu.setApplicationMenu(null);
  store = new Store(app.getPath('userData'));

  isAdmin = await checkAdmin();

  ipcMain.handle('state:get', () => {
    const daily = {}; // الواجهة تحتاج الإجمالي فقط؛ التفاصيل تُطلب عند الحاجة
    for (const [k, v] of Object.entries(store.state.daily)) daily[k] = { d: v.d, u: v.u };
    return { settings: store.state.settings, daily, todayKey: calc.dateKey() };
  });
  ipcMain.handle('detail:get', (_e, from, to) => compute(store, names, from, to));
  ipcMain.handle('tracker:status', () => ({ status: tracker ? tracker.status : 'starting', detail: tracker?.detail || '', admin: isAdmin }));
  ipcMain.handle('admin:relaunch', () => relaunchAsAdmin());
  ipcMain.handle('icon:get', async (_e, p) => {
    if (!p) return '';
    if (iconCache.has(p)) return iconCache.get(p);
    let url = '';
    try { url = (await app.getFileIcon(p, { size: 'small' })).toDataURL(); } catch { /* بلا أيقونة */ }
    iconCache.set(p, url);
    return url;
  });
  ipcMain.handle('settings:save', (_e, patch) => {
    store.state.settings = { ...store.state.settings, ...patch, configured: true };
    store.touch(); store.save(); applyAutoStart(); lastCheck = 0;
    if (tray) buildTrayMenu();
    return store.state.settings;
  });

  createWindow();
  createTray();
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());

  monitor = new Monitor(store.state.counters);
  monitor.on('sample', onSample);
  monitor.on('error', (e) => console.error('monitor', e));
  monitor.start();
  startTracking();
  // للاختبارات الآلية: --exit-after=SECONDS يغلق البرنامج بعد مدة (مع حفظ البيانات)
  const ex = process.argv.find((a) => a.startsWith('--exit-after='));
  if (ex) setTimeout(() => { quitting = true; app.quit(); }, Number(ex.split('=')[1]) * 1000);
  setInterval(() => store.save(), 10000);
  applyAutoStart();
});

app.on('before-quit', () => {
  quitting = true;
  if (monitor) monitor.stop();
  if (tracker) tracker.stop();
  if (names) names.stop();
  if (store) { store.touch(); store.save(); }
});
app.on('window-all-closed', () => { /* يبقى في شريط المهام */ });
