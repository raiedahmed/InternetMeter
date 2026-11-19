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

let win, widgetWin, tray, store, monitor, calc, tracker, names, isAdmin = false;
const iconCache = new Map();
let quitting = false;
let lastCheck = 0;
let speed = { down: 0, up: 0 };
let highSpeedSeconds = 0;
let lastLeakAlert = 0;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => showWindow());

function showWindow() {
  if (!win) return;
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1060, height: 780, minWidth: 880, minHeight: 640,
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

function createWidgetWindow() {
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.show();
    return;
  }
  const primaryDisplay = require('electron').screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  widgetWin = new BrowserWindow({
    width: 240, height: 76,
    x: width - 260, y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = isDev ? 'http://localhost:5173/#widget' : pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).href + '#widget';
  widgetWin.loadURL(url);
  widgetWin.on('closed', () => { widgetWin = null; });
}

function toggleWidget(show) {
  if (show === undefined) show = !store.state.settings.showWidget;
  store.state.settings.showWidget = show;
  store.touch(); store.save();
  if (show) {
    createWidgetWindow();
  } else if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.close();
  }
  buildTrayMenu();
}

const STR = {
  ar: {
    app: 'عدّاد الإنترنت', open: 'فتح العدّاد', quit: 'خروج',
    toggleWidget: 'إظهار / إخفاء الويدجت العائم',
    alertTitle: (l) => `⚠️ استهلكت ${l}% من الباقة`,
    alertBody: (rem, safe) => `المتبقي ${rem} — الحصة اليومية الآمنة ${safe}`,
    leakTitle: '⚠️ تنبيه استهلاك بيانات مرتفع بالخلفية',
    leakBody: (spd) => `تم رصد سحب بيانات مرتفع ومستمر بسرعة ${spd}! تفقد التطبيقات النشطة.`,
  },
  en: {
    app: 'Internet Meter', open: 'Open Internet Meter', quit: 'Quit',
    toggleWidget: 'Toggle Mini Widget',
    alertTitle: (l) => `⚠️ You have used ${l}% of your plan`,
    alertBody: (rem, safe) => `${rem} left — safe daily allowance ${safe}`,
    leakTitle: '⚠️ High Background Data Leak Alert',
    leakBody: (spd) => `High continuous download detected at ${spd}! Check your running apps.`,
  },
};
// اللغة المحفوظة، وإلا لغة النظام
const L = () => STR[store.state.settings.lang || (app.getLocale().toLowerCase().startsWith('ar') ? 'ar' : 'en')];

function buildTrayMenu() {
  const s = L();
  const widgetActive = !!store.state.settings.showWidget;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: s.open, click: showWindow },
    { label: `${s.toggleWidget} (${widgetActive ? '✓' : '✗'})`, click: () => toggleWidget() },
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

function checkLeakAlert() {
  if (!store.state.settings.leakAlert) return;
  // سرعة تحميل أعلى من 3.5 ميجابايت/ثانية بشكل مستمر لأكثر من 15 ثانية
  if (speed.down > 3.5 * 1024 * 1024) {
    highSpeedSeconds += 1;
    if (highSpeedSeconds >= 15) {
      const now = Date.now();
      if (now - lastLeakAlert > 30 * 60 * 1000) { // تنبيه مرة كل 30 دقيقة
        lastLeakAlert = now;
        new Notification({
          title: L().leakTitle,
          body: L().leakBody(fmtSpeed(speed.down)),
          icon: ICON,
        }).show();
      }
    }
  } else {
    highSpeedSeconds = Math.max(0, highSpeedSeconds - 2);
  }
}

function onSample({ down, up, dt }) {
  store.add(calc.dateKey(), down, up, new Date().getHours());
  speed = dt > 0 ? { down: down / dt, up: up / dt } : speed;
  const t = store.state.daily[calc.dateKey()] || { d: 0, u: 0 };
  const today = { d: t.d, u: t.u };
  const tickData = { downBps: speed.down, upBps: speed.up, todayKey: calc.dateKey(), today };

  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send('tick', tickData);
  }
  if (widgetWin && !widgetWin.isDestroyed()) {
    widgetWin.webContents.send('tick', tickData);
  }

  const now = Date.now();
  if (now - lastCheck > 30000) { lastCheck = now; checkAlerts(); }
  checkLeakAlert();
  if (tray) tray.setToolTip(`↓ ${fmtSpeed(speed.down)}  ↑ ${fmtSpeed(speed.up)}`);
}

const ps = (cmd) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd], { windowsHide: true }, () => {});
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function applyAutoStart() {
  if (isDev) return;
  const want = !!store.state.settings.autoStart;
  if (isAdmin) {
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

function scanLocalNetwork() {
  return new Promise((resolve) => {
    execFile('arp', ['-a'], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return resolve({ devices: [], gateway: null, count: 0 });
      const devices = [];
      const lines = stdout.split(/\r?\n/);
      let gateway = null;

      for (const line of lines) {
        const trimmed = line.trim();
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 3 && /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(parts[0])) {
          const ip = parts[0];
          const mac = parts[1].replace(/-/g, ':').toLowerCase();
          const alloc = parts[2];
          // تجاهل عناوين البث والمجموعات
          if (ip.startsWith('224.') || ip.startsWith('239.') || ip === '255.255.255.255' || mac === 'ff:ff:ff:ff:ff:ff') {
            continue;
          }
          const isRouter = ip.endsWith('.1') || ip.endsWith('.254');
          if (isRouter && !gateway) gateway = ip;
          devices.push({
            ip,
            mac,
            type: isRouter ? 'router' : 'device',
            alloc,
          });
        }
      }
      resolve({ devices, gateway, count: devices.length });
    });
  });
}

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
    const daily = {};
    for (const [k, v] of Object.entries(store.state.daily)) {
      daily[k] = { d: v.d, u: v.u, h: v.h };
    }
    return { settings: store.state.settings, daily, todayKey: calc.dateKey() };
  });
  ipcMain.handle('detail:get', (_e, from, to) => compute(store, names, from, to));
  ipcMain.handle('tracker:status', () => ({ status: tracker ? tracker.status : 'starting', detail: tracker?.detail || '', admin: isAdmin }));
  ipcMain.handle('admin:relaunch', () => relaunchAsAdmin());
  ipcMain.handle('network:scan', () => scanLocalNetwork());
  ipcMain.handle('widget:toggle', (_e, show) => toggleWidget(show));
  ipcMain.handle('window:focus', () => showWindow());
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
    if (store.state.settings.showWidget && (!widgetWin || widgetWin.isDestroyed())) {
      createWidgetWindow();
    } else if (!store.state.settings.showWidget && widgetWin && !widgetWin.isDestroyed()) {
      widgetWin.close();
    }
    return store.state.settings;
  });

  createWindow();
  createTray();
  if (store.state.settings.showWidget) createWidgetWindow();
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());

  monitor = new Monitor(store.state.counters);
  monitor.on('sample', onSample);
  monitor.on('error', (e) => console.error('monitor', e));
  monitor.start();
  startTracking();

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
