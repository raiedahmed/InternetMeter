const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { Store } = require('./store.cjs');
const { Monitor } = require('./monitor.cjs');

const isDev = process.argv.includes('--dev');
const ICON = path.join(__dirname, '..', 'assets', 'icon.png');

let win, tray, store, monitor, calc;
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

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip('عدّاد الإنترنت');
  tray.on('click', showWindow);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'فتح العدّاد', click: showWindow },
    { type: 'separator' },
    { label: 'خروج', click: () => { quitting = true; app.quit(); } },
  ]));
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
        title: `⚠️ استهلكت ${lvl}% من الباقة`,
        body: `المتبقي ${fmt(Math.max(0, st.remaining))} — الحصة اليومية الآمنة ${fmt(st.dailySafe)}`,
        icon: ICON,
      }).show();
    }
  }
}

function onSample({ down, up, dt }) {
  store.add(calc.dateKey(), down, up);
  speed = dt > 0 ? { down: down / dt, up: up / dt } : speed;
  const today = store.state.daily[calc.dateKey()] || { d: 0, u: 0 };
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.webContents.send('tick', { downBps: speed.down, upBps: speed.up, todayKey: calc.dateKey(), today });
  }
  const now = Date.now();
  if (now - lastCheck > 30000) { lastCheck = now; checkAlerts(); }
  if (tray) tray.setToolTip(`↓ ${fmtSpeed(speed.down)}  ↑ ${fmtSpeed(speed.up)}`);
}

function applyAutoStart() {
  if (isDev) return;
  app.setLoginItemSettings({ openAtLogin: !!store.state.settings.autoStart, args: ['--hidden'] });
}

app.whenReady().then(async () => {
  calc = await import(pathToFileURL(path.join(__dirname, '..', 'shared', 'calc.mjs')).href);
  Menu.setApplicationMenu(null);
  store = new Store(app.getPath('userData'));

  ipcMain.handle('state:get', () => ({
    settings: store.state.settings, daily: store.state.daily, todayKey: calc.dateKey(),
  }));
  ipcMain.handle('settings:save', (_e, patch) => {
    store.state.settings = { ...store.state.settings, ...patch, configured: true };
    store.touch(); store.save(); applyAutoStart(); lastCheck = 0;
    return store.state.settings;
  });

  createWindow();
  createTray();
  if (process.argv.includes('--hidden')) win.once('ready-to-show', () => win.hide());

  monitor = new Monitor(store.state.counters);
  monitor.on('sample', onSample);
  monitor.on('error', (e) => console.error('monitor', e));
  monitor.start();
  setInterval(() => store.save(), 10000);
  applyAutoStart();
});

app.on('before-quit', () => { quitting = true; if (monitor) monitor.stop(); if (store) { store.touch(); store.save(); } });
app.on('window-all-closed', () => { /* يبقى في شريط المهام */ });
